import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { configureWorld } from "../src/main/scheduler.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Brain } from "../src/rules/components/Brain.js";
import { Mana } from "../src/rules/components/Mana.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { MoveIntent } from "../src/rules/components/Intents/MoveIntent.js";
import { CastSpellIntent } from "../src/rules/components/Intents/CastSpellIntent.js";
import { RangedAttackIntent } from "../src/rules/components/Intents/RangedAttackIntent.js";
import { addToInventory } from "../src/rules/utils/inventoryFacade.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";
import { clearAll as clearTileMap, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";

function loadFlatFloor() {
  clearTileMap();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
}

function makeActor(world, { x, y, hp = 20, faction }) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Vitality, { maxHp: hp, hp });
  if (faction) world.add(id, Faction, { key: faction });
  return id;
}

function makeBow(world) {
  const id = world.create();
  world.add(id, ItemInfo, {
    type: "equip",
    slot: "ranged",
    weight: 1,
    value: 0,
    description: "Short Bow",
    count: 1,
    bonuses: { attack: 12 },
    rarity: 1,
    rarityName: "common",
    affixes: [],
    damageDice: "1d6",
    subtype: "bow",
    range: 8,
  });
  return id;
}

function makeAmmo(world, count = 10) {
  const id = world.create();
  world.add(id, ItemInfo, {
    type: "ammo",
    slot: "",
    weight: 0,
    value: 0,
    description: "Arrows",
    count,
    bonuses: {},
    rarity: 1,
    rarityName: "common",
    affixes: [],
  });
  return id;
}

Deno.test("scheduler: movement resolves before frost targeting", () => {
  loadFlatFloor();
  const world = new World({ seed: 21 });
  configureWorld(world);

  const caster = makeActor(world, { x: 0, y: 0, faction: "player" });
  world.add(caster, Brain, { learnedSpellIds: ["frost"], itemKnowledgeIdentities: [], seenTiles: new Uint8Array(), intelligence: 10, visionRange: 8 });
  world.add(caster, Mana, { mana: 50, maxMana: 50, manaRegen: 0.1, regenCooldown: 0 });

  const target = makeActor(world, { x: 10, y: 0, faction: "enemy" });
  world.add(target, MoveIntent, { dx: 1, dy: 0 });

  const events = [];
  world.on("spell:frost", (ev) => events.push(ev));

  world.add(caster, CastSpellIntent, { spellId: "frost" });
  world.tick(1);

  const pos = world.get(target, Position);
  assertEquals(pos.x, 11);
  assertEquals(pos.y, 0);
  assertEquals(world.get(target, Vitality).hp, 20, "target should step out of frost range before targeting resolves");
  assertEquals(events.length, 1);
  assertEquals(events[0].fizzle, true);
  assertEquals(events[0].targetId, caster);
});

Deno.test("scheduler: movement resolves before ranged attacks", () => {
  loadFlatFloor();
  const world = new World({ seed: 22 });
  configureWorld(world);

  const archer = makeActor(world, { x: 0, y: 0, faction: "player" });
  const bowId = makeBow(world);
  const ammoId = makeAmmo(world, 5);
  world.add(archer, Equipment, { ranged: bowId, ammo: ammoId, accuracyDerived: 12, damagePowerDerived: 12 });
  world.add(archer, Inventory, { capacity: 20 });
  addToInventory(world, archer, bowId);
  addToInventory(world, archer, ammoId);

  const target = makeActor(world, { x: 8, y: 0, faction: "enemy" });
  world.add(target, Equipment, { evadeDerived: 0 });
  world.add(target, MoveIntent, { dx: 1, dy: 0 });

  const outOfRange = [];
  const damaged = [];
  world.on("ranged:out-of-range", (ev) => outOfRange.push(ev));
  world.on("damaged", (ev) => damaged.push(ev));

  world.add(archer, RangedAttackIntent, { targetId: target, toX: 8, toY: 0 });
  world.tick(1);

  const pos = world.get(target, Position);
  assertEquals(pos.x, 9);
  assertEquals(pos.y, 0);
  assertEquals(outOfRange.length, 1, "target should step out of bow range before the shot resolves");
  assertEquals(damaged.length, 0, "no ranged hit should land after the target moved out of range");
  assertEquals(world.get(target, Vitality).hp, 20);
});
