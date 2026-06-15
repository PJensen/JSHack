import { DEFAULT_PROFILE } from "./profiles/default.js";
import { CATACOMB_PROFILE } from "./profiles/catacombs.js";

export const UNDERWORLD_REGION_TEMPLATES = Object.freeze({
  tavern_basement: Object.freeze({
    templateId: "tavern_basement",
    label: "Tavern Basement",
    type: "basement",
    length: 3,
    biome: "cellar",
    monsterTier: 0,
    lootTier: 0,
    questId: "starter.rat_infestation",
    targetDepth: 1,
    roomTarget: 3,
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
    length: 6,
    biome: "crypt",
    monsterTier: 0,
    lootTier: 1,
    questId: "starter.priest_fetch",
    targetDepth: 1,
    roomTarget: 6,
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
