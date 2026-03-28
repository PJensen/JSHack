import { defineArchetype, withOverrides } from "../../lib/ecs-js/archetype.js";
import { Position } from "../components/Position.js";
import { Anatomy } from "../components/Anatomy.js";
import { buildHumanoidAnatomyUltraLite, buildHumanoidAnatomyLite, buildHumanoidAnatomyFull as buildHumanoidAnatomy } from "../components/Anatomy.js";
import { Resistances } from "../components/Resistences.js";
import { Physiology } from "../components/Physiology.js";
import { Faction } from "../components/Faction.js";
import { Alignment } from "../components/Alignment.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Collider } from "../components/Collider.js";
import { Inventory } from "../components/Inventory.js";
import { Equipment } from "../components/Equipment.js";
import { Brain } from "../components/Brain.js";
import { Wounds } from "../components/Wounds.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { Vitality } from "../components/Vitality.js";
import { Speed } from "../components/Speed.js";
import { Facing } from "../components/Facing.js";
import { Interactable } from "../components/Interactable.js";
import { ShopInventory } from "../components/ShopInventory.js";
import { AggroState, AGGRO_LEVELS } from "../components/AggroState.js";
import { SoundEmitter } from "../components/SoundEmitter.js";
import { CreatureType, CREATURE_TYPES } from "../components/CreatureType.js";
import { Encumbrance } from "../components/Encumbrance.js";
import { HEARING_SOURCE_DB } from "../components/Anatomy.js";
import { getMonster } from "../data/monsters.js";

/**
 * Consolidated creature archetypes
 * - Creature: baseline with broadly useful components and param-driven defaults
 * - Human:    Creature with humanoid anatomy and human-like defaults
 * - Monster:  Creature with hostile faction and slightly tougher defaults
 * - Other:    Creature for non-humanoids; anatomy defaults to none unless provided
 */

const defaultResist = {
  kinetic:   { DR: 0,  bluntMult: 1.0, slashMult: 1.0, pierceMult: 1.0 },
  thermal:   { igniteC: Infinity, burnMult: 1.0 },
  chemical:  { acidMult: 1.0, baseMult: 1.0, solventMult: 1.0, toxMult: 1.0 },
  electric:  { ohms: 0, fibrillationA: 0.03 },
  radiation: { alpha: 1.0, beta: 1.0, gamma: 1.0, neutron: 1.0 },
};

function resolveAnatomyParts(p) {
  // User may pass: anatomy.parts (explicit), anatomyKind, or humanoid=true
  const kind = p.anatomyKind || (p.humanoid ? "humanoid-ultralite" : null);
  if (p.anatomy && Array.isArray(p.anatomy.parts)) return p.anatomy.parts;
  switch (kind) {
    case "humanoid-ultralite": return buildHumanoidAnatomyUltraLite();
    case "humanoid-lite":      return buildHumanoidAnatomyLite();
    case "humanoid-full":      return buildHumanoidAnatomy();
    default:                    return [];
  }
}

function resolveBrainDefaults(p) {
  const input = (p && typeof p === "object") ? p : {};
  const identity = typeof input.identity === "string" ? input.identity : "";
  const def = identity ? getMonster(identity) : null;
  return {
    learnedSpellIds: Array.isArray(input.learnedSpellIds) ? [...input.learnedSpellIds] : [],
    itemKnowledgeIdentities: Array.isArray(input.itemKnowledgeIdentities) ? [...input.itemKnowledgeIdentities] : [],
    seenTiles: input.seenTiles instanceof Uint8Array ? input.seenTiles.slice() : new Uint8Array(),
    intelligence: Number.isFinite(input.intelligence) ? Number(input.intelligence) : Number(def?.intelligence ?? 10),
    visionRange: Number.isFinite(input.visionRange) ? Number(input.visionRange) : Number(def?.visionRange ?? 8),
    fovConeDegrees: Number.isFinite(input.fovConeDegrees)
      ? Number(input.fovConeDegrees)
      : (Number.isFinite(def?.fovConeDegrees) ? Number(def.fovConeDegrees) : null),
  };
}

