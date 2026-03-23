// Prove that kinetic DR applies to melee hits (post bypassResist removal).
// Combos: mace (blunt) and sword (physical) vs cave_bear (DR:3).

import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { getMonster } from "../src/rules/data/monsters.js";
import { dealDamage } from "../src/rules/utils/dealDamage.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Resistances } from "../src/rules/components/Resistences.js";
import { clearAll, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";

function makeWorld(seed = 1) {
  clearAll();
  loadChunk(0, 0, new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR));
  return new World({ seed });
}

function spawnMonster(world, monsterId, x, y) {
  const def = getMonster(monsterId);
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Vitality, { hp: def.baseHp, maxHp: def.baseHp });
  if (def.resistances) {
    world.add(id, Resistances, JSON.parse(JSON.stringify(def.resistances)));
  }
  return { id, def };
}

// Cave bear: kinetic DR 3

// ── Mace (blunt) vs Cave Bear (DR:3) ───────────────────────────────

Deno.test("mace (blunt 5) vs cave_bear (DR:3) — damage reduced to 2", () => {
  const world = makeWorld(3);
  const { id, def } = spawnMonster(world, "cave_bear", 5, 5);
  const attacker = world.create();

  const result = dealDamage(world, {
    target: id, amount: 5, source: attacker,
    type: "blunt", cause: "melee",
  });

  assertEquals(result.applied, true, "5 blunt vs DR 3 = 2 damage");
  assertEquals(result.amount, 2);
  assertEquals(world.get(id, Vitality).hp, def.baseHp - 2);
});

Deno.test("mace (blunt 3) vs cave_bear (DR:3) — reduced to chip damage", () => {
  const world = makeWorld(30);
  const { id, def } = spawnMonster(world, "cave_bear", 5, 5);
  const attacker = world.create();

  const events = [];
  world.on("status", (e) => events.push(e));

  const result = dealDamage(world, {
    target: id, amount: 3, source: attacker,
    type: "blunt", cause: "melee",
  });

  assertEquals(result.applied, true, "3 blunt vs DR 3 should chip for 1");
  assertEquals(result.amount, 1);
  assertEquals(events.some(e => e.kind === "resist"), false, "chip damage should not emit resist status");
});

// ── Sword (physical) vs Cave Bear (DR:3) ───────────────────────────

Deno.test("sword (physical 5) vs cave_bear (DR:3) — damage reduced to 2", () => {
  const world = makeWorld(6);
  const { id, def } = spawnMonster(world, "cave_bear", 5, 5);
  const attacker = world.create();

  const result = dealDamage(world, {
    target: id, amount: 5, source: attacker,
    type: "physical", cause: "melee",
  });

  assertEquals(result.applied, true, "5 physical vs DR 3 = 2 damage");
  assertEquals(result.amount, 2);
  assertEquals(world.get(id, Vitality).hp, def.baseHp - 2);
});

Deno.test("sword (physical 8) vs cave_bear (DR:3) — damage reduced to 5", () => {
  const world = makeWorld(7);
  const { id, def } = spawnMonster(world, "cave_bear", 5, 5);
  const attacker = world.create();

  const result = dealDamage(world, {
    target: id, amount: 8, source: attacker,
    type: "physical", cause: "melee",
  });

  assertEquals(result.applied, true, "8 physical vs DR 3 = 5 damage");
  assertEquals(result.amount, 5);
  assertEquals(world.get(id, Vitality).hp, def.baseHp - 5);
});

Deno.test("pierce damage can punch through kinetic DR via armorPenetration", () => {
  const world = makeWorld(8);
  const { id, def } = spawnMonster(world, "cave_bear", 5, 5);
  const attacker = world.create();

  const result = dealDamage(world, {
    target: id,
    amount: 5,
    source: attacker,
    type: "pierce",
    cause: "melee",
    armorPenetration: 2,
  });

  assertEquals(result.applied, true, "5 pierce with 2 penetration vs DR 3 = 4 damage");
  assertEquals(result.amount, 4);
  assertEquals(world.get(id, Vitality).hp, def.baseHp - 4);
});
