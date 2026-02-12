import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Engraving component — marks an entity as a ground engraving.
 * Engravings are entities with Position + NamedIdentity + Engraving,
 * placed on the dungeon floor by actors.
 *
 * @property {string} text   - The engraved message (short, player-authored).
 * @property {number} author - Entity id of the actor who created it.
 * @property {number} turn   - World step when the engraving was made.
 */
export const Engraving = defineComponent("Engraving", {
  text: "",
  author: 0,
  turn: 0,
});
