// Room feature archetypes — centerpiece entities placed in dungeon rooms
// so each room is "something": a fountain room, an altar room, etc.

import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { Position } from "../components/Position.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Interactable } from "../components/Interactable.js";
import { Collider } from "../components/Collider.js";
import { Material } from "../components/Material.js";
import { HarvestNode } from "../components/HarvestNode.js";

// --- Interactive features ---

export const Fountain = defineArchetype(
  "Fountain",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Fountain", identity: "fountain" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "drinkFountain", params: null }],
);

export const Altar = defineArchetype(
  "Altar",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Altar", identity: "altar" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "prayAltar", params: null }],
);

export const Shrine = defineArchetype(
  "Shrine",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Shrine", identity: "shrine" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "touchShrine", params: null }],
);

// --- Decorative features ---

export const Statue = defineArchetype(
  "Statue",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Statue", identity: "statue" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: true }],
);

export const Sarcophagus = defineArchetype(
  "Sarcophagus",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Sarcophagus", identity: "sarcophagus" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const Pillar = defineArchetype(
  "Pillar",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Pillar", identity: "pillar" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: true }],
);

export const WeaponRack = defineArchetype(
  "WeaponRack",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Weapon Rack", identity: "weapon_rack" }],
  [Material, { kind: "iron" }],
  [Collider, { solid: false, blocksSight: false }],
);

export const Mushrooms = defineArchetype(
  "Mushrooms",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Mushrooms", identity: "mushrooms" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [HarvestNode, { kind: "mushrooms", ready: true, regrowTurns: 80, regrowCountdown: 0 }],
  [Interactable, { action: "harvestNode", params: { kind: "mushrooms" } }],
);
