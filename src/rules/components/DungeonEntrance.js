import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Authorship metadata for an overworld entrance into the one underworld.
 * This is generation/provenance data, not a durable dungeon boundary.
 */
export const DungeonEntrance = defineComponent("DungeonEntrance", {
  templateId: "",
  label: "",
  type: "",
  floors: 0,
  biome: "",
  monsterTier: 0,
  lootTier: 0,
  questId: "",
  lockId: "",
  lockDifficulty: "",
  targetDepth: 1,
  anchorX: 0,
  anchorY: 0,
});
