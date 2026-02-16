import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { Position } from "../components/Position.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Interactable } from "../components/Interactable.js";
import { Collider } from "../components/Collider.js";
import { Material } from "../components/Material.js";
import { Inventory } from "../components/Inventory.js";
import { HarvestNode } from "../components/HarvestNode.js";

export const HomeBed = defineArchetype(
  "HomeBed",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Cozy Bed", identity: "bed_home" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "restAtBed", params: null }],
);

export const HomeChest = defineArchetype(
  "HomeChest",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Stash Chest", identity: "chest" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [Inventory, { items: [], capacity: 60, weightLimit: null }],
  [Interactable, { action: "openChest", params: null }],
);

export const HomeSign = defineArchetype(
  "HomeSign",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Home Sign", identity: "house_sign" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "readText", params: { textId: "home_sign" } }],
);

export const BerryBush = defineArchetype(
  "BerryBush",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Berry Bush", identity: "berry_bush" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [HarvestNode, { kind: "berries", ready: true, regrowTurns: 28, regrowCountdown: 0 }],
  [Interactable, { action: "harvestNode", params: { kind: "berries" } }],
);

export const HerbPatch = defineArchetype(
  "HerbPatch",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Herb Patch", identity: "herb_patch" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [HarvestNode, { kind: "herbs", ready: true, regrowTurns: 20, regrowCountdown: 0 }],
  [Interactable, { action: "harvestNode", params: { kind: "herbs" } }],
);
