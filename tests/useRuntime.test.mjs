import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createPlayer } from "../src/rules/archetypes/Player.js";
import { createCorpse } from "../src/rules/archetypes/Food.js";
import { buildCatalogItem } from "../src/rules/data/itemCatalogLoader.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { UseIntent } from "../src/rules/components/Intents/UseIntent.js";
import { CastSpellIntent } from "../src/rules/components/Intents/CastSpellIntent.js";
import { useItemSystem } from "../src/rules/systems/useItemSystem.js";
import { castSpellSystem } from "../src/rules/systems/castSpellSystem.js";
import { channelingSystem, installFishingCastRequestListener } from "../src/rules/systems/channelingSystem.js";
import { addToInventory } from "../src/rules/utils/inventoryFacade.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Channeling } from "../src/rules/components/Channeling.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { Position } from "../src/rules/components/Position.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { clearAll, loadChunk, setTile } from "../src/rules/environment/dungeon/tileMap.js";
import { CHUNK_SIZE, TILE_FLOOR, TILE_WATER } from "../src/rules/environment/dungeon/constants.js";
import { inventoryItems } from "../src/rules/utils/inventoryFacade.js";
import { installContentAbilityHandler } from "../src/content/abilityHandler.js";
import "../src/content/items/fishingRod.js";
import { installContent } from "../src/content/install.js";
installContent();

function installFishingAbilityRuntime(world, actor) {
  installFishingCastRequestListener(world);
  installContentAbilityHandler({
    world,
    targeting: { openEnemyTargeting() {} },
    playerEntity: () => ({ id: actor, pos: world.get(actor, Position) }),
    scanVisibleEnemies: () => [],
  });
}

Deno.test("use runtime resolves wand payload object and consumes one charge", () => {
  const world = new World({ seed: 3301 });
  const actor = createPlayer(world, { x: 0, y: 0, name: "Caster" });
  const wand = buildCatalogItem(world, "wand_lightning");
  addToInventory(world, actor, wand);

  const results = [];
  world.on("interaction:result", (ev) => results.push(ev));

  world.add(actor, UseIntent, { itemId: wand, targetId: actor });
  useItemSystem(world);

  assertEquals(results.length, 1);
  assertEquals(results[0].verb, "use");
  assertEquals(results[0].ok, true);
  assertEquals(results[0].metrics.path, "itemHooks");
  assertEquals(results[0].metrics.payloadMatched, true);

  const info = world.get(wand, ItemInfo);
  assert(info && Number(info.count) === 2, "wand should lose one charge");
});

Deno.test("use runtime resolves corpse consumable payload object and can cancel", () => {
  const world = new World({ seed: 3302 });
  const actor = createPlayer(world, { x: 0, y: 0, name: "Hero" });

  const corpse = createCorpse(world, {
    id: "test_cancel",
    name: "Cursed Meal",
    sizeClass: "S",
    massKg: 5,
    tier: 0,
  }, { x: 0, y: 0 });
  addToInventory(world, actor, corpse);

  const results = [];
  world.on("interaction:result", (ev) => results.push(ev));

  world.add(actor, UseIntent, { itemId: corpse, targetId: actor });
  useItemSystem(world);

  assertEquals(results.length, 1);
  assertEquals(results[0].verb, "use");
  assertEquals(results[0].metrics.path, "matcher");
  assertEquals(results[0].metrics.payloadMatched, true);
  assertEquals(results[0].canceled, true, "cursed meal should cancel through payload hooks");
});

