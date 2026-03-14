// src/rules/data/calendar.js
// Single source of truth for all time / calendar constants.
//
// TUNING: change TURNS_PER_DAY and everything downstream recalculates.
// One turn ≈ one combat action (a sword swing). Derive real-world time
// from that assumption when tuning.

// ── Master tunable ──────────────────────────────────────────────────
export const TURNS_PER_DAY = 132;

// ── Calendar structure ──────────────────────────────────────────────
export const DAYS_PER_WEEK   = 7;
export const DAYS_PER_MONTH  = 28;   // lunar cycle
export const MONTHS_PER_YEAR = 13;

// ── Derived (never edit — change the constants above) ───────────────
export const DAYS_PER_YEAR   = DAYS_PER_MONTH * MONTHS_PER_YEAR;  // 364
export const TURNS_PER_WEEK  = TURNS_PER_DAY * DAYS_PER_WEEK;
export const TURNS_PER_MONTH = TURNS_PER_DAY * DAYS_PER_MONTH;
export const TURNS_PER_YEAR  = TURNS_PER_DAY * DAYS_PER_YEAR;

// ── Day-of-week names (7-day archaic week) ──────────────────────────
export const DAY_NAMES = Object.freeze([
  "Sunna",
  "Máni",
  "Týr",
  "Odin",
  "Thor",
  "Frigg",
  "Saturn",
]);

// ── Seasons ─────────────────────────────────────────────────────────
export const SEASONS = Object.freeze(["spring", "summer", "autumn", "winter"]);

// ── Month definitions (13 lunar months) ─────────────────────────────
// 4 seasons × 3 months + 1 intercalary month ("Mercedonius") at year-end.
export const MONTHS = Object.freeze([
  { name: "Martius",     season: "spring" },
  { name: "Aprilis",     season: "spring" },
  { name: "Maius",       season: "spring" },
  { name: "Iunius",      season: "summer" },
  { name: "Quintilis",   season: "summer" },
  { name: "Sextilis",    season: "summer" },
  { name: "September",   season: "autumn" },
  { name: "October",     season: "autumn" },
  { name: "November",    season: "autumn" },
  { name: "December",    season: "winter" },
  { name: "Ianuarius",   season: "winter" },
  { name: "Februarius",  season: "winter" },
  { name: "Mercedonius", season: "winter" },  // intercalary 13th month
]);

// ── Town-day phase proportions ──────────────────────────────────────
// Expressed as fractions of TURNS_PER_DAY so a single constant change
// rescales the whole schedule.  Fractions must sum to 1.
const PHASE_FRACTIONS = Object.freeze({
  sleep:     18 / TURNS_PER_DAY,
  breakfast:  8 / TURNS_PER_DAY,
  work:      72 / TURNS_PER_DAY,
  pub:       22 / TURNS_PER_DAY,
  home:      12 / TURNS_PER_DAY,
});

// Absolute turn counts (derived from TURNS_PER_DAY × fraction).
function buildPhaseTurns() {
  const raw = {};
  let total = 0;
  const keys = Object.keys(PHASE_FRACTIONS);
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    const v = Math.round(TURNS_PER_DAY * PHASE_FRACTIONS[k]);
    raw[k] = v;
    total += v;
  }
  // Last phase absorbs rounding remainder.
  const last = keys[keys.length - 1];
  raw[last] = TURNS_PER_DAY - total;
  return Object.freeze(raw);
}

export const PHASE_TURNS = buildPhaseTurns();

// Phase boundaries as cumulative turn offsets within a day.
function buildPhaseBounds() {
  const bounds = [];
  let cum = 0;
  for (const [phase, turns] of Object.entries(PHASE_TURNS)) {
    bounds.push({ phase, start: cum, end: cum + turns });
    cum += turns;
  }
  return Object.freeze(bounds);
}

export const PHASE_BOUNDS = buildPhaseBounds();

// ── Public helpers ──────────────────────────────────────────────────

/**
 * Resolve the town-day phase from a raw world.step.
 * Drop-in replacement for the old getTownPhase() in aiTownfolkSystem.
 */
export function getTownPhase(step) {
  const t = Math.max(0, step | 0) % TURNS_PER_DAY;
  for (const b of PHASE_BOUNDS) {
    if (t < b.end) return b.phase;
  }
  return PHASE_BOUNDS[PHASE_BOUNDS.length - 1].phase;
}

/**
 * Derive a full calendar date from a raw turn count.
 *
 * @param {number} step       world.step
 * @param {number} startDay   day-of-year offset the game began on (0-based)
 * @param {number} startYear  flavour year number
 * @returns {{
 *   dayTotal:    number,
 *   dayOfWeek:   number,
 *   dayOfMonth:  number,
 *   monthIndex:  number,
 *   year:        number,
 *   season:      string,
 *   dayName:     string,
 *   monthName:   string,
 *   phase:       string,
 *   formatted:   string,
 * }}
 */
export function getCalendarDate(step, startDay = 0, startYear = 1) {
  const dayTotal  = Math.floor(Math.max(0, step) / TURNS_PER_DAY) + startDay;
  const dayOfWeek = dayTotal % DAYS_PER_WEEK;

  const yearDays  = dayTotal % DAYS_PER_YEAR;
  const yearNum   = startYear + Math.floor(dayTotal / DAYS_PER_YEAR);

  const monthIndex = Math.floor(yearDays / DAYS_PER_MONTH);
  const dayOfMonth = (yearDays % DAYS_PER_MONTH);  // 0-based

  const month  = MONTHS[monthIndex];
  const phase  = getTownPhase(step);

  const dayName   = DAY_NAMES[dayOfWeek];
  const monthName = month.name;
  const season    = month.season;

  // "Týr, 14th of September — Year 847"
  const ordinal   = ordinalSuffix(dayOfMonth + 1);
  const formatted = `${dayName}, ${ordinal} of ${monthName} — Year ${yearNum}`;

  return {
    dayTotal,
    dayOfWeek,
    dayOfMonth,
    monthIndex,
    year: yearNum,
    season,
    dayName,
    monthName,
    phase,
    formatted,
  };
}

function ordinalSuffix(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
