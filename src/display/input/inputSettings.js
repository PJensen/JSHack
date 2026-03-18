// display/input/inputSettings.js
// Persists input mode and walk-speed settings to localStorage.
// Display-only: no rules imports.

/** Walk-speed presets: label → repeat interval in milliseconds */
export const WALK_SPEED_PRESETS = Object.freeze({
  slow:   1000,
  normal: 555,
  fast:   333,
});

const LS_INPUT_MODE = 'jshack:inputMode';
const LS_WALK_SPEED = 'jshack:walkSpeed';

function lsGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function lsSet(key, val) {
  try { localStorage.setItem(key, String(val)); } catch {}
}

/**
 * @returns {'walk'|'gesture'}
 */
export function readInputMode() {
  return lsGet(LS_INPUT_MODE) === 'walk' ? 'walk' : 'gesture';
}

/**
 * @returns {'slow'|'normal'|'fast'}
 */
export function readWalkSpeed() {
  const v = lsGet(LS_WALK_SPEED);
  return (v === 'slow' || v === 'fast') ? v : 'normal';
}

/**
 * Returns the repeat interval in ms for the current walk-speed preset.
 * @returns {number}
 */
export function readWalkInterval() {
  return WALK_SPEED_PRESETS[readWalkSpeed()];
}

/**
 * @param {'walk'|'gesture'} mode
 */
export function writeInputMode(mode) {
  lsSet(LS_INPUT_MODE, mode === 'walk' ? 'walk' : 'gesture');
}

/**
 * @param {'slow'|'normal'|'fast'} preset
 */
export function writeWalkSpeed(preset) {
  const valid = Object.keys(WALK_SPEED_PRESETS);
  lsSet(LS_WALK_SPEED, valid.includes(preset) ? preset : 'normal');
}
