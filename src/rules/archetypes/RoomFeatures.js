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
import { ObjectState } from "../components/ObjectState.js";
import { HydraulicsLink } from "../components/HydraulicsLink.js";
import { Vitality } from "../components/Vitality.js";
import { AudioEmitter } from "../components/AudioEmitter.js";

// --- Interactive features ---

export const Fountain = defineArchetype(
  "Fountain",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Fountain", identity: "fountain" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "fountain", params: null }],
);

export const Altar = defineArchetype(
  "Altar",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Altar", identity: "altar" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "prayAltar", params: null }],
  [AudioEmitter, { emitters: [{ profile: "holy_site", interior: false }] }],
);

export const Shrine = defineArchetype(
  "Shrine",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Shrine", identity: "shrine" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "touchShrine", params: null }],
  [AudioEmitter, { emitters: [{ profile: "holy_site", interior: false }] }],
);

export const Runestone = defineArchetype(
  "Runestone",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Runestone", identity: "runestone" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "touchRunestone", params: null }],
  [AudioEmitter, { emitters: [{ profile: "runic", interior: false }] }],
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
  [AudioEmitter, { emitters: [{ profile: "torch", interior: false }] }],
);

export const Urn = defineArchetype(
  "Urn",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Urn", identity: "urn" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "breakUrn", params: null }],
);

export const Effigy = defineArchetype(
  "Effigy",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Training Effigy", identity: "effigy" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [Vitality, { maxHp: 30, hp: 30 }],
);

export const FlayedMan = defineArchetype(
  "FlayedMan",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Flayed Man", identity: "flayed_man" }],
  [Material, { kind: "organic" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const HangingChains = defineArchetype(
  "HangingChains",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Hanging Chains", identity: "hanging_chains" }],
  [Material, { kind: "iron" }],
  [Collider, { solid: true, blocksSight: false }],
);

// --- New mechanical/hydraulics features ---

export const Portcullis = defineArchetype(
  "Portcullis",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Portcullis", identity: "portcullis" }],
  [Material, { kind: "iron" }],
  [Collider, { solid: true, blocksSight: true }],
  [ObjectState, { state: "lowered" }],
  [HydraulicsLink, (/** @type {any} */ p) => ({ linkId: String(p.linkId || ""), role: "portcullis" })],
  [Interactable, { action: "bumpPortcullis", params: null }],
);

export const ChainWinch = defineArchetype(
  "ChainWinch",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Chain Winch", identity: "chain_winch" }],
  [Material, { kind: "iron" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, (/** @type {any} */ p) => ({
    action: "operateChainWinch",
    params: {
      linkId: String(p.linkId || ""),
      togglesTo: "toggle",
    },
  })],
  [ObjectState, { state: "idle" }],
  [HydraulicsLink, (/** @type {any} */ p) => ({ linkId: String(p.linkId || ""), role: "winch" })],
);

export const PressurePlinth = defineArchetype(
  "PressurePlinth",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Pressure Plinth", identity: "pressure_plinth" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: false, blocksSight: false }],
  [ObjectState, { state: "unpressed" }],
  [HydraulicsLink, (/** @type {any} */ p) => ({ linkId: String(p.linkId || ""), role: "plinth" })],
  [Interactable, (/** @type {any} */ p) => ({
    action: "inspectPressurePlinth",
    params: {
      linkId: String(p.linkId || ""),
      thresholdWeight: Number.isFinite(p.thresholdWeight) ? Number(p.thresholdWeight) : 25,
    },
  })],
);

export const FloodGateWheel = defineArchetype(
  "FloodGateWheel",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Flood Gate Wheel", identity: "flood_gate_wheel" }],
  [Material, { kind: "iron" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, (/** @type {any} */ p) => ({
    action: "toggleFloodGateWheel",
    params: {
      floodRadius: Number.isFinite(p.floodRadius) ? (p.floodRadius | 0) : 2,
      active: !!p.active,
    },
  })],
  [ObjectState, { state: "closed" }],
);

export const DrainThroat = defineArchetype(
  "DrainThroat",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Drain Throat", identity: "drain_throat" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: false, blocksSight: false }],
);

export const SteamVent = defineArchetype(
  "SteamVent",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Steam Vent", identity: "steam_vent" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: false, blocksSight: false }],
  [Interactable, (/** @type {any} */ p) => ({
    action: "inspectSteamVent",
    params: {
      periodTurns: Number.isFinite(p.periodTurns) ? (p.periodTurns | 0) : 6,
      activeTurns: Number.isFinite(p.activeTurns) ? (p.activeTurns | 0) : 2,
      range: Number.isFinite(p.range) ? (p.range | 0) : 4,
      dirX: Number.isFinite(p.dirX) ? Math.sign(p.dirX | 0) : 0,
      dirY: Number.isFinite(p.dirY) ? Math.sign(p.dirY | 0) : 1,
      pushForce: Number.isFinite(p.pushForce) ? (p.pushForce | 0) : 1,
      damage: Number.isFinite(p.damage) ? (p.damage | 0) : 2,
    },
  })],
);

export const BoneChimeRack = defineArchetype(
  "BoneChimeRack",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Bone Chime Rack", identity: "bone_chime_rack" }],
  [Material, { kind: "organic" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "ringBoneChime", params: null }],
);

export const CandleCluster = defineArchetype(
  "CandleCluster",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Candle Cluster", identity: "candle_cluster" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: false, blocksSight: false }],
);

export const EmberBrazier = defineArchetype(
  "EmberBrazier",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Ember Brazier", identity: "ember_brazier" }],
  [Material, { kind: "steel" }],
  [Collider, { solid: false, blocksSight: false }],
);

export const GlowcapPatch = defineArchetype(
  "GlowcapPatch",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Glowcap Patch", identity: "glowcap_patch" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: false, blocksSight: false }],
);

export const WebMoteCluster = defineArchetype(
  "WebMoteCluster",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Web Mote Cluster", identity: "web_mote_cluster" }],
  [Material, { kind: "organic" }],
  [Collider, { solid: false, blocksSight: false }],
);

export const ArmorStand = defineArchetype(
  "ArmorStand",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Armor Stand", identity: "armor_stand" }],
  [Material, { kind: "steel" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const PolishedMirror = defineArchetype(
  "PolishedMirror",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Polished Mirror", identity: "polished_mirror" }],
  [Material, { kind: "silver" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const VoidCrack = defineArchetype(
  "VoidCrack",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Void Crack", identity: "void_crack" }],
  [Material, { kind: "obsidian" }],
  [Collider, { solid: false, blocksSight: false }],
);

export const DarkReliquary = defineArchetype(
  "DarkReliquary",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Dark Reliquary", identity: "dark_reliquary" }],
  [Material, { kind: "obsidian" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const MistVent = defineArchetype(
  "MistVent",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Mist Vent", identity: "mist_vent" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: false, blocksSight: false }],
);
