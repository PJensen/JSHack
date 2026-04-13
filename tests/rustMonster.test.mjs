// Rust Monster: corrodes metal equipment on hit, stacks up to 3x, material immunity.

import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { getMonster } from "../src/rules/data/monsters.js";
import { CombatCallbackContext } from "../src/rules/data/callbacks/combat.js";
import { runCallbackList } from "../src/rules/interaction/dispatch.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { Material } from "../src/rules/components/Material.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Position } from "../src/rules/components/Position.js";
import { Player } from "../src/rules/components/Player.js";
import { clearAll, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";
import { resolveItemDisplayName } from "../src/main/wiring/itemName.js";

function makeWorld(seed = 1) {
  clearAll();
  loadChunk(0, 0, new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR));
  return new World({ seed });
}

// corrosionResist values from MATERIAL_CATALOG
const MATERIAL_CR = { steel: 0.7, mithril: 1.0, iron: 0.3 };

/** Create a player entity with an equipped armor item that has bonuses. */
function spawnEquippedPlayer(world, bonuses = { defense: 5 }, materialKind = "steel") {
  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  world.add(player, Vitality, { hp: 30, maxHp: 30 });
  world.add(player, Equipment, {});

  const armor = world.create();
  world.add(armor, ItemInfo, { type: "armor", slot: "armor", bonuses: { ...bonuses } });
  world.add(armor, NamedIdentity, { name: "Iron Plate", identity: "iron_plate" });
  if (materialKind) {
    world.add(armor, Material, { kind: materialKind, corrosionResist: MATERIAL_CR[materialKind] ?? 0.5 });
  }

  const eq = world.get(player, Equipment);
  eq.armor = armor;
  return { player, armor };
}

function spawnRustMonster(world) {
  const rm = world.create();
  world.add(rm, Position, { x: 6, y: 5 });
  world.add(rm, Vitality, { hp: 14, maxHp: 14 });
  return rm;
}

Deno.test("rust_monster: definition has corrode onHit hook", () => {
  const def = getMonster("rust_monster");
  assert(def, "rust_monster should exist");
  assert(def.hooks?.onHit?.length > 0, "should have onHit hooks");
  assert(def.specials.includes("Corrodes metal equipment"), "specials should mention corrode");
});

Deno.test("rust_monster: corrode reduces item bonus", () => {
  const world = makeWorld(42);
  const { player, armor } = spawnEquippedPlayer(world, { defense: 5 });
  const rm = spawnRustMonster(world);

  const events = [];
  world.on("proc:corroded", (e) => events.push(e));

  const hooks = getMonster("rust_monster").hooks.onHit;

  // Brute force seed/step combos to find one that triggers the 40% roll
  let triggered = false;
  for (let step = 0; step < 50; step++) {
    world.step = step;
    const ctx = new CombatCallbackContext(world, {
      attacker: rm,
      defender: player,
      damage: 3,
    });
    runCallbackList(hooks, ctx);
    if (events.length > 0) {
      triggered = true;
      break;
    }
  }

  assert(triggered, "corrode should trigger within 50 steps");
  const info = world.get(armor, ItemInfo);
  assertEquals(info.bonuses.defense, 4, "defense bonus should be reduced by 1");
  assertEquals(info.corrosionStacks, 1, "should have 1 corrosion stack");
  assertEquals(events[0].itemId, armor);
  assertEquals(events[0].stacks, 1);
});

Deno.test("rust_monster: corrosion stacks up to max", () => {
  const world = makeWorld(99);
  const { player, armor } = spawnEquippedPlayer(world, { defense: 6 });
  const rm = spawnRustMonster(world);

  const hooks = getMonster("rust_monster").hooks.onHit;
  let stacks = 0;

  // Keep applying until we hit max stacks (3)
  for (let step = 0; step < 200 && stacks < 3; step++) {
    world.step = step;
    const ctx = new CombatCallbackContext(world, {
      attacker: rm,
      defender: player,
      damage: 3,
    });
    runCallbackList(hooks, ctx);
    const info = world.get(armor, ItemInfo);
    stacks = info.corrosionStacks || 0;
  }

  assertEquals(stacks, 3, "should reach max corrosion stacks");
  const info = world.get(armor, ItemInfo);
  assertEquals(info.bonuses.defense, 3, "defense should be reduced by 3 total");

  const ni = world.get(armor, NamedIdentity);
  assertEquals(ni.name, "Iron Plate", "base identity name should stay canonical");
  const displayName = resolveItemDisplayName(world, armor);
  assert(displayName.includes("[Rusted]"), "display name should include [Rusted] marker");
});

Deno.test("rust_monster: immune to corrosion-resistant materials", () => {
  const world = makeWorld(77);
  // Use mithril — corrosionResist should be >= 0.95
  const { player, armor } = spawnEquippedPlayer(world, { defense: 5 }, "mithril");
  const rm = spawnRustMonster(world);

  const events = [];
  world.on("proc:corroded", (e) => events.push(e));

  const hooks = getMonster("rust_monster").hooks.onHit;

  // Run many steps — should never trigger
  for (let step = 0; step < 100; step++) {
    world.step = step;
    const ctx = new CombatCallbackContext(world, {
      attacker: rm,
      defender: player,
      damage: 3,
    });
    runCallbackList(hooks, ctx);
  }

  assertEquals(events.length, 0, "mithril item should never be corroded");
  const info = world.get(armor, ItemInfo);
  assertEquals(info.bonuses.defense, 5, "defense should be unchanged");
});
