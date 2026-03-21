// tests/centipede.test.mjs
// Multi-segment centipede: body cascade, split-on-death, promotion.

import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Player } from '../src/rules/components/Player.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { Faction } from '../src/rules/components/Faction.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { Speed } from '../src/rules/components/Speed.js';
import { Brain } from '../src/rules/components/Brain.js';
import { AggroState, AGGRO_LEVELS } from '../src/rules/components/AggroState.js';
import { CentipedeSegment } from '../src/rules/components/CentipedeSegment.js';
import { Collider } from '../src/rules/components/Collider.js';
import { SoundEmitter } from '../src/rules/components/SoundEmitter.js';
import { Wounds } from '../src/rules/components/Wounds.js';
import { installCentipedeBodyCascade } from '../src/rules/utils/centipedeMovement.js';
import { centipedeSplitOnDeath } from '../src/rules/data/callbacks/death.js';
import { DeathCallbackContext } from '../src/rules/data/callbacks/death.js';
import { clearAll, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";

// ── Helpers ───────────────────────────────────────────────────────────

function makeWorld(seed = 1) {
  const world = new World({ seed });
  world.step = 1;
  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 0, y: 0 });
  installCentipedeBodyCascade(world);
  return world;
}

/** Build a 5-segment centipede chain at positions [(5,5),(6,5),(7,5),(8,5),(9,5)]. */
function buildChain(world, length = 5) {
  const chainId = 42;
  const ids = [];
  for (let i = 0; i < length; i++) {
    const id = world.create();
    world.add(id, Position, { x: 5 + i, y: 5 });
    world.add(id, NamedIdentity, { name: 'Giant Centipede', identity: 'centipede' });
    world.add(id, Faction, { key: 'enemy' });
    world.add(id, Vitality, { maxHp: 10, hp: 10 });
    world.add(id, Collider, { solid: true, blocksSight: false });
    world.add(id, Speed, { actEvery: 1 });
    if (i === 0) {
      // Head gets full AI
      world.add(id, Brain, {
        learnedSpellIds: [], itemKnowledgeIdentities: [],
        seenTiles: new Uint8Array(), intelligence: 2, visionRange: 8,
      });
      world.add(id, AggroState, {
        alertLevel: AGGRO_LEVELS.unaware,
        lastKnownX: 0, lastKnownY: 0, searchTurnsLeft: 0,
        retreating: false, patrolDx: 0, patrolDy: 0,
      });
      world.add(id, SoundEmitter, { ambient: 30, lastActionNoise: 0 });
      world.add(id, Wounds, { list: [] });
    }
    ids.push(id);
  }
  // Link chain
  for (let i = 0; i < ids.length; i++) {
    world.add(ids[i], CentipedeSegment, {
      headId: i === 0 ? 0 : ids[0],
      index: i,
      nextId: i < ids.length - 1 ? ids[i + 1] : 0,
      prevId: i > 0 ? ids[i - 1] : 0,
      chainId,
    });
  }
  return ids;
}

// ── Tests ─────────────────────────────────────────────────────────────

Deno.test("body cascade: segments follow head movement", () => {
  const world = makeWorld();
  const ids = buildChain(world);
  // Head at (5,5), seg1 at (6,5), seg2 at (7,5), seg3 at (8,5), seg4 at (9,5)

  // Move head from (5,5) to (5,4)
  const oldPos = { x: 5, y: 5 };
  world.set(ids[0], Position, { x: 5, y: 4 });
  world.emit("moved", { id: ids[0], from: oldPos, to: { x: 5, y: 4 } });

  assertEquals(world.get(ids[0], Position).x, 5);
  assertEquals(world.get(ids[0], Position).y, 4);

  // Each segment should have moved to its predecessor's old position
  assertEquals(world.get(ids[1], Position).x, 5);
  assertEquals(world.get(ids[1], Position).y, 5);
  assertEquals(world.get(ids[2], Position).x, 6);
  assertEquals(world.get(ids[2], Position).y, 5);
  assertEquals(world.get(ids[3], Position).x, 7);
  assertEquals(world.get(ids[3], Position).y, 5);
  assertEquals(world.get(ids[4], Position).x, 8);
  assertEquals(world.get(ids[4], Position).y, 5);
});

