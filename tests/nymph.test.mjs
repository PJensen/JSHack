// Nymph: item theft on hit, teleport away, cooldown, player-only targeting.

import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { getMonster } from "../src/rules/data/monsters.js";
import { CombatCallbackContext } from "../src/rules/data/callbacks/combat.js";
import { runCallbackList } from "../src/rules/interaction/dispatch.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Position } from "../src/rules/components/Position.js";
import { Player } from "../src/rules/components/Player.js";
import { Collider } from "../src/rules/components/Collider.js";
import { clearAll, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";
import { addToInventory } from "../src/rules/utils/inventoryFacade.js";

function makeWorld(seed = 1) {
  clearAll();
  loadChunk(0, 0, new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR));
  return new World({ seed });
}

function spawnPlayer(world) {
  const id = world.create();
  world.add(id, Player);
  world.add(id, Position, { x: 5, y: 5 });
  world.add(id, Vitality, { hp: 30, maxHp: 30 });
  world.add(id, Equipment, {});
  world.add(id, Inventory, { capacity: 20 });
  return id;
}

function spawnNymph(world) {
  const id = world.create();
  world.add(id, Position, { x: 6, y: 5 });
  world.add(id, Vitality, { hp: 12, maxHp: 12 });
  world.add(id, Inventory, { capacity: 20 });
  return id;
}

function createItem(world, name, identity, type = "armor", slot = "neck") {
  const id = world.create();
  world.add(id, ItemInfo, { type, slot, bonuses: { defense: 1 } });
  world.add(id, NamedIdentity, { name, identity });
  return id;
}

Deno.test("nymph: definition has steal onHit hook", () => {
  const def = getMonster("nymph");
  assert(def, "nymph should exist");
  assert(def.hooks?.onHit?.length > 0, "should have onHit hooks");
  assert(def.specials.includes("Steals items"), "specials should mention steal");
  assert(def.specials.includes("Teleports away"), "specials should mention teleport");
});

Deno.test("nymph: steals item from player on hit", () => {
  const world = makeWorld(42);
  const player = spawnPlayer(world);
  const nymph = spawnNymph(world);

  // Equip a ring on the player
  const ring = createItem(world, "Gold Ring", "gold_ring", "ring", "ring1");
  const eq = world.get(player, Equipment);
  eq.ring1 = ring;

  // Also add an inventory item
  const potion = createItem(world, "Health Potion", "health_potion", "potion", "");
  addToInventory(world, player, potion);

  const stoleEvents = [];
  const blinkEvents = [];
  world.on("nymph:stole", (e) => stoleEvents.push(e));
  world.on("nymph:blinked", (e) => blinkEvents.push(e));

  const hooks = getMonster("nymph").hooks.onHit;

  // Brute-force step to find one that triggers the 50% steal
  let triggered = false;
  for (let step = 0; step < 50; step++) {
    world.step = step;
    const ctx = new CombatCallbackContext(world, {
      attacker: nymph,
      defender: player,
      damage: 2,
    });
    runCallbackList(hooks, ctx);
    if (stoleEvents.length > 0) {
      triggered = true;
      break;
    }
  }

  assert(triggered, "nymph should steal within 50 steps");
  assertEquals(stoleEvents.length, 1, "should emit nymph:stole");
  assert(stoleEvents[0].itemName, "event should have itemName");

  // Nymph should also blink away after stealing
  assertEquals(blinkEvents.length, 1, "should emit nymph:blinked after steal");

  // Nymph position should have changed
  const nymphPos = world.get(nymph, Position);
  assert(nymphPos.x !== 6 || nymphPos.y !== 5, "nymph should have teleported");
});

Deno.test("nymph: cooldown prevents immediate re-steal", () => {
  const world = makeWorld(55);
  const player = spawnPlayer(world);
  const nymph = spawnNymph(world);

  // Give player multiple items to steal
  for (let i = 0; i < 5; i++) {
    const item = createItem(world, `Item ${i}`, `item_${i}`, "potion", "");
    addToInventory(world, player, item);
  }

  const stoleEvents = [];
  world.on("nymph:stole", (e) => stoleEvents.push(e));

  const hooks = getMonster("nymph").hooks.onHit;

  // First: trigger a steal
  let firstStealStep = -1;
  for (let step = 0; step < 50; step++) {
    world.step = step;
    const ctx = new CombatCallbackContext(world, {
      attacker: nymph,
      defender: player,
      damage: 2,
    });
    runCallbackList(hooks, ctx);
    if (stoleEvents.length === 1) {
      firstStealStep = step;
      break;
    }
  }
  assert(firstStealStep >= 0, "first steal should trigger");

  // Immediately try again on the next step — cooldown should block it
  // Reset nymph position to adjacent (blink moved it away)
  const nPos = world.get(nymph, Position);
  nPos.x = 6;
  nPos.y = 5;

  world.step = firstStealStep + 1;
  const ctx2 = new CombatCallbackContext(world, {
    attacker: nymph,
    defender: player,
    damage: 2,
  });
  runCallbackList(hooks, ctx2);
  assertEquals(stoleEvents.length, 1, "cooldown should block second steal");
});

Deno.test("nymph: does not steal from non-player entities", () => {
  const world = makeWorld(66);

  // Create a non-player defender (another monster)
  const other = world.create();
  world.add(other, Position, { x: 5, y: 5 });
  world.add(other, Vitality, { hp: 20, maxHp: 20 });
  world.add(other, Equipment, {});
  world.add(other, Inventory, { capacity: 20 });

  const item = createItem(world, "Shiny Gem", "gem", "gem", "");
  addToInventory(world, other, item);

  const nymph = spawnNymph(world);

  const stoleEvents = [];
  world.on("nymph:stole", (e) => stoleEvents.push(e));

  const hooks = getMonster("nymph").hooks.onHit;

  for (let step = 0; step < 100; step++) {
    world.step = step;
    const ctx = new CombatCallbackContext(world, {
      attacker: nymph,
      defender: other,
      damage: 2,
    });
    runCallbackList(hooks, ctx);
  }

  assertEquals(stoleEvents.length, 0, "should never steal from non-player");
});
