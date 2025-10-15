import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Name component representing the name of an entity.
 * @property {string} name - The name of the entity used for display purposes.
 * @property {string} class - The classification of the entity (used by the engine).
 */
export const NamedIdentity = defineComponent("NamedIdentity",
    {
        name: "Unnamed",
        identity: (p)=> p.identity ?? p.name.toLowerCase().replace(/\s+/g, "-")
    }, {
    validate() {
        return typeof this.name === "string" && this.name.length > 0;
    }
});