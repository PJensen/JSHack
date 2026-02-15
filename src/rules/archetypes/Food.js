import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Consumable } from "../components/Consumable.js";
import { Position } from "../components/Position.js";
import {
  RATION_NUTRITION,
  IRON_RATION_NUTRITION,
  CORPSE_WEIGHT,
  computeCorpseNutrition,
  getCorpseEatHooks,
} from "../data/food.js";

// Standard Ration archetype
export const Ration = defineArchetype(
  "Ration",
  [Consumable, {
    effectKey: 'consumable:eat',
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
);

// Iron Ration — premium, found in chests or shops
export const IronRation = defineArchetype(
  "IronRation",
  [Consumable, {
    effectKey: 'consumable:eat',
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
    effectKey: 'consumable:eat',
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

  return id;
}
