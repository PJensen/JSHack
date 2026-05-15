// rules/data/monsters.js
// Central monster definitions. Each entry feeds into pickMonster() for spawning
// and the Monster archetype for ECS creation.
//
// All combat behavior lives here on the monster it governs — callbacks are
// plain (ctx) => void functions invoked via runCallbackList.
import {
  statusEffectOnHit,
  selfBuffOnHit,
  drainOnHit,
  bonusDamageOnBeforeHit,
  bonusDamageIfTargetAfflicted,
  drainAndWeakenOnHit,
  healOnDamaged,
  retaliateOnDamaged,
  statusEffectOnDamaged,
  phaseOutOnDamaged,
  sandBurrowOnDamaged,
  mindflayerBlastOnHit,
  corrodeEquipmentOnHit,
  stealAndBlinkOnHit,
  typedDamageOnHit,
  spillLootAndShortBlinkOnDamaged,
  burrowAndDieOnHit,
  slimedOnHit,
} from "./callbacks/combat.js";
import { selfThrowNearTargetOnSeen, gazeOnLOS, fireBreathLineOnLOS, castSpellOnLOS } from "./callbacks/ai.js";
import { spawnPlasmaCloudOnDeath, centipedeSplitOnDeath, spawnFirePuffOnDeath, gasSporeExplodeOnDeath } from "./callbacks/death.js";

export const MONSTERS = [
];


// Global monster vitality scalar used by all depth-scaled spawn pathways.
// Tune this to raise/lower overall monster durability without per-monster edits.
export const MONSTER_HP_SCALAR = 1.0;

/** Lookup helpers */
const _byId = new Map(MONSTERS.map(m => [m.id, m]));
const _byTier = [];
for (const m of MONSTERS) {
  if (!m.rare && !m.disabled) (_byTier[m.tier] ??= []).push(m);
}

/** Genocide registry — tracks monster IDs permanently removed from the game. */
const _genocided = new Set();

/** @param {string} id */
export function addGenocide(id) { _genocided.add(id); }

/** @param {string} id @returns {boolean} */
export function isGenocided(id) { return _genocided.has(id); }

/** @returns {string[]} */
export function getAllGenocided() { return [..._genocided]; }

export function clearGenocides() { _genocided.clear(); }

/** @param {number} tier @returns {MonsterDef[]} */
export function getMonstersByTier(tier) {
  const pool = _byTier[Math.min(tier, _byTier.length - 1)] || _byTier[_byTier.length - 1];
  if (_genocided.size === 0) return pool;
  return pool.filter(m => !_genocided.has(m.id));
}

/** @param {string} id @returns {MonsterDef|null} */
export function getMonster(id) {
  return _byId.get(id) || null;
}

/**
 * Resolve scaled monster max HP at a given dungeon depth.
 * @param {string|MonsterDef|null|undefined} monster
 * @param {number} depth
 * @returns {number}
 */
export function resolveMonsterMaxHp(monster, depth = 1) {
  const def = typeof monster === "string" ? getMonster(monster) : (monster || null);
  if (!def) return 1;
  const d = Math.max(1, Number(depth || 1) | 0);
  const baseHp = Number(def.baseHp || 1);
  const hpPerLevel = Number(def.hpPerLevel || 0);
  const unscaled = baseHp + d * hpPerLevel;
  return Math.max(1, Math.floor(unscaled * MONSTER_HP_SCALAR));
}

/** @returns {string[]} */
export function listAllMonsterIds() {
  return [..._byId.keys()].sort();
}

/** @returns {MonsterDef[]} */
export function getAllMonsters() {
  return [..._byId.values()];
}

/** @param {MonsterDef} def @returns {string} loot table ID */
export function getMonsterLootTable(def) {
  if (def.lootTable) return def.lootTable;
  const tags = def.tags || [];
  // Tag priority: caster > venomous > beast > humanoid > undead > tier fallback
  if (tags.includes('caster'))   return 'drop:caster';
  if (tags.includes('venomous')) return 'drop:venomous';
  if (tags.includes('beast'))    return 'drop:beast';
  if (tags.includes('humanoid')) return 'drop:humanoid';
  if (tags.includes('undead'))   return 'drop:undead';
  return `drop:tier${def.tier}`;
}

/**
 * Check whether a monster (by id) carries a given tag.
 * @param {string} monsterId
 * @param {string} tag
 * @returns {boolean}
 */
export function monsterHasTag(monsterId, tag) {
  const def = _byId.get(monsterId);
  if (!def || !Array.isArray(def.tags)) return false;
  return def.tags.includes(tag);
}

/**
 * Return all tags for a monster id, or empty array.
 * @param {string} monsterId
 * @returns {string[]}
 */
export function getMonsterTags(monsterId) {
  const def = _byId.get(monsterId);
  return Array.isArray(def?.tags) ? def.tags : [];
}

/**
 * Register a content-DSL monster into the monster registry at runtime.
 * @param {MonsterDef} def
 */
export function registerMonsterDef(def) {
  if (!def || !def.id) return;
  if (_byId.has(def.id)) return; // already present, skip
  _byId.set(def.id, def);
  if (!def.rare && !def.disabled) {
    (_byTier[def.tier] ??= []).push(def);
  }
}

/** @typedef {{ id:string, name:string, tags?:string[], tier:number, intelligence?:number, visionRange?:number, fovConeDegrees?:number, baseHp:number, hpPerLevel:number, attack:number, defense:number, damageDice:string, sizeClass:string, massKg:number, resistances:Object, speed:number, hooks?:Record<string, Function[]>|null, specials?:string[], description:string, lootTable?:string, corpseDropChance?:number, sleep?:string|{pattern?:string,context?:string,chance?:number}, equipment?:{ranged?:string, ammo?:string}|null, wielding?:Array<string|{itemId?:string,id?:string,affixes?:string[],count?:number,slot?:string}>, equipped?:Array<string|{itemId?:string,id?:string,affixes?:string[],count?:number,slot?:string}>, inventory?:Array<string|{itemId?:string,id?:string,affixes?:string[],count?:number,slot?:string}>, learnedSpellIds?:string[], maxMana?:number, manaRegen?:number }} MonsterDef */
