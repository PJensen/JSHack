import { creatureTypeFromTags } from "../components/CreatureType.js";
import { resolveMonsterMaxHp } from "../data/monsters.js";

/**
 * Convert a monster definition into canonical spawn-time params.
 * @param {import('../data/monsters.js').MonsterDef} def
 * @param {number} depth
 */
export function toMonsterSpawnParams(def, depth) {
  return {
    name: def.name,
    identity: def.id,
    maxHp: resolveMonsterMaxHp(def, depth),
    faction: def.faction || "enemy",
    solid: def.solid ?? true,
    blocksSight: def.blocksSight ?? false,
    accuracyDerived: def.attack,
    damagePowerDerived: def.attack,
    evadeDerived: def.defense,
    naturalDamageDice: def.damageDice,
    sizeClass: def.sizeClass,
    massKg: def.massKg,
    resistances: def.resistances,
    speed: def.speed,
    equipment: def.equipment || null,
    wielding: Array.isArray(def.wielding) ? [...def.wielding] : [],
    equipped: Array.isArray(def.equipped) ? [...def.equipped] : [],
    inventory: Array.isArray(def.inventory) ? [...def.inventory] : [],
    learnedSpellIds: Array.isArray(def.learnedSpellIds) ? [...def.learnedSpellIds] : [],
    maxMana: Number.isFinite(def.maxMana) ? Number(def.maxMana) : 0,
    manaRegen: Number.isFinite(def.manaRegen) ? Number(def.manaRegen) : 0,
    creatureType: creatureTypeFromTags(def.tags || []),
    sleep: typeof def.sleep === "string"
      ? def.sleep
      : (def.sleep && typeof def.sleep === "object" ? { ...def.sleep } : null),
  };
}
