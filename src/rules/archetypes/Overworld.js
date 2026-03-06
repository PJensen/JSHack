import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { Position } from "../components/Position.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Interactable } from "../components/Interactable.js";
import { Collider } from "../components/Collider.js";
import { Material } from "../components/Material.js";
import { Inventory } from "../components/Inventory.js";
import { HarvestNode } from "../components/HarvestNode.js";
import { ObjectState } from "../components/ObjectState.js";

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
  [Inventory, { capacity: 60 }],
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
  [HarvestNode, {
    kind: "berries", ready: true, regrowTurns: 256, regrowCountdown: 0,
    yield: "food_wild_berries", yieldMin: 1, yieldMax: 3,
  }],
  [Interactable, { action: "harvestNode", params: null }],
);

export const HerbPatch = defineArchetype(
  "HerbPatch",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Herb Patch", identity: "herb_patch" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [HarvestNode, {
    kind: "herbs", ready: true, regrowTurns: 240, regrowCountdown: 0,
    yield: "food_wild_herbs", yieldMin: 1, yieldMax: 2,
  }],
  [Interactable, { action: "harvestNode", params: null }],
);

export const ThornBramble = defineArchetype(
  "ThornBramble",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Thorn Bramble", identity: "thorn_bramble" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [HarvestNode, {
    kind: "thorn_bramble", ready: true, regrowTurns: 260, regrowCountdown: 0,
    yield: "reagent_thorn_pod", yieldMin: 2, yieldMax: 4,
    danger: { type: "physical", dmgMin: 1, dmgMax: 3, cause: "thorn_bramble" },
  }],
  [Interactable, { action: "harvestNode", params: null }],
);

export const VenomFern = defineArchetype(
  "VenomFern",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Venom Fern", identity: "venom_fern" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [HarvestNode, {
    kind: "venom_fern", ready: true, regrowTurns: 268, regrowCountdown: 0,
    yield: "reagent_venom_frond", yieldMin: 2, yieldMax: 3,
    danger: { type: "poison", dmgMin: 1, dmgMax: 2, cause: "venom_fern" },
    hazard: { kind: "poison", turnsLeft: 2, tickDamage: 1, identity: "venom_spores", name: "Venom Spores" },
  }],
  [Interactable, { action: "harvestNode", params: null }],
);

export const OreVeinIron = defineArchetype(
  "OreVeinIron",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Iron Vein", identity: "ore_vein_iron" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
  [HarvestNode, {
    kind: "iron_ore", ready: true, regrowTurns: 400, regrowCountdown: 0,
    yield: "ore_iron", yieldMin: 1, yieldMax: 3,
    requiresTool: "dig",
  }],
  [Interactable, { action: "harvestNode", params: null }],
);

export const OreVeinCoal = defineArchetype(
  "OreVeinCoal",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Coal Seam", identity: "ore_vein_coal" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
  [HarvestNode, {
    kind: "coal_ore", ready: true, regrowTurns: 300, regrowCountdown: 0,
    yield: "ore_coal", yieldMin: 2, yieldMax: 4,
    requiresTool: "dig",
  }],
  [Interactable, { action: "harvestNode", params: null }],
);

export const OreVeinStone = defineArchetype(
  "OreVeinStone",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Stone Outcrop", identity: "ore_vein_stone" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
  [HarvestNode, {
    kind: "stone", ready: true, regrowTurns: 250, regrowCountdown: 0,
    yield: "ore_stone", yieldMin: 2, yieldMax: 5,
    requiresTool: "dig",
  }],
  [Interactable, { action: "harvestNode", params: null }],
);

export const AlchemyBench = defineArchetype(
  "AlchemyBench",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Alchemy Bench", identity: "alchemy_bench" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "brewAlchemy", params: null }],
);

export const Anvil = defineArchetype(
  "Anvil",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Anvil", identity: "anvil" }],
  [Material, { kind: "iron" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const Furnace = defineArchetype(
  "Furnace",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Furnace", identity: "furnace" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "toggleFurnace", params: null }],
  [ObjectState, { state: "unlit" }],
);

export const CookingFire = defineArchetype(
  "CookingFire",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Cooking Fire", identity: "cooking_fire" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "cookFood", params: null }],
);
