// tests/itemDestruction.test.mjs
// NetHack-style item destruction: elemental damage destroys vulnerable inventory
// items (fire→scrolls/potions, cold→potions, electric→wands).
// Resistance rings provide full protection. Equipped items are exempt.

import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { Player } from "../src/rules/components/Player.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { Material } from "../src/rules/components/Material.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Resistances } from "../src/rules/components/Resistences.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { addToInventory } from "../src/rules/utils/inventoryFacade.js";
import { itemDamageReactionSystem } from "../src/rules/systems/damageReactions/itemDamageReactionSystem.js";
import { dealDamage } from "../src/rules/utils/dealDamage.js";
import { clearAll, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";

function makeWorld(seed = 1) {
  clearAll();
  loadChunk(0, 0, new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR));
  const w = new World({ seed });
  return w;
}

function applyDamageReactions(world) {
  itemDamageReactionSystem(world);
}

function placePlayer(world, x = 5, y = 5) {
  const id = world.create();
  world.add(id, Player);
  world.add(id, Position, { x, y });
  world.add(id, Vitality, { maxHp: 100, hp: 100 });
  world.add(id, Inventory, { capacity: 20 });
  world.add(id, Equipment);
  world.add(id, Resistances);
  world.add(id, ActiveEffects, { effects: [] });
  return id;
}

function addScroll(world, ownerId, name = "Scroll of Fire") {
  const id = world.create();
  world.add(id, ItemInfo, { type: "scroll", slot: "bag", weight: 0.1, value: 10, count: 1 });
  world.add(id, Material, { kind: "paper" });
  world.add(id, NamedIdentity, { name, identity: "scroll_fire" });
  addToInventory(world, ownerId, id, { mergeCompatible: false });
  return id;
}

function addPotion(world, ownerId, name = "Potion of Healing") {
  const id = world.create();
  world.add(id, ItemInfo, { type: "potion", slot: "bag", weight: 0.3, value: 20, count: 1 });
  world.add(id, Material, { kind: "glass" });
  world.add(id, NamedIdentity, { name, identity: "potion_heal" });
  addToInventory(world, ownerId, id, { mergeCompatible: false });
  return id;
}

function addWand(world, ownerId, name = "Wand of Lightning") {
  const id = world.create();
  world.add(id, ItemInfo, { type: "wand", slot: "bag", weight: 0.2, value: 50, count: 1 });
  world.add(id, Material, { kind: "wood" });
  world.add(id, NamedIdentity, { name, identity: "wand_lightning" });
  addToInventory(world, ownerId, id, { mergeCompatible: false });
  return id;
}

function addRing(world, ownerId, ringId, bonuses) {
  const id = world.create();
  world.add(id, ItemInfo, { type: "equip", slot: "ring", weight: 0.05, value: 30, count: 1, bonuses });
  world.add(id, Material, { kind: "gold" });
  world.add(id, NamedIdentity, { name: ringId, identity: ringId });
  addToInventory(world, ownerId, id, { mergeCompatible: false });
  return id;
}

/** Override world.rand to always return a fixed value. */
function fixRng(world, value) {
  world.rand = () => value;
}

function isJunk(world, itemId) {
  const info = world.get(itemId, ItemInfo);
  return info?.type === "junk";
}

function identity(world, itemId) {
  return world.get(itemId, NamedIdentity)?.identity || "";
}

// ── Fire destroys scrolls ────────────────────────────────────────

Deno.test("fire damage destroys scrolls (paper → ash)", () => {
  const world = makeWorld(10);
  const player = placePlayer(world);
  const scroll = addScroll(world, player);
  fixRng(world, 0); // always triggers

  dealDamage(world, { target: player, amount: 5, type: "fire", source: 0 });
  applyDamageReactions(world);

  assertEquals(identity(world, scroll), "ash", "scroll should become ash");
  assert(isJunk(world, scroll), "scroll should be junk after burning");
});

Deno.test("fire damage destroys potions (glass → shatter)", () => {
  const world = makeWorld(11);
  const player = placePlayer(world);
  const potion = addPotion(world, player);
  fixRng(world, 0);

  dealDamage(world, { target: player, amount: 5, type: "fire", source: 0 });
  applyDamageReactions(world);

  assertEquals(identity(world, potion), "glass_shards", "potion should become glass shards");
  assert(isJunk(world, potion), "potion should be junk after shattering");
});

// ── Cold destroys potions ────────────────────────────────────────

Deno.test("cold damage destroys potions (glass → shatter)", () => {
  const world = makeWorld(12);
  const player = placePlayer(world);
  const potion = addPotion(world, player);
  fixRng(world, 0);

  dealDamage(world, { target: player, amount: 5, type: "cold", source: 0 });
  applyDamageReactions(world);

  assertEquals(identity(world, potion), "glass_shards", "potion should shatter from cold");
});

Deno.test("cold damage does NOT destroy scrolls", () => {
  const world = makeWorld(13);
  const player = placePlayer(world);
  const scroll = addScroll(world, player);
  fixRng(world, 0);

  dealDamage(world, { target: player, amount: 5, type: "cold", source: 0 });
  applyDamageReactions(world);

  assertEquals(identity(world, scroll), "scroll_fire", "scroll should be untouched by cold");
});

// ── Electric destroys wands ──────────────────────────────────────

