import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { Position } from "../components/Position.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Interactable } from "../components/Interactable.js";
import { Collider } from "../components/Collider.js";
import { Material } from "../components/Material.js";
import { Inventory } from "../components/Inventory.js";
import { HarvestNode } from "../components/HarvestNode.js";
import { ObjectState } from "../components/ObjectState.js";
import { GrowthStage } from "../components/GrowthStage.js";

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

export const MoonleafCluster = defineArchetype(
  "MoonleafCluster",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Moonleaf Cluster", identity: "moonleaf_cluster" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [HarvestNode, {
    kind: "moonleaf", ready: true, regrowTurns: 252, regrowCountdown: 0,
    yield: "reagent_moonleaf", yieldMin: 2, yieldMax: 3,
  }],
  [Interactable, { action: "harvestNode", params: null }],
);

export const EmberRootPatch = defineArchetype(
  "EmberRootPatch",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Ember Root Patch", identity: "ember_root_patch" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [HarvestNode, {
    kind: "ember_root", ready: true, regrowTurns: 276, regrowCountdown: 0,
    yield: "reagent_ember_root", yieldMin: 1, yieldMax: 2,
    danger: { type: "fire", dmgMin: 1, dmgMax: 2, cause: "ember_root" },
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

export const TreeNode = defineArchetype(
  "TreeNode",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Tree", identity: "tree_harvest" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: true }],
  [HarvestNode, {
    kind: "tree", ready: true, regrowTurns: 350, regrowCountdown: 0,
    yield: "material_lumber", yieldMin: 1, yieldMax: 1,
    requiresTool: "chop",
  }],
  [GrowthStage, {
    currentStage: 2, maxStage: 2,
    stageIdentities: ["tree_stump", "tree_sapling", "tree_harvest"],
    growInterval: 0, growCountdown: 0,
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
  [Interactable, {
    action: "forgeTools",
    params: { idleState: "idle", activeState: "working", activeDuration: 4 },
  }],
  [ObjectState, { state: "idle" }],
);

export const Furnace = defineArchetype(
  "Furnace",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Furnace", identity: "furnace" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, {
    action: "smeltOre",
    params: { idleState: "unlit", activeState: "lit", activeDuration: 5 },
  }],
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

// ── Farm crops ────────────────────────────────────────────────────
export const CropWheat = defineArchetype(
  "CropWheat",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Wheat", identity: "crop_wheat" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [HarvestNode, {
    kind: "wheat", ready: true, regrowTurns: 200, regrowCountdown: 0,
    yield: "food_wheat", yieldMin: 1, yieldMax: 3,
    replantable: true, needsPlanting: false,
  }],
  [GrowthStage, {
    currentStage: 3, maxStage: 3,
    stageIdentities: ["farmland_tilled", "seedling", "herb_growing", "crop_wheat"],
    growInterval: 0, growCountdown: 0,
  }],
  [Interactable, { action: "harvestNode", params: null }],
);

export const CropCarrot = defineArchetype(
  "CropCarrot",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Carrot", identity: "crop_carrot" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [HarvestNode, {
    kind: "carrot", ready: true, regrowTurns: 160, regrowCountdown: 0,
    yield: "food_carrot", yieldMin: 1, yieldMax: 2,
    replantable: true, needsPlanting: false,
  }],
  [GrowthStage, {
    currentStage: 3, maxStage: 3,
    stageIdentities: ["farmland_tilled", "seedling", "herb_growing", "crop_carrot"],
    growInterval: 0, growCountdown: 0,
  }],
  [Interactable, { action: "harvestNode", params: null }],
);

export const CropCorn = defineArchetype(
  "CropCorn",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Corn", identity: "crop_corn" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [HarvestNode, {
    kind: "corn", ready: true, regrowTurns: 280, regrowCountdown: 0,
    yield: "food_corn", yieldMin: 1, yieldMax: 1,
    replantable: true, needsPlanting: false,
  }],
  [GrowthStage, {
    currentStage: 3, maxStage: 3,
    stageIdentities: ["farmland_tilled", "seedling", "herb_growing", "crop_corn"],
    growInterval: 0, growCountdown: 0,
  }],
  [Interactable, { action: "harvestNode", params: null }],
);

// ── Decorative overworld entities ─────────────────────────────────
export const Well = defineArchetype(
  "Well",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Well", identity: "well" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "drinkWell", params: null }],
);

