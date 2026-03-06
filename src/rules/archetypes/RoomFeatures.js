// Room feature archetypes — centerpiece entities placed in dungeon rooms
// so each room is "something": a fountain room, an altar room, etc.

import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { Position } from "../components/Position.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Interactable } from "../components/Interactable.js";
import { Collider } from "../components/Collider.js";
import { Material } from "../components/Material.js";
import { Inventory } from "../components/Inventory.js";
import { HarvestNode } from "../components/HarvestNode.js";
import { Pushable } from "../components/Pushable.js";

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
  [Pushable],
);

export const Sarcophagus = defineArchetype(
  "Sarcophagus",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Sarcophagus", identity: "sarcophagus" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, (/** @type {any} */ p) => ({ action: "openSarcophagus", params: { depth: p.depth || 1 } })],
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
  [Collider, { solid: true, blocksSight: false }],
  [Inventory, { capacity: 6 }],
  [Interactable, { action: "browseRack", params: null }],
);

export const Web = defineArchetype(
  "Web",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Web", identity: "web" }],
  [Material, { kind: "organic" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "clearWeb", params: null }],
);

export const Mushrooms = defineArchetype(
  "Mushrooms",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Mushrooms", identity: "mushrooms" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [HarvestNode, {
    kind: "mushrooms", ready: true, regrowTurns: 280, regrowCountdown: 0,
    yield: "food_mushrooms", yieldMin: 1, yieldMax: 3,
  }],
  [Interactable, { action: "harvestNode", params: null }],
);

export const Torch = defineArchetype(
  "Torch",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Torch", identity: "torch" }],
  [Material, { kind: "wood" }],
);

export const Urn = defineArchetype(
  "Urn",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Urn", identity: "urn" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "breakUrn", params: null }],
);