Deno.test("electric damage destroys wands", () => {
  const world = makeWorld(14);
  const player = placePlayer(world);
  const wand = addWand(world, player);
  fixRng(world, 0);

  dealDamage(world, { target: player, amount: 5, type: "electric", source: 0 });
  applyDamageReactions(world);

  assertEquals(identity(world, wand), "glass_shards", "wand should shatter from electric");
  assert(isJunk(world, wand), "wand should be junk after shattering");
});

Deno.test("electric damage does NOT destroy scrolls or potions", () => {
  const world = makeWorld(15);
  const player = placePlayer(world);
  const scroll = addScroll(world, player);
  const potion = addPotion(world, player);
  fixRng(world, 0);

  dealDamage(world, { target: player, amount: 5, type: "electric", source: 0 });
  applyDamageReactions(world);

  assertEquals(identity(world, scroll), "scroll_fire", "scroll untouched by electric");
  assertEquals(identity(world, potion), "potion_heal", "potion untouched by electric");
});

// ── Resistance rings protect items ───────────────────────────────

Deno.test("fire resist ring protects scrolls and potions", () => {
  const world = makeWorld(20);
  const player = placePlayer(world);
  const scroll = addScroll(world, player);
  const potion = addPotion(world, player);
  const ring = addRing(world, player, "ring_fire_resist", { fireResist: 0.3 });
  // Equip the ring
  const eq = world.get(player, Equipment);
  eq.ring1 = ring;
  fixRng(world, 0);

  dealDamage(world, { target: player, amount: 5, type: "fire", source: 0 });
  applyDamageReactions(world);

  assertEquals(identity(world, scroll), "scroll_fire", "scroll protected by fire resist ring");
  assertEquals(identity(world, potion), "potion_heal", "potion protected by fire resist ring");
});

Deno.test("cold resist ring protects potions", () => {
  const world = makeWorld(21);
  const player = placePlayer(world);
  const potion = addPotion(world, player);
  const ring = addRing(world, player, "ring_cold_resist", { coldResist: 0.3 });
  const eq = world.get(player, Equipment);
  eq.ring1 = ring;
  fixRng(world, 0);

  dealDamage(world, { target: player, amount: 5, type: "cold", source: 0 });
  applyDamageReactions(world);

  assertEquals(identity(world, potion), "potion_heal", "potion protected by cold resist ring");
});

Deno.test("shock resist ring protects wands", () => {
  const world = makeWorld(22);
  const player = placePlayer(world);
  const wand = addWand(world, player);
  const ring = addRing(world, player, "ring_shock_resist", { electricOhms: 500 });
  const eq = world.get(player, Equipment);
  eq.ring1 = ring;
  fixRng(world, 0);

  dealDamage(world, { target: player, amount: 5, type: "electric", source: 0 });
  applyDamageReactions(world);

  assertEquals(identity(world, wand), "wand_lightning", "wand protected by shock resist ring");
});

// ── Equipped items exempt ────────────────────────────────────────

Deno.test("equipped wand is NOT destroyed by electric damage", () => {
  const world = makeWorld(30);
  const player = placePlayer(world);
  const wand = addWand(world, player);
  // Pretend wand is in weapon slot
  const eq = world.get(player, Equipment);
  eq.weapon = wand;
  fixRng(world, 0);

  dealDamage(world, { target: player, amount: 5, type: "electric", source: 0 });
  applyDamageReactions(world);

  assertEquals(identity(world, wand), "wand_lightning", "equipped wand should survive");
});

// ── RNG gating (high rand = no destruction) ──────────────────────

Deno.test("high rand roll prevents item destruction", () => {
  const world = makeWorld(40);
  const player = placePlayer(world);
  const scroll = addScroll(world, player);
  fixRng(world, 0.99); // above 1/3 threshold

  dealDamage(world, { target: player, amount: 5, type: "fire", source: 0 });
  applyDamageReactions(world);

  assertEquals(identity(world, scroll), "scroll_fire", "scroll survives high rand roll");
});

// ── Physical damage does not destroy items ───────────────────────

Deno.test("physical damage does not destroy items", () => {
  const world = makeWorld(50);
  const player = placePlayer(world);
  const scroll = addScroll(world, player);
  const potion = addPotion(world, player);
  const wand = addWand(world, player);
  fixRng(world, 0);

  dealDamage(world, { target: player, amount: 5, type: "physical", source: 0 });
  applyDamageReactions(world);

  assertEquals(identity(world, scroll), "scroll_fire", "scroll untouched by physical");
  assertEquals(identity(world, potion), "potion_heal", "potion untouched by physical");
  assertEquals(identity(world, wand), "wand_lightning", "wand untouched by physical");
});

// ── Event emission ───────────────────────────────────────────────

Deno.test("item:destroyed:element event is emitted on destruction", () => {
  const world = makeWorld(60);
  const player = placePlayer(world);
  const scroll = addScroll(world, player, "Scroll of Identify");
  fixRng(world, 0);

  const events = [];
  world.on("item:destroyed:element", (ev) => events.push(ev));

  dealDamage(world, { target: player, amount: 5, type: "fire", source: 0 });
  applyDamageReactions(world);

  assertEquals(events.length >= 1, true, "should emit at least one destruction event");
  assertEquals(events[0].itemName, "Scroll of Identify");
  assertEquals(events[0].element, "fire");
  assertEquals(events[0].verb, "burns up");
});
