import { CalendarState } from "../components/CalendarState.js";

/**
 * Ensure the world has a calendar singleton.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {{ startDay?: number, startYear?: number }} [overrides]
 * @returns {number}
 */
export function ensureCalendarState(world, overrides = {}) {
  for (const [id] of world.query(CalendarState)) return id;

  const id = world.create();
  world.add(id, CalendarState, {
    startDay: 56,
    startYear: 847,
    ...overrides,
  });
  return id;
}
