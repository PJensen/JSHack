import { defineComponent } from "../../../lib/ecs-js/index.js";

/**
 * SearchIntent — actor performs a radial search of the area.
 * Reveals hidden entities (traps, etc.) within their vision radius.
 * Consumes one turn.
 */
export const SearchIntent = defineComponent("SearchIntent", {});
