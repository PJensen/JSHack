import { TownState } from "../components/TownState.js";
import { WeatherState } from "../components/WeatherState.js";

/**
 * Read the singleton TownState component instance.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @returns {any|null}
 */
export function getTownState(world) {
  for (const [, state] of world.query(TownState)) return state;
  return null;
}

/**
 * Read active weather key.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @returns {string}
 */
export function getWeather(world) {
  for (const [, ws] of world.query(WeatherState)) return String(ws.current || "clear");
  return "clear";
}
