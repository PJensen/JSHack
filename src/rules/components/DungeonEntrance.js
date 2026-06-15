import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Authorship metadata for an overworld entrance into the one underworld.
 * This is generation/provenance data, not a durable dungeon boundary.
 */
export const DungeonEntrance = defineComponent("DungeonEntrance", {
  templateId: "",
  label: "",
  type: "",
  length: 0,
  biome: "",
  monsterTier: 0,
  lootTier: 0,
  questId: "",
  targetDepth: 1,
  anchorX: 0,
  anchorY: 0,
});
