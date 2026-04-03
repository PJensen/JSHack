import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Consumable } from "../components/Consumable.js";
import { Position } from "../components/Position.js";
import { FoodDecay } from "../components/FoodDecay.js";
import {
  RATION_NUTRITION,
  IRON_RATION_NUTRITION,
  SHELF_LIFE_RATION,
  SHELF_LIFE_CORPSE,
  corpseWeight,
} from "../data/food.js";
import {
  computeCorpseNutrition,
  getCorpseEatHooks,
} from "../data/corpseFood.js";

// Standard Ration archetype
export const Ration = defineArchetype(
  "Ration",
  [Consumable, {
    effectParams: { nutrition: RATION_NUTRITION, special: null },
    remainingUses: 1,
    potency: 0,
  }],
  [ItemInfo, {
    type: "food",
    description: "A dry but filling travel ration.",
    weight: 1,
    value: 10,
    count: 1,
  }],
  [NamedIdentity, /** @param {any} p */ (p) => ({ name: (p && p.name) ?? "Ration", identity: "food_ration" })],
  [FoodDecay, { turnsHeld: 0, shelfLife: SHELF_LIFE_RATION }],
);

// Iron Ration — premium, found in chests or shops
export const IronRation = defineArchetype(
  "IronRation",
  [Consumable, {
    effectParams: { nutrition: IRON_RATION_NUTRITION, special: null },
    remainingUses: 1,
    potency: 0,
  }],
  [ItemInfo, {
    type: "food",
    description: "A well-preserved military ration. Very filling.",
    weight: 1.5,
    value: 25,
    count: 1,
  }],
  [NamedIdentity, /** @param {any} p */ (p) => ({ name: (p && p.name) ?? "Iron Ration", identity: "food_iron_ration" })],
);

// Gathered from berry bushes in the overworld.
export const WildBerries = defineArchetype(
  "WildBerries",
  [Consumable, {
    effectParams: { nutrition: 150, special: null },
    remainingUses: 1,
    potency: 0,
  }],
  [ItemInfo, {
    type: "food",
    description: "A handful of sweet wild berries.",
    weight: 0.2,
    value: 4,
    count: 1,
  }],
  [NamedIdentity, (p) => ({ name: (p && p.name) ?? "Wild Berries", identity: "food_wild_berries" })],
  [FoodDecay, { turnsHeld: 0, shelfLife: Math.floor(SHELF_LIFE_RATION * 0.45) }],
);

// Gathered from herb patches in the overworld.
export const WildHerbs = defineArchetype(
  "WildHerbs",
  [Consumable, {
    effectParams: { nutrition: 90, special: null },
    remainingUses: 1,
    potency: 0,
  }],
  [ItemInfo, {
    type: "food",
    description: "Fresh herbs with a sharp, earthy bite.",
    weight: 0.15,
    value: 3,
    count: 1,
  }],
  [NamedIdentity, (p) => ({ name: (p && p.name) ?? "Wild Herbs", identity: "food_wild_herbs" })],
  [FoodDecay, { turnsHeld: 0, shelfLife: Math.floor(SHELF_LIFE_RATION * 0.40) }],
);

// Picked from dungeon mushroom patches.
export const DungeonMushrooms = defineArchetype(
  "DungeonMushrooms",
  [Consumable, {
    effectParams: { nutrition: 130, special: null },
    remainingUses: 1,
    potency: 0,
  }],
  [ItemInfo, {
    type: "food",
    description: "Pale mushrooms from the dungeon depths. Probably safe.",
    weight: 0.15,
    value: 3,
    count: 1,
  }],
  [NamedIdentity, (p) => ({ name: (p && p.name) ?? "Dungeon Mushrooms", identity: "food_mushrooms" })],
  [FoodDecay, { turnsHeld: 0, shelfLife: Math.floor(SHELF_LIFE_RATION * 0.35) }],
);

// Harvested from farm wheat crops.
export const Wheat = defineArchetype(
  "Wheat",
  [Consumable, {
    effectParams: { nutrition: 240, special: null },
    remainingUses: 1,
    potency: 0,
  }],
  [ItemInfo, {
    type: "food",
    description: "A sheaf of golden wheat. Can be cooked into bread.",
    weight: 0.3,
    value: 5,
    count: 1,
  }],
  [NamedIdentity, (p) => ({ name: (p && p.name) ?? "Wheat", identity: "food_wheat" })],
  [FoodDecay, { turnsHeld: 0, shelfLife: Math.floor(SHELF_LIFE_RATION * 0.8) }],
);

// Harvested from farm carrot crops.
export const Carrot = defineArchetype(
  "Carrot",
  [Consumable, {
    effectParams: { nutrition: 200, special: null },
    remainingUses: 1,
    potency: 0,
  }],
  [ItemInfo, {
    type: "food",
    description: "A fresh carrot, pulled straight from the soil.",
    weight: 0.4,
    value: 4,
    count: 1,
  }],
  [NamedIdentity, (p) => ({ name: (p && p.name) ?? "Carrot", identity: "food_carrot" })],
  [FoodDecay, { turnsHeld: 0, shelfLife: Math.floor(SHELF_LIFE_RATION * 0.6) }],
);