Deno.test("body segments lack AI components", () => {
  const world = makeWorld();
  const ids = buildChain(world);

  // Head has AI
  assert(world.has(ids[0], Brain), "head should have Brain");
  assert(world.has(ids[0], AggroState), "head should have AggroState");

  // Body segments do not
  for (let i = 1; i < ids.length; i++) {
    assert(!world.has(ids[i], Brain), `segment ${i} should NOT have Brain`);
    assert(!world.has(ids[i], AggroState), `segment ${i} should NOT have AggroState`);
  }
});

Deno.test("killing middle segment splits chain into two", () => {
  const world = makeWorld();
  const ids = buildChain(world);
  // Kill segment at index 2 (ids[2])
  const deadSeg = ids[2];

  // Simulate death: set hp to 0, fire onDeath callback
  world.mutate(deadSeg, Vitality, v => { v.hp = 0; });
  const callback = centipedeSplitOnDeath();
  const pos = world.get(deadSeg, Position);
  const ctx = new DeathCallbackContext(world, {
    deadId: deadSeg,
    killer: 999,
    cause: 'melee',
    identity: 'centipede',
    pos: pos ? { x: pos.x, y: pos.y } : null,
  });
  callback(ctx);

  // Front chain (ids[0], ids[1]) should be intact
  const seg0 = world.get(ids[0], CentipedeSegment);
  const seg1 = world.get(ids[1], CentipedeSegment);
  assertEquals(seg0.nextId, ids[1]);
  assertEquals(seg1.nextId, 0, "seg1 should now be the tail of front chain");

  // Back chain (ids[3], ids[4]) should be promoted
  const seg3 = world.get(ids[3], CentipedeSegment);
  const seg4 = world.get(ids[4], CentipedeSegment);
  assertEquals(seg3.index, 0, "seg3 should now be head (index 0)");
  assertEquals(seg3.headId, 0, "seg3 headId should be 0 (self is head)");
  assertEquals(seg3.prevId, 0, "seg3 should have no predecessor");
  assertEquals(seg3.nextId, ids[4]);
  assertEquals(seg4.index, 1);
  assertEquals(seg4.headId, ids[3], "seg4 should point to new head");
});

Deno.test("promoted segment gets Brain and AggroState", () => {
  const world = makeWorld();
  const ids = buildChain(world);

  // Kill middle segment
  world.mutate(ids[2], Vitality, v => { v.hp = 0; });
  const callback = centipedeSplitOnDeath();
  const pos = world.get(ids[2], Position);
  const ctx = new DeathCallbackContext(world, {
    deadId: ids[2], killer: 999, cause: 'melee', identity: 'centipede',
    pos: { x: pos.x, y: pos.y },
  });
  callback(ctx);

  // ids[3] is the new head — should now have Brain and AggroState
  assert(world.has(ids[3], Brain), "new head should have Brain");
  assert(world.has(ids[3], AggroState), "new head should have AggroState");
  assertEquals(
    world.get(ids[3], AggroState).alertLevel,
    AGGRO_LEVELS.hunting,
    "new head should start hunting"
  );
});

