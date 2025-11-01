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
import { Wounds } from "../components/Wounds.js";
import { ActiveEffects } from "../components/ActiveEffects.js";

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
  electric:  { ohms: Infinity, fibrillationA: 0.03 },
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
  [Inventory, (p) => ({ items: [], capacity: p.capacity ?? 0, weightLimit: p.weightLimit ?? null })],
  [Equipment, (p) => ({
    weapon: p.weapon ?? null,
    armor: p.armor ?? null,
    ring1: p.ring1 ?? null,
    ring2: p.ring2 ?? null,
    attackDerived: 0, defenseDerived: 0, maxHpDerived: 0, critChanceDerived: 0, critMultDerived: 0,
  })],
  [Wounds, { list: [] }],
  [ActiveEffects, { list: [] }],
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

// Back-compat shims (optional): export a HumanoidBase if callers expect it
export const HumanoidBase = Human;