Deno.test("equipped fishing rod use channels and catches a fish", () => {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
  setTile(1, 0, TILE_WATER);

  const world = new World({ seed: 3310 });
  world.rand = () => 0.1;
  const actor = createPlayer(world, { x: 0, y: 0, name: "Angler" });
  installFishingAbilityRuntime(world, actor);
  if (!world.has(actor, Inventory)) world.add(actor, Inventory, { capacity: 20 });
  if (!world.has(actor, Equipment)) world.add(actor, Equipment, {});

  const rod = buildCatalogItem(world, "fishing_rod");
  addToInventory(world, actor, rod);
  world.set(actor, Equipment, { ...world.get(actor, Equipment), weapon: rod });

  const events = [];
  world.on("fishing:caught", (ev) => events.push(ev));

  world.add(actor, UseIntent, { itemId: rod });
  useItemSystem(world);

  assert(world.has(actor, Channeling), "fishing should start a channel");
  for (let i = 0; i < 4; i++) channelingSystem(world);

  assertEquals(world.has(actor, Channeling), false, "fishing channel should complete");
  assertEquals(events.length, 1);
  const fishCount = inventoryItems(world, actor).filter((itemId) =>
    String(world.get(itemId, NamedIdentity)?.identity || "") === "food_raw_fish"
  ).length;
  assertEquals(fishCount, 1);
});

Deno.test("fishing is a targeted channeled spell that requires water", () => {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
  setTile(2, 0, TILE_WATER);

  const world = new World({ seed: 3312 });
  world.rand = () => 0.1;
  const actor = createPlayer(world, { x: 0, y: 0, name: "Angler" });
  if (!world.has(actor, Inventory)) world.add(actor, Inventory, { capacity: 20 });
  if (!world.has(actor, Equipment)) world.add(actor, Equipment, {});

  const rod = buildCatalogItem(world, "fishing_rod");
  addToInventory(world, actor, rod);
  world.set(actor, Equipment, { ...world.get(actor, Equipment), weapon: rod });

  const casts = [];
  const caught = [];
  world.on("fishing:cast", (ev) => casts.push(ev));
  world.on("fishing:caught", (ev) => caught.push(ev));

  world.add(actor, CastSpellIntent, { spellId: "fishing", targetId: actor, x: 2, y: 0 });
  castSpellSystem(world);

  assert(world.has(actor, Channeling), "fishing spell should start a channel");
  assertEquals(casts[0]?.x, 2);
  assertEquals(casts[0]?.y, 0);

  for (let i = 0; i < 4; i++) channelingSystem(world);

  assertEquals(world.has(actor, Channeling), false, "fishing spell channel should complete");
  assertEquals(caught.length, 1);
  const fishCount = inventoryItems(world, actor).filter((itemId) =>
    String(world.get(itemId, NamedIdentity)?.identity || "") === "food_raw_fish"
  ).length;
  assertEquals(fishCount, 1);
});

Deno.test("fishing spell refuses non-water tiles", () => {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);

  const world = new World({ seed: 3313 });
  const actor = createPlayer(world, { x: 0, y: 0, name: "Angler" });
  if (!world.has(actor, Inventory)) world.add(actor, Inventory, { capacity: 20 });
  if (!world.has(actor, Equipment)) world.add(actor, Equipment, {});

  const rod = buildCatalogItem(world, "fishing_rod");
  addToInventory(world, actor, rod);
  world.set(actor, Equipment, { ...world.get(actor, Equipment), weapon: rod });

  const cancelled = [];
  world.on("item:use-cancelled", (ev) => cancelled.push(ev));

  world.add(actor, CastSpellIntent, { spellId: "fishing", targetId: actor, x: 1, y: 0 });
  castSpellSystem(world);

  assertEquals(world.has(actor, Channeling), false);
  assertEquals(cancelled[0]?.code, "FISHING_NO_WATER_TARGET");
});

Deno.test("fishing rod use requires the rod to be equipped", () => {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
  setTile(1, 0, TILE_WATER);

  const world = new World({ seed: 3311 });
  const actor = createPlayer(world, { x: 0, y: 0, name: "Angler" });
  installFishingAbilityRuntime(world, actor);
  const rod = buildCatalogItem(world, "fishing_rod");
  addToInventory(world, actor, rod);

  const cancelled = [];
  world.on("item:use-cancelled", (ev) => cancelled.push(ev));

  world.add(actor, UseIntent, { itemId: rod });
  useItemSystem(world);

  assertEquals(world.has(actor, Channeling), false);
  assertEquals(cancelled[0]?.code, "FISHING_ROD_NOT_EQUIPPED");
});
