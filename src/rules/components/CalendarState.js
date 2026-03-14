import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * CalendarState — singleton component tracking in-game calendar.
 *
 * Attach once to the world entity.  calendarSystem reads world.step and
 * derives the full date; cached fields let it detect day/month/season
 * transitions and emit events.
 *
 * startDay / startYear are set at game init and never change.
 * The remaining fields are written every tick by calendarSystem.
 */
export const CalendarState = defineComponent("CalendarState", {
  startDay:   56,   // day-of-year offset (0-based); 56 = 1st of Maius (late spring)
  startYear:  847,

  // Cache — written by calendarSystem each tick
  dayTotal:    0,
  monthIndex:  0,
  season:      "",
  year:        0,
});
