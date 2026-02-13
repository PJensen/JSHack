import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Consumable } from "../components/Consumable.js";
import { Position } from "../components/Position.js";
import { Hunger } from "../components/Hunger.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { Vitality } from "../components/Vitality.js";
import {
  RATION_NUTRITION,
  IRON_RATION_NUTRITION,
  CORPSE_EFFECTS,
  CORPSE_WEIGHT,
  computeCorpseNutrition,
} from "../data/food.js";

/**
 * makeEatEffect — creates a useEffect closure for food Consumables.
 * Reduces the actor's Hunger.hunger by the given nutrition value.
 * If hunger goes below 0, the surplus becomes satiation turns (capped at 200).
 * Applies special effects for monster corpses (poison, disease, etc.)
 *
 * @param {number} nutrition - how much hunger to reduce
 * @param {string|null} [special=null] - special effect key from CORPSE_EFFECTS
 * @returns {(world: any, actor: number, itemId: number) => void}
 */
function makeEatEffect(nutrition, special = null) {
  return function eatEffect(world, actor, _itemId) {
    const hc = world.get(actor, Hunger);
    if (!hc) return;

    // Reduce hunger, convert surplus to satiation
    const newHunger = hc.hunger - nutrition;
    if (newHunger < 0) {
      hc.satiation = Math.min(hc.satiation + Math.abs(newHunger), 200);
      hc.hunger = 0;
    } else {
      hc.hunger = newHunger;
    }

    try {
      world.emit && world.emit('hunger:ate', {
        actor, nutrition, newHunger: hc.hunger, satiation: hc.satiation,
      });
    } catch { /* */ }

    // Apply special corpse effects
    if (!special) return;

    let ae = world.get(actor, ActiveEffects);
    if (!ae) {
      try { world.add(actor, ActiveEffects, { effects: [] }); ae = world.get(actor, ActiveEffects); } catch { /* */ }
    }
    if (!ae) return;

    switch (special) {
      case 'poison':
        ae.effects.push({ key: 'poison', turnsLeft: 8, potency: 2, stacks: 1, sourceId: actor });
        try { world.emit && world.emit('hunger:sickened', { actor, type: 'poison' }); } catch { /* */ }
        break;
      case 'disease':
        ae.effects.push({ key: 'disease', turnsLeft: 20, potency: 1, stacks: 1, sourceId: actor });
        try { world.emit && world.emit('hunger:sickened', { actor, type: 'disease' }); } catch { /* */ }
        break;
      case 'shock': {
        const vit = world.get(actor, Vitality);
        if (vit) {
          const dmg = 3;
          vit.hp = Math.max(0, vit.hp - dmg);
          try { world.emit && world.emit('damage', { id: actor, amount: dmg, source: 'corpse' }); } catch { /* */ }
        }
        break;
      }
      case 'mindwipe':
        ae.effects.push({ key: 'mindwipe', turnsLeft: 15, potency: 1, stacks: 1, sourceId: actor });
        try { world.emit && world.emit('hunger:sickened', { actor, type: 'mindwipe' }); } catch { /* */ }
        break;
      case 'hallucination':
        ae.effects.push({ key: 'mindwipe', turnsLeft: 30, potency: 2, stacks: 1, sourceId: actor });
        try { world.emit && world.emit('hunger:sickened', { actor, type: 'hallucination' }); } catch { /* */ }
        break;
    }
  };
}

// Standard Ration archetype
export const Ration = defineArchetype(
  "Ration",
  [Consumable, {
    useEffect: makeEatEffect(RATION_NUTRITION, null),
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
    useEffect: makeEatEffect(IRON_RATION_NUTRITION, null),
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
  const special = CORPSE_EFFECTS[monsterDef.id] || null;
  const weight = CORPSE_WEIGHT[monsterDef.sizeClass] || 3;

  const id = world.create();

  world.add(id, Consumable, {
    useEffect: makeEatEffect(nutrition, special),
    remainingUses: 1,
    potency: 0,
  });

  world.add(id, ItemInfo, {
    type: "food",
    weight,
    value: Math.max(1, Math.floor(nutrition / 20)),
    description: `The remains of a ${monsterDef.name}. ${special ? 'Looks questionable.' : 'Looks edible.'}`,
    count: 1,
  });

  world.add(id, NamedIdentity, {
    name: `${monsterDef.name} Corpse`,
    identity: `corpse_${monsterDef.id}`,
  });

  world.add(id, Position, { x: pos.x, y: pos.y });

  return id;
}
