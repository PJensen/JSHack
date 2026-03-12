import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * GemSocketNode — marker component for gem-authored socket proc nodes.
 * Attached as a child of a weapon/armor entity when a gem is socketed.
 * Distinguishes gem-authored topology from affix-generated AffixTopologyNode children.
 */
export const GemSocketNode = defineComponent("GemSocketNode", {
  gemId: "", // e.g. 'gem_ruby'
});
