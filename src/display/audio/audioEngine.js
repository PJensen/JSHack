// Audio engine — lazy Web Audio API context with master volume control.
// All game sounds are synthesized (no audio files).

let _ctx = null;
let _master = null;
let _muted = false;
let _volume = 0.35;

/** @returns {AudioContext} */
function ctx() {
  if (!_ctx) {
    _ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
  }
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

/** @returns {GainNode} */
function master() {
  if (!_master) {
    _master = ctx().createGain();
    _master.gain.value = _muted ? 0 : _volume;
    _master.connect(ctx().destination);
  }
  return _master;
}

// ── Public API ──────────────────────────────────────────────

/** Set master volume (0–1). */
export function setVolume(v) {
  _volume = Math.max(0, Math.min(1, v));
  if (_master) _master.gain.value = _muted ? 0 : _volume;
}

export function getVolume() { return _volume; }

export function setMuted(m) {
  _muted = !!m;
  if (_master) _master.gain.value = _muted ? 0 : _volume;
}

export function isMuted() { return _muted; }

/**
 * Play a registered sound.
 * @param {(ac: AudioContext, dest: GainNode, opts?: object) => void} soundFn
 * @param {object} [opts] — forwarded to the sound function
 */
export function play(soundFn, opts) {
  if (_muted) return;
  try {
    soundFn(ctx(), master(), opts);
  } catch (_) {
    // Web Audio not available — silent fail
  }
}

// ── Shared synthesis helpers ────────────────────────────────

/**
 * Play a single tone with attack/release envelope.
 */
export function tone(ac, freq, start, dur, type, gain, dest) {
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;

  const t0 = ac.currentTime + start;
  const attack = 0.015;
  const release = Math.min(dur * 0.4, 0.2);
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(gain, t0 + attack);
  env.gain.setValueAtTime(gain, t0 + dur - release);
  env.gain.linearRampToValueAtTime(0, t0 + dur);

  osc.connect(env);
  env.connect(dest);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/**
 * White noise burst — useful for impacts, footsteps, etc.
 */
export function noiseBurst(ac, start, dur, gain, dest) {
  const bufSize = Math.ceil(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const src = ac.createBufferSource();
  src.buffer = buf;

  const env = ac.createGain();
  const t0 = ac.currentTime + start;
  env.gain.setValueAtTime(gain, t0);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  src.connect(env);
  env.connect(dest);
  src.start(t0);
  src.stop(t0 + dur + 0.01);
}
