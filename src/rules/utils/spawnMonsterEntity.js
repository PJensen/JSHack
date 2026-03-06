import { createFrom } from "../../lib/ecs-js/archetype.js";
import { Monster } from "../archetypes/Creatures.js";

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
 *   attackDerived?: number,
 *   defenseDerived?: number,
 *   naturalDamageDice?: string,
 *   naturalScript?: string|null,
 *   sizeClass?: string,
 *   massKg?: number,
 *   resistances?: Record<string, unknown>,
 *   speed?: number,
 *   creatureType?: string,
 * }} params
 * @returns {number}
 */
export function spawnMonsterEntity(world, params = {}) {
  const p = (params && typeof params === "object") ? params : {};
  return createFrom(world, Monster, {
    x: Number.isFinite(p.x) ? (Number(p.x) | 0) : 0,
    y: Number.isFinite(p.y) ? (Number(p.y) | 0) : 0,
    name: p.name,
    identity: p.identity,
    maxHp: Number.isFinite(p.maxHp) ? (Number(p.maxHp) | 0) : undefined,
    hp: Number.isFinite(p.hp) ? (Number(p.hp) | 0) : undefined,
    faction: p.faction,
    attackDerived: Number.isFinite(p.attackDerived) ? Number(p.attackDerived) : undefined,
    defenseDerived: Number.isFinite(p.defenseDerived) ? Number(p.defenseDerived) : undefined,
    naturalDamageDice: p.naturalDamageDice,
    naturalScript: p.naturalScript ?? null,
    sizeClass: p.sizeClass,
    massKg: Number.isFinite(p.massKg) ? Number(p.massKg) : undefined,
    resistances: (p.resistances && typeof p.resistances === "object") ? { ...p.resistances } : undefined,
    speed: Number.isFinite(p.speed) ? Number(p.speed) : undefined,
    creatureType: p.creatureType,
  });
}
