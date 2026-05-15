import { getTownPhase } from "./calendar.js";

const SLEEP_PROFILES = Object.freeze({
  roosting: Object.freeze({
    wakeDifficulty: 5,
    wakeRadius: 2,
    wakeOnDamage: true,
  }),
  nocturnal_roost: Object.freeze({
    wakeDifficulty: 5,
    wakeRadius: 2,
    wakeOnDamage: true,
  }),
  dormant: Object.freeze({
    wakeDifficulty: 4,
    wakeRadius: 1,
    wakeOnDamage: true,
  }),
  ancient: Object.freeze({
    wakeDifficulty: 14,
    wakeRadius: 3,
    wakeOnDamage: true,
  }),
  diurnal: Object.freeze({
    wakeDifficulty: 7,
    wakeRadius: 2,
    wakeOnDamage: true,
    restPhases: Object.freeze(["home", "sleep"]),
  }),
  nocturnal: Object.freeze({
    wakeDifficulty: 7,
    wakeRadius: 2,
    wakeOnDamage: true,
    restPhases: Object.freeze(["breakfast", "work", "pub"]),
  }),
  crepuscular: Object.freeze({
    wakeDifficulty: 7,
    wakeRadius: 2,
    wakeOnDamage: true,
    restPhases: Object.freeze(["sleep", "work"]),
  }),
  cathemeral: Object.freeze({
    wakeDifficulty: 6,
    wakeRadius: 2,
    wakeOnDamage: true,
  }),
});

const SLEEP_CONTEXT_OVERRIDES = Object.freeze({
  diurnal_den: Object.freeze({
    wakeDifficulty: 8,
    wakeRadius: 2,
    wakeOnDamage: true,
    restPhases: Object.freeze(["home", "sleep"]),
  }),
});

function normalizeSleepChance(value, fallback = 1) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, Number(value)));
}

/**
 * Resolve high-level sleep authoring into SleepState construction data.
 *
 * Authoring accepts:
 *   sleep: "roosting"
 *   sleep: { pattern: "roosting", chance: 0.45 }
 *   sleep: { pattern: "nocturnal", context: "roost", chance: 0.45 }
 *
 * @param {string|{pattern?:string,context?:string,chance?:number}|null|undefined|false} sleep
 * @returns {{ chance:number, wakeDifficulty:number, wakeRadius:number, wakeOnDamage:boolean, restPhases:string[]|null }|null}
 */
export function resolveSleepProfile(sleep) {
  if (!sleep) return null;

  const pattern = typeof sleep === "string"
    ? sleep
    : String(sleep.pattern || "").trim();
  const context = typeof sleep === "object" ? String(sleep.context || "").trim() : "";
  const profileId = context ? `${pattern}_${context}` : pattern;
  const base = SLEEP_CONTEXT_OVERRIDES[profileId] || SLEEP_PROFILES[profileId] || SLEEP_PROFILES[pattern];
  if (!base) return null;

  const chance = normalizeSleepChance(typeof sleep === "object" ? sleep.chance : undefined, 1);
  return {
    chance,
    wakeDifficulty: base.wakeDifficulty,
    wakeRadius: base.wakeRadius,
    wakeOnDamage: base.wakeOnDamage,
    restPhases: Array.isArray(base.restPhases) ? base.restPhases : null,
  };
}

export function listSleepProfileIds() {
  return [...Object.keys(SLEEP_PROFILES), ...Object.keys(SLEEP_CONTEXT_OVERRIDES)];
}

/**
 * @param {string|{pattern?:string,context?:string,chance?:number}|null|undefined|false} sleep
 * @param {number} step
 * @returns {boolean|null} true = should sleep now, false = should wake now, null = no time schedule
 */
export function resolveSleepScheduleNow(sleep, step) {
  const resolved = resolveSleepProfile(sleep);
  if (!resolved || !Array.isArray(resolved.restPhases)) return null;
  return resolved.restPhases.includes(getTownPhase(step));
}