Deno.test("killing head promotes next segment", () => {
  const world = makeWorld();
  const ids = buildChain(world);

  // Kill head (ids[0])
  world.mutate(ids[0], Vitality, v => { v.hp = 0; });
  const callback = centipedeSplitOnDeath();
  const pos = world.get(ids[0], Position);
  const ctx = new DeathCallbackContext(world, {
    deadId: ids[0], killer: 999, cause: 'melee', identity: 'centipede',
    pos: { x: pos.x, y: pos.y },
  });
  callback(ctx);

  // ids[1] is now the head
  const seg1 = world.get(ids[1], CentipedeSegment);
  assertEquals(seg1.index, 0, "seg1 should be head now");
  assertEquals(seg1.headId, 0);
  assertEquals(seg1.prevId, 0);
  assert(world.has(ids[1], Brain), "new head should have Brain");
  assert(world.has(ids[1], AggroState), "new head should have AggroState");
});

Deno.test("killing tail just shortens the chain", () => {
  const world = makeWorld();
  const ids = buildChain(world);
  const tailId = ids[4];

  world.mutate(tailId, Vitality, v => { v.hp = 0; });
  const callback = centipedeSplitOnDeath();
  const pos = world.get(tailId, Position);
  const ctx = new DeathCallbackContext(world, {
    deadId: tailId, killer: 999, cause: 'melee', identity: 'centipede',
    pos: { x: pos.x, y: pos.y },
  });
  callback(ctx);

  // ids[3] should now be the tail (nextId = 0)
  const seg3 = world.get(ids[3], CentipedeSegment);
  assertEquals(seg3.nextId, 0, "seg3 should now be the tail");

  // No new heads created — ids[3] should NOT have Brain
  assert(!world.has(ids[3], Brain), "seg3 should not gain Brain from tail death");
});

Deno.test("single-segment centipede acts as normal monster", () => {
  const world = makeWorld();
  const chainId = 99;
  const id = world.create();
  world.add(id, Position, { x: 5, y: 5 });
  world.add(id, NamedIdentity, { name: 'Giant Centipede', identity: 'centipede' });
  world.add(id, Faction, { key: 'enemy' });
  world.add(id, Vitality, { maxHp: 10, hp: 10 });
  world.add(id, Brain, {
    learnedSpellIds: [], itemKnowledgeIdentities: [],
    seenTiles: new Uint8Array(), intelligence: 2, visionRange: 8,
  });
  world.add(id, AggroState, {
    alertLevel: AGGRO_LEVELS.unaware,
    lastKnownX: 0, lastKnownY: 0, searchTurnsLeft: 0,
    retreating: false, patrolDx: 0, patrolDy: 0,
  });
  world.add(id, CentipedeSegment, {
    headId: 0, index: 0, nextId: 0, prevId: 0, chainId,
  });

  // Killing it should not crash (no next/prev to promote)
  world.mutate(id, Vitality, v => { v.hp = 0; });
  const callback = centipedeSplitOnDeath();
  const pos = world.get(id, Position);
  const ctx = new DeathCallbackContext(world, {
    deadId: id, killer: 999, cause: 'melee', identity: 'centipede',
    pos: { x: pos.x, y: pos.y },
  });
  callback(ctx); // Should not throw
});

Deno.test("new chain gets a fresh chainId after split", () => {
  const world = makeWorld();
  const ids = buildChain(world);
  const originalChainId = world.get(ids[0], CentipedeSegment).chainId;

  // Kill middle segment
  world.mutate(ids[2], Vitality, v => { v.hp = 0; });
  const callback = centipedeSplitOnDeath();
  const pos = world.get(ids[2], Position);
  const ctx = new DeathCallbackContext(world, {
    deadId: ids[2], killer: 999, cause: 'melee', identity: 'centipede',
    pos: { x: pos.x, y: pos.y },
  });
  callback(ctx);

  // Front chain keeps original chainId
  assertEquals(world.get(ids[0], CentipedeSegment).chainId, originalChainId);
  assertEquals(world.get(ids[1], CentipedeSegment).chainId, originalChainId);

  // Back chain gets a NEW chainId
  const newChainId = world.get(ids[3], CentipedeSegment).chainId;
  assert(newChainId !== originalChainId, "new chain should have different chainId");
  assertEquals(world.get(ids[4], CentipedeSegment).chainId, newChainId);
});
