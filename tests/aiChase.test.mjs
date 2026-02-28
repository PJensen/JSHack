import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Player } from '../src/rules/components/Player.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { Faction } from '../src/rules/components/Faction.js';
import { MoveIntent } from '../src/rules/components/Intents/MoveIntent.js';
import { aiChaseSystem } from '../src/rules/systems/aiChaseSystem.js';
import { clearAll, isWalkable, loadChunk, setTile } from "../src/rules/environment/dungeon/tileMap.js";
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL } from "../src/rules/environment/dungeon/constants.js";

Deno.test("monster east of player chases west", () => {
  const world = new World({ seed: 1 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  world.add(player, NamedIdentity, { name: 'Hero', identity: 'player' });

  const m1 = world.create();
  world.add(m1, Position, { x: 8, y: 5 });
  world.add(m1, NamedIdentity, { name: 'Goblin', identity: 'goblin' });
  world.add(m1, Faction, { key: 'enemy' });

  aiChaseSystem(world);

  const intent = world.get(m1, MoveIntent);
  assert(intent, 'monster should have MoveIntent');
  assert(intent.dx === -1 && intent.dy === 0, `m1 should move west, got dx=${intent.dx} dy=${intent.dy}`);
});

Deno.test("monster north of player chases south", () => {
  const world = new World({ seed: 1 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  world.add(player, NamedIdentity, { name: 'Hero', identity: 'player' });

  const m2 = world.create();
  world.add(m2, Position, { x: 5, y: 2 });
  world.add(m2, NamedIdentity, { name: 'Orc', identity: 'orc' });
  world.add(m2, Faction, { key: 'enemy' });

  aiChaseSystem(world);

  const i2 = world.get(m2, MoveIntent);
  assert(i2, 'm2 should have MoveIntent');
  assert(i2.dx === 0 && i2.dy === 1, `m2 should move south, got dx=${i2.dx} dy=${i2.dy}`);
});

Deno.test("diagonal chase: equal distance prefers x-axis", () => {
  const world = new World({ seed: 1 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  world.add(player, NamedIdentity, { name: 'Hero', identity: 'player' });

  const m3 = world.create();
  world.add(m3, Position, { x: 8, y: 2 });
  world.add(m3, NamedIdentity, { name: 'Troll', identity: 'troll' });
  world.add(m3, Faction, { key: 'enemy' });

  aiChaseSystem(world);

  const i3 = world.get(m3, MoveIntent);
  assert(i3, 'm3 should have MoveIntent');
  assert(i3.dx === -1 && i3.dy === 0, `m3 should move along x-axis, got dx=${i3.dx} dy=${i3.dy}`);
});

Deno.test("pre-existing MoveIntent is not overwritten", () => {
  const world = new World({ seed: 1 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  world.add(player, NamedIdentity, { name: 'Hero', identity: 'player' });

  const m4 = world.create();
  world.add(m4, Position, { x: 3, y: 5 });
  world.add(m4, NamedIdentity, { name: 'Imp', identity: 'imp' });
  world.add(m4, Faction, { key: 'enemy' });
  world.add(m4, MoveIntent, { dx: 0, dy: -1 });

  aiChaseSystem(world);

  const i4 = world.get(m4, MoveIntent);
  assert(i4.dx === 0 && i4.dy === -1, 'pre-existing MoveIntent should not be overwritten');
});

Deno.test("monster on same tile as player does not move", () => {
  const world = new World({ seed: 1 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  world.add(player, NamedIdentity, { name: 'Hero', identity: 'player' });

  const m5 = world.create();
  world.add(m5, Position, { x: 5, y: 5 });
  world.add(m5, NamedIdentity, { name: 'Shade', identity: 'shade' });
  world.add(m5, Faction, { key: 'enemy' });

  aiChaseSystem(world);

  assert(!world.has(m5, MoveIntent), 'monster on player tile should not get MoveIntent');
});

Deno.test("non-monster entity is ignored by AI chase", () => {
  const world = new World({ seed: 1 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  world.add(player, NamedIdentity, { name: 'Hero', identity: 'player' });

  const npc = world.create();
  world.add(npc, Position, { x: 0, y: 0 });
  world.add(npc, NamedIdentity, { name: 'Villager', identity: 'npc' });
  world.add(npc, Faction, { key: 'neutral' });

  aiChaseSystem(world);

  assert(!world.has(npc, MoveIntent), 'non-monster should not get MoveIntent');
});

Deno.test("no player → AI chase is a no-op", () => {
  const world = new World({ seed: 2 });
  const lonely = world.create();
  world.add(lonely, Position, { x: 0, y: 0 });
  world.add(lonely, NamedIdentity, { name: 'Bat', identity: 'bat' });
  world.add(lonely, Faction, { key: 'enemy' });
  aiChaseSystem(world);
  assert(!world.has(lonely, MoveIntent), 'no player means no chase');
});

Deno.test("spider onSeen self-throws near player, not on player, and not into walls", () => {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
  try {
    // Force a deterministic landing near the player: north blocked so west is picked first.
    setTile(5, 4, TILE_WALL);
    setTile(5, 6, TILE_WALL);

    const world = new World({ seed: 1 });
    world.rand = () => 0.0; // guarantee jump triggers (chance = 0.25)
    const thrown = [];
    const bumps = [];
    world.on("item:thrown", (ev) => thrown.push(ev));
    world.on("bump:attack", (ev) => bumps.push(ev));

    const player = world.create();
    world.add(player, Player);
    world.add(player, Position, { x: 5, y: 5 });
    world.add(player, NamedIdentity, { name: "Hero", identity: "player" });

    const spider = world.create();
    world.add(spider, Position, { x: 9, y: 5 });
    world.add(spider, NamedIdentity, { name: "Spider", identity: "spider" });
    world.add(spider, Faction, { key: "enemy" });

    aiChaseSystem(world);

    const spiderPos = world.get(spider, Position);
    assert(spiderPos, "spider should still have a position");
    assertEquals(spiderPos.x, 4, "spider should land near player (west tile)");
    assertEquals(spiderPos.y, 5, "spider should land near player (west tile)");
    assert(!(spiderPos.x === 5 && spiderPos.y === 5), "spider should not land on top of player");
    assert(isWalkable(spiderPos.x, spiderPos.y), "spider landing tile should be walkable");

    assertEquals(thrown.length, 1, "onSeen self-throw should emit one throw event");
    assertEquals(thrown[0]?.itemId, spider);
    assertEquals(thrown[0]?.to?.x, 4);
    assertEquals(thrown[0]?.to?.y, 5);

    assertEquals(bumps.length, 1, "landing adjacent should emit a collision-style bump attack");
    assertEquals(bumps[0]?.attacker, spider);
    assertEquals(bumps[0]?.target, player);

    aiChaseSystem(world);
    assertEquals(thrown.length, 1, "onSeen should only trigger once while target remains seen");
  } finally {
    clearAll();
  }
});

Deno.test("spider onSeen self-throw is cooldown-gated for 3 turns", () => {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
  try {
    const world = new World({ seed: 1 });
    world.rand = () => 0.0; // guarantee jump triggers (chance = 0.25)
    const thrown = [];
    world.on("item:thrown", (ev) => thrown.push(ev));

    const player = world.create();
    world.add(player, Player);
    world.add(player, Position, { x: 5, y: 5 });
    world.add(player, NamedIdentity, { name: "Hero", identity: "player" });

    const spider = world.create();
    world.add(spider, Position, { x: 9, y: 5 });
    world.add(spider, NamedIdentity, { name: "Spider", identity: "spider" });
    world.add(spider, Faction, { key: "enemy" });

    world.step = 0;
    aiChaseSystem(world);
    assertEquals(thrown.length, 1, "spider should jump on first seen trigger");

    // Force LOS loss then reacquire to re-trigger onSeen while controlling position.
    world.set(spider, Position, { x: 9, y: 5 });
    try { world.remove(spider, MoveIntent); } catch {}
    setTile(7, 5, TILE_WALL);

    world.step = 1;
    aiChaseSystem(world);
    assertEquals(thrown.length, 1, "losing LOS should not trigger self-throw");

    world.set(spider, Position, { x: 9, y: 5 });
    try { world.remove(spider, MoveIntent); } catch {}
    setTile(7, 5, TILE_FLOOR);

    world.step = 2;
    aiChaseSystem(world);
    assertEquals(thrown.length, 1, "cooldown should block re-jump before 3 turns");

    world.set(spider, Position, { x: 9, y: 5 });
    try { world.remove(spider, MoveIntent); } catch {}
    setTile(7, 5, TILE_WALL);

    world.step = 3;
    aiChaseSystem(world);
    assertEquals(thrown.length, 1, "second LOS break should only reset seen state");

    world.set(spider, Position, { x: 9, y: 5 });
    try { world.remove(spider, MoveIntent); } catch {}
    setTile(7, 5, TILE_FLOOR);

    world.step = 4;
    aiChaseSystem(world);
    assertEquals(thrown.length, 2, "spider should jump again after cooldown window");
  } finally {
    clearAll();
  }
});