export const Creature = defineArchetype(
  "Creature",
  // Spatial (optional via params; defaults to 0,0)
  [Position, (p) => ({ x: p.x ?? 0, y: p.y ?? 0 })],
  // Identity & grouping
  [NamedIdentity, (p) => ({ name: p.name ?? "Creature", identity: p.identity ?? (p.kind ?? "creature") })],
  [Faction, (p) => ({ key: p.faction ?? p.factionKey ?? "neutral" })],
  [Alignment, (p) => ({ lawChaos: p.lawChaos ?? "neutral", goodEvil: p.goodEvil ?? "neutral" })],
  // Body & durability
  [Anatomy, (p) => ({ parts: resolveAnatomyParts(p) })],
  [Physiology, (p) => ({
    sizeClass: p.sizeClass ?? "M",
    massKg: p.massKg ?? 80,
    kineticTriageDiv: p.kineticTriageDiv ?? 300,
    painMult: p.painMult ?? 1.0,
    bleedBaseMl: p.bleedBaseMl ?? 5000,
  })],
  [Resistances, (p) => ({
    kinetic:   { ...defaultResist.kinetic,   ...(p.resistances?.kinetic   ?? {}) },
    thermal:   { ...defaultResist.thermal,   ...(p.resistances?.thermal   ?? {}) },
    chemical:  { ...defaultResist.chemical,  ...(p.resistances?.chemical  ?? {}) },
    electric:  { ...defaultResist.electric,  ...(p.resistances?.electric  ?? {}) },
    radiation: { ...defaultResist.radiation, ...(p.resistances?.radiation ?? {}) },
  })],
  // Gameplay utility
  [Collider, (p) => ({ solid: p.solid ?? true, blocksSight: p.blocksSight ?? false })],
  [Inventory, (p) => ({ capacity: p.capacity ?? 0 })],
  [Equipment, (p) => ({
    weapon: p.weapon ?? null,
    armor: p.armor ?? null,
    ring1: p.ring1 ?? null,
    ring2: p.ring2 ?? null,
    accuracyDerived: p.accuracyDerived ?? 0,
    damagePowerDerived: p.damagePowerDerived ?? 0,
    evadeDerived: p.evadeDerived ?? 0,
    naturalDamageDice: p.naturalDamageDice ?? null,
    naturalScript: p.naturalScript ?? null,
    maxHpDerived: 0, critChanceDerived: 0, critMultDerived: 0,
  })],
  [Brain, (p) => resolveBrainDefaults(p)],
  [Wounds, { list: [] }],
  [ActiveEffects, { effects: [] }],
  [Vitality, (p) => ({ maxHp: p.maxHp ?? 10, hp: p.hp ?? (p.maxHp ?? 10) })],
  [Speed, (p) => ({ actEvery: Math.max(1, 4 - (p.speed ?? 1)) })],
  [Facing, { dx: 0, dy: 0 }],
  // Awareness: starts unaware; managed by aiChaseSystem + soundPropagationSystem.
  [AggroState, { alertLevel: AGGRO_LEVELS.unaware, lastKnownX: 0, lastKnownY: 0, searchTurnsLeft: 0 }],
  // Sound emission: footstep-level ambient by default; override via ambientNoise param.
  [SoundEmitter, (p) => ({ ambient: p.ambientNoise ?? HEARING_SOURCE_DB.footsteps, lastActionNoise: 0 })],
  // Creature taxonomy for targeting by spells, affixes, and deity mechanics.
  [CreatureType, (p) => ({ type: p.creatureType ?? CREATURE_TYPES.humanoid })],
  // Carrying load; recomputed each effects phase by encumbranceSystem.
  [Encumbrance, { current: 0, overloaded: false, heavilyLoaded: false }],
);

