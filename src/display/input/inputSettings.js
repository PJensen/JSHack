// display/input/inputSettings.js
// Persists input mode and walk-speed settings to localStorage.
// Display-only: no rules imports.

export const WALK_INTERVAL_MIN = 55;
export const WALK_INTERVAL_MAX = 555;
export const WALK_INTERVAL_DEFAULT = 180;

const LS_INPUT_MODE = 'jshack:inputMode';
const LS_WALK_SPEED = 'jshack:walkSpeed'; // legacy
const LS_WALK_INTERVAL = 'jshack:walkInterval';

function lsGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function lsSet(key, val) {
  try { localStorage.setItem(key, String(val)); } catch {}
}

function clampWalkInterval(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return WALK_INTERVAL_DEFAULT;
  const i = n | 0;
  return Math.max(WALK_INTERVAL_MIN, Math.min(WALK_INTERVAL_MAX, i));
}

/**
 * @returns {'walk'|'gesture'|'joystick'}
 */
export function readInputMode() {
  const mode = lsGet(LS_INPUT_MODE);
  if (mode === 'gesture' || mode === 'joystick') return mode;
  return 'walk';
}

/**
 * Returns the repeat interval in ms for the current walk-speed preset.
 * @returns {number}
 */
export function readWalkInterval() {
  const raw = lsGet(LS_WALK_INTERVAL);
  if (raw != null) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) return clampWalkInterval(parsed);
  }

  const legacy = lsGet(LS_WALK_SPEED);
  if (legacy === 'slow') return 444;
  if (legacy === 'normal') return 222;
  if (legacy === 'fast') return 111;

  return WALK_INTERVAL_DEFAULT;
}

/**
 * @param {'walk'|'gesture'|'joystick'} mode
 */
export function writeInputMode(mode) {
  lsSet(LS_INPUT_MODE, (mode === 'walk' || mode === 'gesture' || mode === 'joystick') ? mode : 'walk');
}

/**
 * @param {number} intervalMs
 */
export function writeWalkInterval(intervalMs) {
  lsSet(LS_WALK_INTERVAL, clampWalkInterval(intervalMs));
}
