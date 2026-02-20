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
  CORPSE_WEIGHT,
  computeCorpseNutrition,
  getCorpseEatHooks,
} from "../data/food.js";

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
    effectParams: { nutrition: 120, special: null },
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
    effectParams: { nutrition: 70, special: null },
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
  const weight = CORPSE_WEIGHT[monsterDef.sizeClass] || 3;

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