// Human (humanoid defaults, neutral faction)
export const Human = withOverrides(Creature, {
  Anatomy: (p) => ({ parts: resolveAnatomyParts({ ...p, humanoid: p.humanoid ?? true }) }),
  Physiology: (p) => ({
    sizeClass: p.sizeClass ?? "M",
    massKg: p.massKg ?? 78,
    kineticTriageDiv: p.kineticTriageDiv ?? 290,
    painMult: p.painMult ?? 1.0,
    bleedBaseMl: p.bleedBaseMl ?? 5000,
  }),
  Resistances: (p) => ({
    kinetic:   { DR: 4,  bluntMult: 1.0, slashMult: 1.0, pierceMult: 1.0, ...(p.resistances?.kinetic ?? {}) },
    thermal:   { igniteC: Infinity, burnMult: 1.0, ...(p.resistances?.thermal ?? {}) },
    chemical:  { acidMult: 1.0, baseMult: 1.0, solventMult: 1.0, toxMult: 1.0, ...(p.resistances?.chemical ?? {}) },
    electric:  { ohms: 1200, fibrillationA: 0.03, ...(p.resistances?.electric ?? {}) },
    radiation: { alpha: 1.0, beta: 1.0, gamma: 1.0, neutron: 1.0, ...(p.resistances?.radiation ?? {}) },
  }),
  Faction: (p) => ({ key: p.faction ?? p.factionKey ?? "neutral" }),
  NamedIdentity: (p) => ({ name: p.name ?? "Human", identity: p.identity ?? "human" }),
});

// Monster (hostile by default; anatomy configurable via params)
export const Monster = withOverrides(Creature, {
  Faction: (p) => ({ key: p.faction ?? p.factionKey ?? "enemy" }),
  NamedIdentity: (p) => ({ name: p.name ?? "Monster", identity: p.identity ?? "monster" }),
  Resistances: (p) => ({
    kinetic:   { DR: 8,  bluntMult: 0.95, slashMult: 0.95, pierceMult: 1.0, ...(p.resistances?.kinetic ?? {}) },
    thermal:   { igniteC: Infinity, burnMult: 0.95, ...(p.resistances?.thermal ?? {}) },
    chemical:  { acidMult: 1.0, baseMult: 1.0, solventMult: 1.0, toxMult: 1.0, ...(p.resistances?.chemical ?? {}) },
    electric:  { ohms: 900, fibrillationA: 0.04, ...(p.resistances?.electric ?? {}) },
    radiation: { alpha: 1.0, beta: 1.0, gamma: 1.0, neutron: 1.0, ...(p.resistances?.radiation ?? {}) },
  }),
});

// Other (non-humanoid baseline; anatomy empty unless provided)
export const Other = withOverrides(Creature, {
  Anatomy: (p) => ({ parts: resolveAnatomyParts({ ...p, anatomyKind: p.anatomyKind ?? null }) }),
  NamedIdentity: (p) => ({ name: p.name ?? "Creature", identity: p.identity ?? (p.kind ?? "creature") }),
});

// Shopkeeper (powerful neutral NPC with a shop; extends Human + adds Interactable & ShopInventory)
export const Shopkeeper = defineArchetype("Shopkeeper",
  { use: Human, with: new Map([
    ["Faction", () => ({ key: "shopkeeper" })],
    ["NamedIdentity", (p) => ({ name: p.name ?? "Shopkeeper", identity: "shopkeeper" })],
    ["Vitality", (p) => ({ maxHp: p.maxHp ?? 200, hp: p.hp ?? (p.maxHp ?? 200) })],
    ["Equipment", (p) => ({
      weapon: null, armor: null, ring1: null, ring2: null,
      accuracyDerived: p.accuracyDerived ?? 15,
      damagePowerDerived: p.damagePowerDerived ?? 15,
      evadeDerived: p.evadeDerived ?? 15,
      naturalDamageDice: p.naturalDamageDice ?? "2d10", naturalScript: null,
      maxHpDerived: 0, critChanceDerived: 0, critMultDerived: 0,
    })],
  ]) },
  [Interactable, { action: "openShop" }],
  [ShopInventory, { buyMarkup: 1.0, sellDiscount: 0.5 }],
);

// Back-compat shims (optional): export a HumanoidBase if callers expect it
export const HumanoidBase = Human;
