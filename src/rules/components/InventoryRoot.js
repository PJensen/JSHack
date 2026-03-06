import { defineTag } from "../../lib/ecs-js/index.js";

/**
 * InventoryRoot — hidden hierarchy root for an entity's inventory contents.
 *
 * This is not a gameplay bag item. It is the structural root that keeps
 * inventory containment uniformly two levels deep: owner -> root -> item.
 */
export const InventoryRoot = defineTag("InventoryRoot");