export const Scarecrow = defineArchetype(
  "Scarecrow",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Scarecrow", identity: "scarecrow" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const TavernKeg = defineArchetype(
  "TavernKeg",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Keg", identity: "tavern_keg" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const TavernTable = defineArchetype(
  "TavernTable",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Table", identity: "tavern_table" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const TavernBench = defineArchetype(
  "TavernBench",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Bench", identity: "tavern_bench" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const TavernPillar = defineArchetype(
  "TavernPillar",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Pillar", identity: "tavern_pillar" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const TavernSign = defineArchetype(
  "TavernSign",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Tavern Sign", identity: "tavern_sign" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: false, blocksSight: false }],
);

export const Millstone = defineArchetype(
  "Millstone",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Millstone", identity: "millstone" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, {
    action: "millGrain",
    params: { idleState: "idle", activeState: "working", activeDuration: 4 },
  }],
  [ObjectState, { state: "idle" }],
);

// ── Church ───────────────────────────────────────────────────────
export const ChurchAltar = defineArchetype(
  "ChurchAltar",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Church Altar", identity: "church_altar" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "prayAltar", params: null }],
);

export const ChurchPew = defineArchetype(
  "ChurchPew",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Pew", identity: "church_pew" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: false, blocksSight: false }],
);

export const ChurchSign = defineArchetype(
  "ChurchSign",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Church Sign", identity: "church_sign" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: false, blocksSight: false }],
);

export const ChurchFont = defineArchetype(
  "ChurchFont",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Baptismal Font", identity: "church_font" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "drinkFountain", params: null }],
);

export const ChurchWindow = defineArchetype(
  "ChurchWindow",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Stained Glass Window", identity: "church_window" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const WindowArched = defineArchetype(
  "WindowArched",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Arched Window", identity: "window_arched" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const WindowIronGrate = defineArchetype(
  "WindowIronGrate",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Iron Grate Window", identity: "window_iron_grate" }],
  [Material, { kind: "iron" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const WindowShuttered = defineArchetype(
  "WindowShuttered",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Shuttered Window", identity: "window_shuttered" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const WindowRound = defineArchetype(
  "WindowRound",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Round Window", identity: "window_round" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const WindowRect = defineArchetype(
  "WindowRect",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Window", identity: "window_rect" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const TownBell = defineArchetype(
  "TownBell",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Town Bell", identity: "bell" }],
  [Material, { kind: "bronze" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "ringBell", params: null }],
);

// ── Garden flowers (non-solid: walkable decorative) ─────────────
export const FlowerRose = defineArchetype(
  "FlowerRose",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "seedling", identity: "seedling" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: false, blocksSight: false }],
  [GrowthStage, {
    currentStage: 0, maxStage: 2,
    stageIdentities: ["seedling", "herb_growing", "flower_rose"],
    growInterval: 50, growCountdown: 50,
  }],
);

export const FlowerSunflower = defineArchetype(
  "FlowerSunflower",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "seedling", identity: "seedling" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: false, blocksSight: false }],
  [GrowthStage, {
    currentStage: 0, maxStage: 2,
    stageIdentities: ["seedling", "herb_growing", "flower_sunflower"],
    growInterval: 60, growCountdown: 60,
  }],
);

export const FlowerTulip = defineArchetype(
  "FlowerTulip",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "seedling", identity: "seedling" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: false, blocksSight: false }],
  [GrowthStage, {
    currentStage: 0, maxStage: 2,
    stageIdentities: ["seedling", "herb_growing", "flower_tulip"],
    growInterval: 45, growCountdown: 45,
  }],
);

export const FlowerDaisy = defineArchetype(
  "FlowerDaisy",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "seedling", identity: "seedling" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: false, blocksSight: false }],
  [GrowthStage, {
    currentStage: 0, maxStage: 2,
    stageIdentities: ["seedling", "herb_growing", "flower_daisy"],
    growInterval: 55, growCountdown: 55,
  }],
);

export const FlowerBluebell = defineArchetype(
  "FlowerBluebell",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "seedling", identity: "seedling" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: false, blocksSight: false }],
  [GrowthStage, {
    currentStage: 0, maxStage: 2,
    stageIdentities: ["seedling", "herb_growing", "flower_bluebell"],
    growInterval: 48, growCountdown: 48,
  }],
);

// ── Smithy building ──────────────────────────────────────────────
export const SmithyChest = defineArchetype(
  "SmithyChest",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Smithy Chest", identity: "smithy_chest" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [Inventory, { capacity: 30 }],
  [Interactable, { action: "openChest", params: null }],
);

export const MillChest = defineArchetype(
  "MillChest",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Mill Chest", identity: "mill_chest" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [Inventory, { capacity: 30 }],
  [Interactable, { action: "openChest", params: null }],
);

export const LumberChest = defineArchetype(
  "LumberChest",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Lumber Chest", identity: "lumber_chest" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [Inventory, { capacity: 30 }],
  [Interactable, { action: "openChest", params: null }],
);

