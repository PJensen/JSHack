import { defineTag } from "../../lib/ecs-js/index.js";

/**
 * EquipmentRoot is the hidden hierarchy root for an actor's equipped slots.
 *
 * Preferred topology:
 * actor -> EquipmentRoot -> EquippedSlotNode(slot) -> item
 */
export const EquipmentRoot = defineTag("EquipmentRoot");
