const SLEEP_PROFILES = Object.freeze({
  roosting: Object.freeze({
    wakeDifficulty: 5,
    wakeRadius: 2,
    wakeOnDamage: true,
  }),
  ancient: Object.freeze({
    wakeDifficulty: 14,
    wakeRadius: 3,
    wakeOnDamage: true,
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
 *
 * @param {string|{pattern?:string,chance?:number}|null|undefined|false} sleep
 * @returns {{ chance:number, wakeDifficulty:number, wakeRadius:number, wakeOnDamage:boolean }|null}
 */
export function resolveSleepProfile(sleep) {
  if (!sleep) return null;

  const pattern = typeof sleep === "string"
    ? sleep
    : String(sleep.pattern || "").trim();
  const base = SLEEP_PROFILES[pattern];
  if (!base) return null;

  const chance = normalizeSleepChance(typeof sleep === "object" ? sleep.chance : undefined, 1);
  return {
    chance,
    wakeDifficulty: base.wakeDifficulty,
    wakeRadius: base.wakeRadius,
    wakeOnDamage: base.wakeOnDamage,
  };
}

export function listSleepProfileIds() {
  return Object.keys(SLEEP_PROFILES);
}