// Harvested from farm corn crops.
export const Corn = defineArchetype(
  "Corn",
  [Consumable, {
    effectParams: { nutrition: 300, special: null },
    remainingUses: 1,
    potency: 0,
  }],
  [ItemInfo, {
    type: "food",
    description: "An ear of golden corn.",
    weight: 1.0,
    value: 8,
    count: 1,
  }],
  [NamedIdentity, (p) => ({ name: (p && p.name) ?? "Corn", identity: "food_corn" })],
  [FoodDecay, { turnsHeld: 0, shelfLife: Math.floor(SHELF_LIFE_RATION * 0.7) }],
);

// Harvested from thorn brambles; used for alchemy recipes.
export const ThornPods = defineArchetype(
  "ThornPods",
  [ItemInfo, {
    type: "ingredient",
    description: "Hardened thorn pods packed with sharp resin.",
    weight: 0.2,
    value: 6,
    count: 1,
  }],
  [NamedIdentity, (p) => ({ name: (p && p.name) ?? "Thorn Pods", identity: "reagent_thorn_pod" })],
);

// Harvested from venom ferns; used for alchemy recipes.
export const VenomFronds = defineArchetype(
  "VenomFronds",
  [ItemInfo, {
    type: "ingredient",
    description: "Slick venom fronds that reek of bitter alkaloids.",
    weight: 0.2,
    value: 7,
    count: 1,
  }],
  [NamedIdentity, (p) => ({ name: (p && p.name) ?? "Venom Fronds", identity: "reagent_venom_frond" })],
);

// Gathered from moonleaf clusters; used for restorative and antidote brews.
export const Moonleaf = defineArchetype(
  "Moonleaf",
  [ItemInfo, {
    type: "ingredient",
    description: "Cool silver leaves prized by apothecaries for calming infusions.",
    weight: 0.15,
    value: 8,
    count: 1,
  }],
  [NamedIdentity, (p) => ({ name: (p && p.name) ?? "Moonleaf", identity: "reagent_moonleaf" })],
);

// Dug from hot red roots; used for vigor and fireproofing brews.
export const EmberRoot = defineArchetype(
  "EmberRoot",
  [ItemInfo, {
    type: "ingredient",
    description: "A fibrous root that holds a dry, peppery heat.",
    weight: 0.2,
    value: 8,
    count: 1,
  }],
  [NamedIdentity, (p) => ({ name: (p && p.name) ?? "Ember Root", identity: "reagent_ember_root" })],
);

// Mined from iron ore veins in the overworld.
export const IronOre = defineArchetype(
  "IronOre",
  [ItemInfo, {
    type: "material",
    description: "A chunk of raw iron ore, heavy and rust-red.",
    weight: 2.0,
    value: 12,
    count: 1,
  }],
  [NamedIdentity, (p) => ({ name: (p && p.name) ?? "Iron Ore", identity: "ore_iron" })],
);

// Mined from coal seams in the overworld.
export const CoalOre = defineArchetype(
  "CoalOre",
  [ItemInfo, {
    type: "material",
    description: "A lump of coal, black and crumbly.",
    weight: 1.5,
    value: 6,
    count: 1,
  }],
  [NamedIdentity, (p) => ({ name: (p && p.name) ?? "Coal", identity: "ore_coal" })],
);

// Chipped from stone outcroppings in the overworld.
export const StoneChip = defineArchetype(
  "StoneChip",
  [ItemInfo, {
    type: "material",
    description: "A rough chip of grey stone.",
    weight: 1.0,
    value: 2,
    count: 1,
  }],
  [NamedIdentity, (p) => ({ name: (p && p.name) ?? "Stone Chip", identity: "ore_stone" })],
);

/**
 * createCorpse — creates a corpse entity from a killed monster.
 * Called from cleanupSystem when a monster dies.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {{ id: string, name: string, sizeClass: string, massKg: number, tier?: number }} monsterDef
 * @param {{ x: number, y: number }} pos
 * @returns {number} entity id of the created corpse
 */
export function createCorpse(world, monsterDef, pos) {
  const nutrition = computeCorpseNutrition(monsterDef);
  const corpseIdentity = `corpse_${String(monsterDef.id || "").toLowerCase()}`;
  const onEat = getCorpseEatHooks(corpseIdentity);
  const hasSpecialProc = onEat.length > 0;
  const weight = corpseWeight(monsterDef);

  const id = world.create();

  world.add(id, Consumable, {
    effectParams: { nutrition, corpseIdentity },
    remainingUses: 1,
    potency: 0,
  });

  world.add(id, ItemInfo, {
    type: "food",
    weight,
    value: Math.max(1, Math.floor(nutrition / 20)),
    description: `The remains of a ${monsterDef.name}. ${hasSpecialProc ? 'Looks questionable.' : 'Looks edible.'}`,
    count: 1,
  });

  world.add(id, NamedIdentity, {
    name: `${monsterDef.name} Corpse`,
    identity: corpseIdentity,
  });

  world.add(id, Position, { x: pos.x, y: pos.y });
  world.add(id, FoodDecay, { turnsHeld: 0, shelfLife: SHELF_LIFE_CORPSE });

  return id;
}
