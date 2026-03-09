import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * WeatherState — singleton component tracking overworld weather.
 *
 * The weatherSystem ticks this each turn on depth 0, decrementing
 * turnsRemaining and rolling for transitions via world.rand().
 *
 * Fields:
 *   current           — current weather type ("clear" | "rain" | "heavy_rain")
 *   turnsRemaining    — turns left in current weather phase
 *   transitionCooldown — minimum turns before next weather change can occur
 */
export const WeatherState = defineComponent("WeatherState", {
  current: "clear",
  turnsRemaining: 0,
  transitionCooldown: 0,
});
