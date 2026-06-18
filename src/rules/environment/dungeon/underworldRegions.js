import { DEFAULT_PROFILE } from "./profiles/default.js";
import { CATACOMB_PROFILE } from "./profiles/catacombs.js";
import { CAVE_PROFILE } from "./profiles/caves.js";
import { GROTTO_PROFILE } from "./profiles/grottos.js";
import { ARENA_PROFILE } from "./profiles/arenas.js";

export const UNDERWORLD_REGION_TEMPLATES = Object.freeze({
  tavern_basement: Object.freeze({
    templateId: "tavern_basement",
    label: "Tavern Basement",
    type: "basement",
    floors: 3,
    biome: "cellar",
    monsterTier: 0,
    lootTier: 0,
    questId: "starter.rat_infestation",
    targetDepth: 1,
    roomTarget: 3,
    content: Object.freeze({
      monsters: Object.freeze([{ id: "rat", count: 12 }]),
      traps: Object.freeze([]),
      features: Object.freeze(["torch", "barrel", "crate"]),
      chests: Object.freeze([{ lootTable: "chest:basic" }]),
    }),
    profile: Object.freeze({
      ...DEFAULT_PROFILE,
      id: "basement",
      theme: "cellar",
      bspMaxDepth: 4,
      minLeafSize: 8,
      minRoomSize: 3,
      maxRoomSize: 6,
      roomSparsity: 0.45,
      doorChance: 0.35,
      shopChance: 0,
      hallwayMonsterCap: 1,
      monsterFilter: (def) => String(def?.id || "") === "rat",
      featurePool: Object.freeze(["torch", "barrel", "crate", "chest"]),
    }),
  }),
  graveyard_crypt: Object.freeze({
    templateId: "graveyard_crypt",
    label: "Graveyard Crypt",
    type: "crypt",
    floors: 6,
    biome: "crypt",
    monsterTier: 0,
    lootTier: 1,
    questId: "starter.priest_fetch",
    targetDepth: 1,
    roomTarget: 6,
    content: Object.freeze({
      monsters: Object.freeze([{ id: "skeleton", count: 6 }]),
      traps: Object.freeze([]),
      features: Object.freeze(["urn", "urn", "sarcophagus"]),
      chests: Object.freeze([{ lootTable: "chest:basic" }]),
      books: Object.freeze(["book_dead"]),
    }),
    profile: Object.freeze({
      ...CATACOMB_PROFILE,
      id: "crypt",
      theme: "crypt",
      roomSparsity: 0.05,
      shopChance: 0,
      hallwayMonsterCap: 2,
      monsterFilter: (def) => {
        const id = String(def?.id || "");
        const tags = Array.isArray(def?.tags) ? def.tags : [];
        return id === "skeleton" || tags.includes("undead") || tags.includes("skeletal");
      },
      featurePool: Object.freeze(["urn", "sarcophagus", "torch", "chest"]),
    }),
  }),
  bear_cave: Object.freeze({
    templateId: "bear_cave",
    label: "Bear Cave",
    type: "cave",
    floors: 1,
    biome: "mushroom_cave",
    monsterTier: 1,
    lootTier: 1,
    questId: "",
    targetDepth: 1,
    roomTarget: 1,
    content: Object.freeze({
      monsters: Object.freeze([{ id: "cave_bear", count: 1 }]),
      traps: Object.freeze([]),
      features: Object.freeze(["glowcap_patch", "mushrooms", "mushrooms"]),
      chests: Object.freeze([{ lootTable: "chest:basic", fixedDrops: ["food_mushrooms"] }]),
    }),
    profile: Object.freeze({
      ...CAVE_PROFILE,
      id: "bear_cave",
      theme: "cave",
      bspMaxDepth: 2,
      minRoomSize: 7,
      maxRoomSize: 11,
      roomSparsity: 0.15,
      hallwayMonsterCap: 0,
      monsterFilter: (def) => String(def?.id || "") === "cave_bear",
      featurePool: Object.freeze(["glowcap_patch", "mushrooms", "chest"]),
    }),
  }),
  bat_cave: Object.freeze({
    templateId: "bat_cave",
    label: "Bat Cave",
    type: "cave",
    floors: 4,
    biome: "cavern",
    monsterTier: 0,
    lootTier: 1,
    questId: "",
    targetDepth: 1,
    roomTarget: 4,
    content: Object.freeze({
      monsters: Object.freeze([{ id: "bat", count: 9 }, { id: "flaming_bat", count: 1 }]),
      traps: Object.freeze([]),
      features: Object.freeze(["mushrooms", "glowcap_patch", "web_mote_cluster", "web_mote_cluster"]),
      chests: Object.freeze([{ lootTable: "chest:basic" }]),
    }),
    profile: Object.freeze({
      ...GROTTO_PROFILE,
      id: "bat_cave",
      theme: "cave",
      hallwayMonsterCap: 4,
      monsterFilter: (def) => {
        const id = String(def?.id || "");
        return id === "bat" || id === "flaming_bat";
      },
      featurePool: Object.freeze(["mushrooms", "glowcap_patch", "web_mote_cluster"]),
    }),
  }),
  human_mine: Object.freeze({
    templateId: "human_mine",
    label: "Human Mine",
    type: "mine",
    floors: 5,
    biome: "mine",
    monsterTier: 0,
    lootTier: 1,
    questId: "",
    targetDepth: 1,
    roomTarget: 5,
    content: Object.freeze({
      monsters: Object.freeze([]),
      npcs: Object.freeze([{ townfolkId: "miner", count: 2 }]),
      traps: Object.freeze([]),
      features: Object.freeze(["torch", "torch", "crate", "barrel", "harvest_iron_ore", "harvest_coal_ore", "harvest_stone"]),
      chests: Object.freeze([{ lootTable: "chest:basic", fixedDrops: ["ore_iron", "ore_coal"] }]),
    }),
    profile: Object.freeze({
      ...DEFAULT_PROFILE,
      id: "mine",
      theme: "mine",
      minRoomSize: 4,
      maxRoomSize: 8,
      roomSparsity: 0.25,
      doorChance: 0.1,
      hallwayMonsterCap: 1,
      featurePool: Object.freeze(["torch", "crate", "barrel", "chest"]),
    }),
  }),
  bandit_hideout: Object.freeze({
    templateId: "bandit_hideout",
    label: "Bandit Hideout",
    type: "hideout",
    floors: 4,
    biome: "hideout",
    monsterTier: 1,
    lootTier: 2,
    questId: "",
    targetDepth: 1,
    roomTarget: 4,
    content: Object.freeze({
      monsters: Object.freeze([{ id: "bandit", count: 3 }, { id: "bandit_archer", count: 2 }, { id: "bandit_captain", count: 1 }]),
      traps: Object.freeze([{ type: "arrow" }, { type: "spike" }]),
      features: Object.freeze(["torch", "crate", "barrel", "weapon_rack"]),
      chests: Object.freeze([{ lootTable: "chest:epic" }]),
    }),
    profile: Object.freeze({
      ...DEFAULT_PROFILE,
      id: "bandit_hideout",
      theme: "bandit",
      roomSparsity: 0.2,
      hallwayMonsterCap: 2,
      monsterFilter: (def) => {
        const id = String(def?.id || "");
        return id === "bandit" || id === "bandit_archer" || id === "bandit_captain";
      },
      featurePool: Object.freeze(["torch", "crate", "barrel", "weapon_rack", "chest"]),
    }),
  }),
  old_well: Object.freeze({
    templateId: "old_well",
    label: "Old Well",
    type: "well",
    floors: 2,
    biome: "wet_stone",
    monsterTier: 0,
    lootTier: 0,
    questId: "",
    targetDepth: 1,
    roomTarget: 2,
    content: Object.freeze({
      monsters: Object.freeze([{ id: "rat", count: 4 }, { id: "giant_frog", count: 1 }, { id: "cave_snake", count: 1 }]),
      traps: Object.freeze([]),
      features: Object.freeze(["mushrooms", "urn", "drain_throat"]),
      chests: Object.freeze([{ lootTable: "chest:basic" }]),
    }),
    profile: Object.freeze({
      ...DEFAULT_PROFILE,
      id: "old_well",
      theme: "sewer",
      minRoomSize: 3,
      maxRoomSize: 6,
      roomSparsity: 0.35,
      hallwayMonsterCap: 1,
      hazardBias: "water",
      monsterFilter: (def) => {
        const id = String(def?.id || "");
        return id === "rat" || id === "giant_frog" || id === "cave_snake";
      },
      featurePool: Object.freeze(["mushrooms", "urn", "chest"]),
    }),
  }),
  collapsed_cellar: Object.freeze({
    templateId: "collapsed_cellar",
    label: "Collapsed Cellar",
    type: "basement",
    floors: 2,
    biome: "cellar",
    monsterTier: 0,
    lootTier: 0,
    questId: "",
    targetDepth: 1,
    roomTarget: 2,
    content: Object.freeze({
      monsters: Object.freeze([{ id: "rat", count: 5 }]),
      traps: Object.freeze([]),
      features: Object.freeze(["torch", "barrel", "crate", "boulder"]),
      chests: Object.freeze([{ lootTable: "chest:basic" }]),
    }),
    profile: Object.freeze({
      ...DEFAULT_PROFILE,
      id: "collapsed_cellar",
      theme: "cellar",
      minRoomSize: 3,
      maxRoomSize: 6,
      roomSparsity: 0.45,
      doorChance: 0.25,
      hallwayMonsterCap: 1,
      monsterFilter: (def) => String(def?.id || "") === "rat",
      featurePool: Object.freeze(["barrel", "crate", "torch", "chest"]),
    }),
  }),
  wolf_den: Object.freeze({
    templateId: "wolf_den",
    label: "Wolf Den",
    type: "den",
    floors: 3,
    biome: "cave",
    monsterTier: 1,
    lootTier: 1,
    questId: "",
    targetDepth: 1,
    roomTarget: 3,
    content: Object.freeze({
      monsters: Object.freeze([{ id: "dire_wolf", count: 3 }]),
      traps: Object.freeze([]),
      features: Object.freeze(["bone_chime_rack", "mushrooms", "crate"]),
      chests: Object.freeze([{ lootTable: "chest:basic" }]),
    }),
    profile: Object.freeze({
      ...CAVE_PROFILE,
      id: "wolf_den",
      theme: "cave",
      roomSparsity: 0.25,
      hallwayMonsterCap: 1,
      monsterFilter: (def) => String(def?.id || "") === "dire_wolf",
      featurePool: Object.freeze(["bone_chime_rack", "mushrooms", "chest"]),
    }),
  }),
  forgotten_shrine: Object.freeze({
    templateId: "forgotten_shrine",
    label: "Forgotten Shrine",
    type: "shrine",
    floors: 2,
    biome: "shrine",
    monsterTier: 1,
    lootTier: 2,
    questId: "",
    targetDepth: 1,
    roomTarget: 2,
    content: Object.freeze({
      monsters: Object.freeze([{ id: "skeleton", count: 3 }, { id: "dark_acolyte", count: 1 }]),
      traps: Object.freeze([]),
      features: Object.freeze(["altar", "shrine", "statue", "candle_cluster"]),
      chests: Object.freeze([{ lootTable: "chest:epic" }]),
    }),
    profile: Object.freeze({
      ...ARENA_PROFILE,
      id: "forgotten_shrine",
      theme: "temple",
      minRoomSize: 5,
      maxRoomSize: 9,
      roomSparsity: 0.2,
      hallwayMonsterCap: 1,
      monsterFilter: (def) => {
        const id = String(def?.id || "");
        const tags = Array.isArray(def?.tags) ? def.tags : [];
        return id === "skeleton" || id === "dark_acolyte" || tags.includes("undead");
      },
      featurePool: Object.freeze(["altar", "shrine", "statue", "candle_cluster", "chest"]),
    }),
  }),
});

export function getUnderworldRegionTemplate(templateId) {
  return UNDERWORLD_REGION_TEMPLATES[String(templateId || "")] || null;
}

export function floorRegionKey(depth, anchorX = 0, anchorY = 0, templateId = "") {
  const d = Math.max(0, Number(depth || 0) | 0);
  if (d === 0) return "z0:overworld";
  const ax = Number(anchorX || 0) | 0;
  const ay = Number(anchorY || 0) | 0;
  const tid = String(templateId || "generic");
  return `z${d}:${ax},${ay}:${tid}`;
}
