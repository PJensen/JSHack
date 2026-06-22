import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { Collider } from "../src/rules/components/Collider.js";
import { Status } from "../src/rules/components/Status.js";
import { runSpellScript } from "../src/rules/scripts/spells.js";
import { effectSystem } from "../src/rules/systems/effectSystem.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";
import { clearAll as clearTileMap, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";

const PHASE_STRIKE = { id: "phase_strike", name: "Phase Strike", manaCost: 10, range: 10, script: "phase_strike" };

function loadFlatFloor() {
  clearTileMap();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
}

function makeActor(world, x, y) {
  const id = world.create();
  world.add(id, Position, { x, y });
  return id;
}

function makeEnemy(world, x, y, hp = 20) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Faction, { key: "enemy" });
  world.add(id, Vitality, { maxHp: hp, hp });
  world.add(id, Collider, { solid: true, blocksSight: false });
  world.add(id, ActiveEffects, { effects: [] });
  return id;
}

Deno.test("phase_strike: damages and stuns enemy on the path", () => {
  loadFlatFloor();
  const world = new World({ seed: 0xFA5E01 });
  const actor = makeActor(world, 10, 10);
  // Place enemy directly in the line between (10,10) and (15,10)
  const enemy = makeEnemy(world, 12, 10, 20);

  const events = [];
  const teleports = [];
  world.on("spell:phase_strike", (e) => events.push(e));
  world.on("teleported", (e) => teleports.push(e));

  // Target tile (15,10) — enemy at (12,10) is on the Bresenham line
  runSpellScript(world, actor, PHASE_STRIKE, { x: 15, y: 10 });

  // Actor should have teleported
  const actorPos = world.get(actor, Position);
  assert(actorPos.x !== 10 || actorPos.y !== 10, "actor should have moved");

  // Event should fire with hits
  assertEquals(events.length, 1, "should emit spell:phase_strike event");
  assertEquals(teleports[0]?.source, "spell:phase_strike");
  assert(events[0].hits.length >= 1, "should have at least 1 hit");

  // Enemy should have taken damage
  const vit = world.get(enemy, Vitality);
  assert(vit.hp < 20, `enemy hp should be reduced, got ${vit.hp}`);

  // Enemy should have stun effect in ActiveEffects
  const ae = world.get(enemy, ActiveEffects);
  assert(ae, "enemy should have ActiveEffects");
  const stunEffect = ae.effects.find(e => e.key === "stun");
  assert(stunEffect, `enemy should have stun effect, effects: ${JSON.stringify(ae.effects)}`);
  assert(stunEffect.turnsLeft >= 1, `stun turnsLeft should be >= 1, got ${stunEffect.turnsLeft}`);
});

Deno.test("phase_strike: effectSystem syncs stun to Status component", () => {
  loadFlatFloor();
  const world = new World({ seed: 0xFA5E03 });
  const actor = makeActor(world, 10, 10);
  const enemy = makeEnemy(world, 12, 10, 20);

  runSpellScript(world, actor, PHASE_STRIKE, { x: 15, y: 10 });

  // Run effectSystem to sync ActiveEffects -> Status
  effectSystem(world);

  const status = world.get(enemy, Status);
  assert(status, "enemy should have Status component after effectSystem");
  const stunStatus = status.statuses.find(s => s.type === "stunned");
  assert(stunStatus, `enemy should have 'stunned' status, got: ${JSON.stringify(status.statuses)}`);
  assert(stunStatus.duration >= 1, `stunned duration should be >= 1, got ${stunStatus.duration}`);
});

Deno.test("phase_strike: no enemies hit when path is clear", () => {
  loadFlatFloor();
  const world = new World({ seed: 0xFA5E02 });
  const actor = makeActor(world, 10, 10);

  const events = [];
  world.on("spell:phase_strike", (e) => events.push(e));

  runSpellScript(world, actor, PHASE_STRIKE, { x: 15, y: 10 });

  assertEquals(events.length, 1);
  assertEquals(events[0].hits.length, 0, "no enemies should be hit");
});