export const SmithySign = defineArchetype(
  "SmithySign",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Smithy Sign", identity: "smithy_sign" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: false, blocksSight: false }],
  [Interactable, { action: "readText", params: { textId: "smithy_sign" } }],
);

export const PotionShelf = defineArchetype(
  "PotionShelf",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Potion Shelf", identity: "potion_shelf" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [Inventory, { capacity: 6 }],
  [Interactable, { action: "browseRack", params: null }],
);

export const HerbChest = defineArchetype(
  "HerbChest",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Herb Chest", identity: "herb_chest" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [Inventory, { capacity: 30 }],
  [Interactable, { action: "openChest", params: null }],
);

export const TavernChest = defineArchetype(
  "TavernChest",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Tavern Chest", identity: "tavern_chest" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [Inventory, { capacity: 30 }],
  [Interactable, { action: "openChest", params: null }],
);

export const ApothecarySign = defineArchetype(
  "ApothecarySign",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Apothecary Sign", identity: "apothecary_sign" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: false, blocksSight: false }],
  [Interactable, { action: "readText", params: { textId: "apothecary_sign" } }],
);

export const GemShopSign = defineArchetype(
  "GemShopSign",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Gem Shop Sign", identity: "gem_shop_sign" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: false, blocksSight: false }],
  [Interactable, { action: "readText", params: { textId: "gem_shop_sign" } }],
);

export const BookShopSign = defineArchetype(
  "BookShopSign",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Book Shop Sign", identity: "book_shop_sign" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: false, blocksSight: false }],
  [Interactable, { action: "readText", params: { textId: "book_shop_sign" } }],
);

export const GemDisplayCase = defineArchetype(
  "GemDisplayCase",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Gem Display Case", identity: "gem_display_case" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [Inventory, { capacity: 6 }],
  [Interactable, { action: "browseRack", params: null }],
);

export const MessageBoard = defineArchetype(
  "MessageBoard",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Town Message Board", identity: "message_board" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "readTownBulletin", params: null }],
);

// ── Graveyard ────────────────────────────────────────────────────
export const GraveTombstone = defineArchetype(
  "GraveTombstone",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Tombstone", identity: "tombstone" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "readText", params: { textId: "grave_epitaph" } }],
);

// ── Town decorations ─────────────────────────────────────────────
export const Barrel = defineArchetype(
  "Barrel",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Barrel", identity: "barrel" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const Crate = defineArchetype(
  "Crate",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Crate", identity: "crate" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const Woodpile = defineArchetype(
  "Woodpile",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Woodpile", identity: "woodpile" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const HayBale = defineArchetype(
  "HayBale",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Hay Bale", identity: "hay_bale" }],
  [Material, { kind: "plant" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const LanternPost = defineArchetype(
  "LanternPost",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Lantern Post", identity: "lantern_post" }],
  [Material, { kind: "iron" }],
  [Collider, { solid: true, blocksSight: false }],
  [ObjectState, { state: "lit" }],
  [Interactable, { action: "toggleLantern", params: null }],
);

export const RainBarrel = defineArchetype(
  "RainBarrel",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Rain Barrel", identity: "rain_barrel" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const Wheelbarrow = defineArchetype(
  "Wheelbarrow",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Wheelbarrow", identity: "wheelbarrow" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const MarketStall = defineArchetype(
  "MarketStall",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Market Stall", identity: "market_stall" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const Bench = defineArchetype(
  "Bench",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Bench", identity: "bench" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: false, blocksSight: false }],
);

// ── Natural features ─────────────────────────────────────────────
export const Boulder = defineArchetype(
  "Boulder",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Boulder", identity: "boulder" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const FallenLog = defineArchetype(
  "FallenLog",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Fallen Log", identity: "fallen_log" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: false, blocksSight: false }],
);

export const LilyPad = defineArchetype(
  "LilyPad",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Lily Pad", identity: "lily_pad" }],
  [Material, { kind: "plant" }],
  [Collider, { solid: false, blocksSight: false }],
);

export const Cattail = defineArchetype(
  "Cattail",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Cattail", identity: "cattail" }],
  [Material, { kind: "plant" }],
  [Collider, { solid: false, blocksSight: false }],
);

// ── Garden features ──────────────────────────────────────────────
export const Birdbath = defineArchetype(
  "Birdbath",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Birdbath", identity: "birdbath" }],
  [Material, { kind: "stone" }],
  [Collider, { solid: true, blocksSight: false }],
);

export const Trellis = defineArchetype(
  "Trellis",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Trellis", identity: "trellis" }],
  [Material, { kind: "wood" }],
  [Collider, { solid: false, blocksSight: false }],
);
