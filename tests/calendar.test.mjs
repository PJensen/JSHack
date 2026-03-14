// tests/calendar.test.mjs
// Calendar data helpers + calendarSystem event emission.

import { assertEquals, assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { CalendarState } from '../src/rules/components/CalendarState.js';
import { calendarSystem } from '../src/rules/systems/calendarSystem.js';
import { ensureCalendarState } from '../src/rules/utils/calendarState.js';
import {
  TURNS_PER_DAY,
  DAYS_PER_WEEK,
  DAYS_PER_MONTH,
  MONTHS_PER_YEAR,
  DAYS_PER_YEAR,
  DAY_NAMES,
  MONTHS,
  PHASE_TURNS,
  MOON_PHASES,
  getMoonPhase,
  getTownPhase,
  getCalendarDate,
} from '../src/rules/data/calendar.js';

// ── Pure-function tests ─────────────────────────────────────────────

Deno.test("DAYS_PER_YEAR equals DAYS_PER_MONTH * MONTHS_PER_YEAR (364)", () => {
  assertEquals(DAYS_PER_YEAR, DAYS_PER_MONTH * MONTHS_PER_YEAR);
  assertEquals(DAYS_PER_YEAR, 364);
});

Deno.test("PHASE_TURNS sum equals TURNS_PER_DAY", () => {
  let sum = 0;
  for (const v of Object.values(PHASE_TURNS)) sum += v;
  assertEquals(sum, TURNS_PER_DAY);
});

Deno.test("DAY_NAMES has DAYS_PER_WEEK entries", () => {
  assertEquals(DAY_NAMES.length, DAYS_PER_WEEK);
});

Deno.test("MONTHS has MONTHS_PER_YEAR entries", () => {
  assertEquals(MONTHS.length, MONTHS_PER_YEAR);
});

Deno.test("MOON_PHASES exposes the 8 unicode moon glyphs", () => {
  assertEquals(MOON_PHASES.length, 8);
  assertEquals(MOON_PHASES[0].emoji, "🌑");
  assertEquals(MOON_PHASES[4].emoji, "🌕");
});

Deno.test("getTownPhase returns sleep at step 0", () => {
  assertEquals(getTownPhase(0), "sleep");
});

Deno.test("getTownPhase cycles through all 5 phases within one day", () => {
  const seen = new Set();
  for (let t = 0; t < TURNS_PER_DAY; t++) {
    seen.add(getTownPhase(t));
  }
  assertEquals(seen.size, 5);
  for (const p of ["sleep", "breakfast", "work", "pub", "home"]) {
    assert(seen.has(p), `missing phase: ${p}`);
  }
});

Deno.test("getTownPhase wraps around after TURNS_PER_DAY", () => {
  assertEquals(getTownPhase(0), getTownPhase(TURNS_PER_DAY));
  assertEquals(getTownPhase(1), getTownPhase(TURNS_PER_DAY + 1));
});

Deno.test("getCalendarDate: step 0 with startDay=0, startYear=1 gives day 0, month 0, year 1", () => {
  const d = getCalendarDate(0, 0, 1);
  assertEquals(d.dayTotal, 0);
  assertEquals(d.dayOfWeek, 0);
  assertEquals(d.dayOfMonth, 0);
  assertEquals(d.monthIndex, 0);
  assertEquals(d.year, 1);
  assertEquals(d.dayName, "Sunna");
  assertEquals(d.monthName, "Martius");
  assertEquals(d.season, "spring");
});

Deno.test("getCalendarDate: one full day advances dayTotal by 1", () => {
  const d = getCalendarDate(TURNS_PER_DAY, 0, 1);
  assertEquals(d.dayTotal, 1);
  assertEquals(d.dayOfWeek, 1);
  assertEquals(d.dayName, "Máni");
});

Deno.test("getCalendarDate: after 28 days we are in month index 1", () => {
  const d = getCalendarDate(TURNS_PER_DAY * 28, 0, 1);
  assertEquals(d.monthIndex, 1);
  assertEquals(d.monthName, "Aprilis");
  assertEquals(d.dayOfMonth, 0);
});

Deno.test("getCalendarDate: after 364 days the year increments", () => {
  const d = getCalendarDate(TURNS_PER_DAY * 364, 0, 847);
  assertEquals(d.year, 848);
  assertEquals(d.monthIndex, 0);
  assertEquals(d.dayOfMonth, 0);
});

Deno.test("getCalendarDate: startDay offsets the calendar", () => {
  // startDay=56 means game starts on day 56 of the year (first of Maius)
  const d = getCalendarDate(0, 56, 847);
  assertEquals(d.dayTotal, 56);
  assertEquals(d.monthIndex, 2);  // 56/28 = 2
  assertEquals(d.monthName, "Maius");
});

Deno.test("getCalendarDate: formatted string includes ordinal", () => {
  const d = getCalendarDate(0, 0, 847);
  assertEquals(d.formatted, "Sunna, 1st of Martius — Year 847");
});

Deno.test("getMoonPhase follows the 28-day lunar month", () => {
  assertEquals(getMoonPhase(0).key, "new");
  assertEquals(getMoonPhase(3).key, "new");
  assertEquals(getMoonPhase(4).key, "waxing_crescent");
  assertEquals(getMoonPhase(14).key, "full");
  assertEquals(getMoonPhase(27).key, "waning_crescent");
});

Deno.test("getCalendarDate includes moon metadata", () => {
  const d = getCalendarDate(TURNS_PER_DAY * 14, 0, 847);
  assertEquals(d.moonPhase, "full");
  assertEquals(d.moonEmoji, "🌕");
  assertEquals(d.moonLabel, "Full Moon");
});

Deno.test("getCalendarDate: ordinals (2nd, 3rd, 11th, 21st)", () => {
  const d2 = getCalendarDate(TURNS_PER_DAY * 1, 0, 1);
  assert(d2.formatted.includes("2nd"), d2.formatted);
  const d3 = getCalendarDate(TURNS_PER_DAY * 2, 0, 1);
  assert(d3.formatted.includes("3rd"), d3.formatted);
  const d11 = getCalendarDate(TURNS_PER_DAY * 10, 0, 1);
  assert(d11.formatted.includes("11th"), d11.formatted);
  const d21 = getCalendarDate(TURNS_PER_DAY * 20, 0, 1);
  assert(d21.formatted.includes("21st"), d21.formatted);
});

// ── System integration tests ────────────────────────────────────────

function makeWorld(seed = 1) {
  const world = new World({ seed });
  const e = world.create();
  world.add(e, CalendarState, { startDay: 0, startYear: 847 });
  world.step = 0;
  return world;
}

Deno.test("calendarSystem initialises cache on first tick (no events)", () => {
  const world = makeWorld();
  const events = [];
  world.on("calendar:newDay", (e) => events.push(e));
  world.on("calendar:newMonth", (e) => events.push(e));
  world.on("calendar:newSeason", (e) => events.push(e));

  calendarSystem(world);

  // Cache should be populated
  for (const [, cs] of world.query(CalendarState)) {
    assertEquals(cs.dayTotal, 0);
    assertEquals(cs.season, "spring");
    assertEquals(cs.year, 847);
  }
  // No transition events on first tick
  assertEquals(events.length, 0);
});

Deno.test("calendarSystem emits calendar:newDay when day changes", () => {
  const world = makeWorld();
  calendarSystem(world);  // init

  const dayEvents = [];
  world.on("calendar:newDay", (e) => dayEvents.push(e));

  // Advance to next day
  world.step = TURNS_PER_DAY;
  calendarSystem(world);

  assertEquals(dayEvents.length, 1);
  assertEquals(dayEvents[0].prev, 0);
  assertEquals(dayEvents[0].next, 1);
});

Deno.test("calendarSystem emits calendar:newMonth on month boundary", () => {
  const world = makeWorld();
  calendarSystem(world);  // init at day 0

  const monthEvents = [];
  world.on("calendar:newMonth", (e) => monthEvents.push(e));

  // Jump to day 28 (first day of month 1)
  world.step = TURNS_PER_DAY * 28;
  calendarSystem(world);

  assertEquals(monthEvents.length, 1);
  assertEquals(monthEvents[0].prev, 0);
  assertEquals(monthEvents[0].next, 1);
  assertEquals(monthEvents[0].name, "Aprilis");
});

Deno.test("calendarSystem emits calendar:newSeason on season boundary", () => {
  const world = makeWorld();
  calendarSystem(world);  // init at month 0 (spring)

  const seasonEvents = [];
  world.on("calendar:newSeason", (e) => seasonEvents.push(e));

  // Jump to day 84 (month 3 = Iunius = summer)
  world.step = TURNS_PER_DAY * 84;
  calendarSystem(world);

  assertEquals(seasonEvents.length, 1);
  assertEquals(seasonEvents[0].prev, "spring");
  assertEquals(seasonEvents[0].next, "summer");
});

Deno.test("calendarSystem emits calendar:newYear when year rolls over", () => {
  const world = makeWorld();
  calendarSystem(world);  // init

  const yearEvents = [];
  world.on("calendar:newYear", (e) => yearEvents.push(e));

  world.step = TURNS_PER_DAY * 364;
  calendarSystem(world);

  assertEquals(yearEvents.length, 1);
  assertEquals(yearEvents[0].prev, 847);
  assertEquals(yearEvents[0].next, 848);
});

Deno.test("ensureCalendarState creates one singleton and reuses it", () => {
  const world = new World({ seed: 1 });
  const first = ensureCalendarState(world);
  const second = ensureCalendarState(world);

  assertEquals(second, first);

  const rows = Array.from(world.query(CalendarState));
  assertEquals(rows.length, 1);
  assertEquals(rows[0][0], first);
  assertEquals(rows[0][1].startDay, 56);
  assertEquals(rows[0][1].startYear, 847);
});
