import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { Consumable } from "../components/Consumable.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Material } from "../components/Material.js";
import { NamedIdentity } from "../components/NamedIdentity.js";

export const FlourSack = defineArchetype(
  "FlourSack",
  [ItemInfo, {
    type: "ingredient",
    description: "A sack of fresh-milled flour ready for the tavern kitchen.",
    weight: 0.6,
    value: 7,
    count: 1,
  }],
  [NamedIdentity, (p) => ({ name: (p && p.name) ?? "Flour", identity: "food_flour" })],
  [Material, { kind: "organic" }],
);

export const WaterBucket = defineArchetype(
  "WaterBucket",
  [ItemInfo, {
    type: "utility",
    description: "A heavy bucket of clean water drawn from the town well.",
    weight: 1.4,
    value: 2,
    count: 1,
  }],
  [NamedIdentity, (p) => ({ name: (p && p.name) ?? "Water Bucket", identity: "water_bucket" })],
  [Material, { kind: "wood" }],
);

export const FirewoodBundle = defineArchetype(
  "FirewoodBundle",
  [ItemInfo, {
    type: "fuel",
    description: "A bundled armful of split firewood.",
    weight: 1.0,
    value: 4,
    count: 1,
  }],
  [NamedIdentity, (p) => ({ name: (p && p.name) ?? "Firewood", identity: "fuel_firewood" })],
  [Material, { kind: "wood" }],
);

export const LumberBundle = defineArchetype(
  "LumberBundle",
  [ItemInfo, {
    type: "material",
    description: "Cut lumber stacked for repairs, handles, and framing work.",
    weight: 1.2,
    value: 6,
    count: 1,
  }],
  [NamedIdentity, (p) => ({ name: (p && p.name) ?? "Lumber", identity: "material_lumber" })],
  [Material, { kind: "wood" }],
);

export const IronIngot = defineArchetype(
  "IronIngot",
  [ItemInfo, {
    type: "material",
    description: "A bar of workable iron smelted from ore at a hot forge.",
    weight: 1.1,
    value: 9,
    count: 1,
  }],
  [NamedIdentity, (p) => ({ name: (p && p.name) ?? "Iron Ingot", identity: "material_iron" })],
  [Material, { kind: "iron" }],
);

export const WorkHatchet = defineArchetype(
  "WorkHatchet",
  [ItemInfo, {
    type: "weapon",
    slot: "weapon",
    description: "A practical woodsman's hatchet made for work before war.",
    weight: 2.0,
    value: 18,
    count: 1,
    bonuses: { attack: 2 },
  }],
  [NamedIdentity, (p) => ({ name: (p && p.name) ?? "Work Hatchet", identity: "tool_hatchet" })],
  [Material, { kind: "iron" }],
);

export const KitchenKnife = defineArchetype(
  "KitchenKnife",
  [ItemInfo, {
    type: "weapon",
    slot: "weapon",
    description: "A narrow kitchen knife for carving roots, herbs, and stew meat.",
    weight: 0.6,
    value: 12,
    count: 1,
    bonuses: { attack: 1 },
  }],
  [NamedIdentity, (p) => ({ name: (p && p.name) ?? "Kitchen Knife", identity: "tool_kitchen_knife" })],
  [Material, { kind: "iron" }],
);

export const TownStew = defineArchetype(
  "TownStew",
  [Consumable, {
    effectParams: { nutrition: 220, special: null },
    remainingUses: 1,
    potency: 0,
  }],
  [ItemInfo, {
    type: "food",
    description: "A steaming bowl of tavern stew, rich with grain and herbs.",
    weight: 0.8,
    value: 14,
    count: 1,
  }],
  [NamedIdentity, (p) => ({ name: (p && p.name) ?? "Town Stew", identity: "food_stew" })],
  [Material, { kind: "organic" }],
);
