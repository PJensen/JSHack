// src/rules/systems/calendarSystem.js
// Derives calendar date from world.step each tick.
// Emits transition events so other systems can react without polling.

import { CalendarState } from "../components/CalendarState.js";
import { getCalendarDate } from "../data/calendar.js";

/**
 * calendarSystem — effects phase, should run early (before weather).
 *
 * Events emitted:
 *   calendar:newDay    { prev: number, next: number }        (dayTotal)
 *   calendar:newMonth  { prev: number, next: number, name }  (monthIndex)
 *   calendar:newSeason { prev: string, next: string }
 *   calendar:newYear   { prev: number, next: number }
 */
export function calendarSystem(world) {
  for (const [, cs] of world.query(CalendarState)) {
    const date = getCalendarDate(world.step, cs.startDay, cs.startYear);

    const prevDay    = cs.dayTotal;
    const prevMonth  = cs.monthIndex;
    const prevSeason = cs.season;
    const prevYear   = cs.year;

    // Update cache
    cs.dayTotal    = date.dayTotal;
    cs.monthIndex  = date.monthIndex;
    cs.season      = date.season;
    cs.year        = date.year;

    // First tick initialisation — no events
    if (prevSeason === "") continue;

    if (date.dayTotal !== prevDay) {
      world.emit("calendar:newDay", { prev: prevDay, next: date.dayTotal });
    }
    if (date.monthIndex !== prevMonth) {
      world.emit("calendar:newMonth", {
        prev: prevMonth,
        next: date.monthIndex,
        name: date.monthName,
      });
    }
    if (date.season !== prevSeason) {
      world.emit("calendar:newSeason", { prev: prevSeason, next: date.season });
    }
    if (date.year !== prevYear) {
      world.emit("calendar:newYear", { prev: prevYear, next: date.year });
    }
  }
}
