// src/rules/components/Interactable.js
import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Interactable — declarative affordance tag for useable entities.
 *
 * Fields:
 * - action: string key for systems to route behavior (e.g. "toggleDoor", "openChest", "readSign")
 * - params: optional arbitrary data bag (e.g. { textId: 12, requiredItem: "key01" })
 * - callback: optional function to be invoked when the action is performed. (experimental)
 *
 * Systems:
 *   InteractionSystem(world, actor, target)
 *   looks up Interactable.action and dispatches the rule.
 */
export const Interactable = defineComponent(
    "Interactable", 
    { action: "", params: null, callback: null },
    {
        validate(rec) {
            if (typeof rec.action !== "string" || !rec.action)
                throw new Error("Interactable.action required");
            if (rec.params != null && typeof rec.params !== "object")
                throw new Error("Interactable.params must be object or null");
            if (rec.callback != null && typeof rec.callback !== "function")
                throw new Error("Interactable.callback must be function or null");
            return true;
        },
    }
);