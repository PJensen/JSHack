import { createFrom } from "../../lib/ecs-js/archetype.js";
import { Monster } from "../archetypes/Creatures.js";
import { Mana } from "../components/Mana.js";

/**
 * Canonical monster entity construction shared by debug spawning, dungeon
 * materialization, and runtime spawners.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {{
 *   x?: number,
 *   y?: number,
 *   name?: string,
 *   identity?: string,
 *   maxHp?: number,
 *   hp?: number,
 *   faction?: string,
 *   accuracyDerived?: number,
 *   damagePowerDerived?: number,
 *   evadeDerived?: number,
 *   naturalDamageDice?: string,
 *   naturalScript?: string|null,
 *   sizeClass?: string,
 *   massKg?: number,
 *   resistances?: Record<string, unknown>,
 *   speed?: number,
 *   creatureType?: string,
 *   learnedSpellIds?: string[],
 *   maxMana?: number,
 *   mana?: number,
 *   manaRegen?: number,
 * }} params
 * @returns {number}
 */
export function spawnMonsterEntity(world, params = {}) {
  const p = (params && typeof params === "object") ? params : {};
  const id = createFrom(world, Monster, {
    x: Number.isFinite(p.x) ? (Number(p.x) | 0) : 0,
    y: Number.isFinite(p.y) ? (Number(p.y) | 0) : 0,
    name: p.name,
    identity: p.identity,
    maxHp: Number.isFinite(p.maxHp) ? (Number(p.maxHp) | 0) : undefined,
    hp: Number.isFinite(p.hp) ? (Number(p.hp) | 0) : undefined,
    faction: p.faction,
    accuracyDerived: Number.isFinite(p.accuracyDerived)
      ? Number(p.accuracyDerived)
      : undefined,
    damagePowerDerived: Number.isFinite(p.damagePowerDerived)
      ? Number(p.damagePowerDerived)
      : undefined,
    evadeDerived: Number.isFinite(p.evadeDerived)
      ? Number(p.evadeDerived)
      : undefined,
    naturalDamageDice: p.naturalDamageDice,
    naturalScript: p.naturalScript ?? null,
    sizeClass: p.sizeClass,
    massKg: Number.isFinite(p.massKg) ? Number(p.massKg) : undefined,
    resistances: (p.resistances && typeof p.resistances === "object") ? { ...p.resistances } : undefined,
    speed: Number.isFinite(p.speed) ? Number(p.speed) : undefined,
    creatureType: p.creatureType,
    learnedSpellIds: Array.isArray(p.learnedSpellIds) ? p.learnedSpellIds.slice() : undefined,
  });

  const maxMana = Number.isFinite(p.maxMana) ? Math.max(0, Number(p.maxMana) | 0) : 0;
  if (maxMana > 0) {
    const mana = Number.isFinite(p.mana) ? (Number(p.mana) | 0) : maxMana;
    const manaRegen = Number.isFinite(p.manaRegen) ? Number(p.manaRegen) : 0.1;
    try {
      world.add(id, Mana, {
        maxMana,
        mana: Math.max(0, Math.min(maxMana, mana)),
        manaRegen,
        regenCooldown: 0,
      });
    } catch {}
  }

  return id;
}
