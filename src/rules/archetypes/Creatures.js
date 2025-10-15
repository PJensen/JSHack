import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { Anatomy, buildHumanoidAnatomy } from "../components/Anatomy.js";
import { Resistances }      from "../components/Resistences.js";
import { Physiology }       from "../components/Physiology.js";
import { Faction }          from "../components/Faction.js";
import { NamedIdentity }          from "../components/NamedIdentity.js";


export const Raider = defineArchetype(
  "Raider",
  [Resistances, {
    kinetic:   { DR: 8,  bluntMult: 1.0, slashMult: 0.9, pierceMult: 1.0 },
    thermal:   { igniteC: Infinity, burnMult: 1.0 },
    chemical:  { acidMult: 1.0, baseMult: 1.0, solventMult: 1.0, toxMult: 1.0 },
    electric:  { ohms: 900, fibrillationA: 0.03 },
    radiation: { alpha: 1.0, beta: 1.0, gamma: 1.1, neutron: 1.0 }
  }],
  [Physiology, { sizeClass: "M", massKg: 78, kineticTriageDiv: 290, painMult: 0.95 }],
  [Faction, { key: "enemy" }],
  [NamedIdentity, { name: "Raider", identity: "raider" }],
);

export const Orc = defineArchetype(
  "Orc",
  [Resistances, {
    kinetic:   { DR: 18, bluntMult: 0.85, slashMult: 0.9, pierceMult: 0.95 },
    thermal:   { igniteC: Infinity, burnMult: 0.9 },
    chemical:  { acidMult: 1.2, baseMult: 1.1, solventMult: 1.1, toxMult: 0.9 },
    electric:  { ohms: 800, fibrillationA: 0.04 },
    radiation: { alpha: 0.9, beta: 0.9, gamma: 1.0, neutron: 1.0 }
  }],
  [Physiology, { sizeClass: "L", massKg: 110, kineticTriageDiv: 360, painMult: 0.7, bleedBaseMl: 6500 }],
  [Faction, { key: "enemy" }],
  [NamedIdentity, { name: "Ocr", identity: "orc" }],
);

// ---------- SMALL ANIMALS ----------
export const Rat = defineArchetype("Rat", [
  [Resistances, {
    kinetic:   { DR: 1,  bluntMult: 1.2, slashMult: 1.1, pierceMult: 1.0 },
    thermal:   { igniteC: Infinity, burnMult: 1.2 },
    chemical:  { acidMult: 1.1, baseMult: 1.1, solventMult: 1.1, toxMult: 1.2 },
    electric:  { ohms: 1200, fibrillationA: 0.02 },
    radiation: { alpha: 1.0, beta: 1.0, gamma: 1.2, neutron: 1.1 }
  }],
  [Physiology, { sizeClass: "XS", massKg: 0.4, kineticTriageDiv: 120, painMult: 1.2, bleedBaseMl: 30 }],
  [Faction, { key: "neutral" }],
  [NamedIdentity, { name: "Rat", identity: "rat" }],  
]);

// ---------- NON-HUMANOID (AMORPHOUS / UNDEAD / CONSTRUCT) ----------
export const Slime = defineArchetype("Slime", [
  [Resistances, {
    kinetic:   { DR: 30, bluntMult: 0.30, slashMult: 0.9,  pierceMult: 0.6 },
    thermal:   { igniteC: Infinity, burnMult: 1.1 },
    chemical:  { acidMult: 0.6, baseMult: 0.6, solventMult: 0.4, toxMult: 0.8 },
    electric:  { ohms: 200, fibrillationA: 0.00 },
    radiation: { alpha: 0.8, beta: 1.0, gamma: 1.2, neutron: 1.0 }
  }],
  [Physiology, { sizeClass:"M", massKg: 50, kineticTriageDiv: 400, painMult: 0.2, bleedBaseMl: 0 }],
  [Faction, { key: "neutral" }],
  [NamedIdentity, { name: "Slime Mold", identity: "slime-mold" }]
]);

export const Skeleton = defineArchetype("Skeleton", [
  [Resistances, {
    kinetic:   { DR: 10, bluntMult: 1.4, slashMult: 0.5, pierceMult: 0.4 }, // blunt smashes, edges glance
    thermal:   { igniteC: Infinity, burnMult: 0.2 },
    chemical:  { acidMult: 1.3, baseMult: 1.3, solventMult: 0.5, toxMult: 0.0 },
    electric:  { ohms: Infinity, fibrillationA: 999 },
    radiation: { alpha: 0.8, beta: 0.8, gamma: 0.8, neutron: 0.8 }
  }],
  [Physiology, { sizeClass:"M", massKg: 25, kineticTriageDiv: 220, painMult: 0.0, bleedBaseMl: 0 }],
  [Faction, { key: "enemy" }],
  [NamedIdentity, { value: "Skeleton" }],
  [NamedIdentity, { name: "Skeleton", identity: "skeleton" }],  
]);

// ---------- HEAVY CONSTRUCT ----------
export const StoneGolem = defineArchetype("StoneGolem", [
  [Resistances, {
    kinetic:   { DR: 80, bluntMult: 0.6,  slashMult: 0.2, pierceMult: 0.3 },
    thermal:   { igniteC: Infinity, burnMult: 0.3 },
    chemical:  { acidMult: 0.8, baseMult: 1.3, solventMult: 0.2, toxMult: 0.0 },
    electric:  { ohms: 5000, fibrillationA: 999 },
    radiation: { alpha: 0.5, beta: 0.5, gamma: 0.6, neutron: 0.7 }
  }],
  [Physiology, { sizeClass:"XL", massKg: 600, kineticTriageDiv: 900, painMult: 0.0, bleedBaseMl: 0 }],
  [Faction, { key: "enemy" }],
  [NamedIdentity, { name: "Stone Golem", identity: "stone-golem" }]
]);
