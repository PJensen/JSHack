// Audio engine — loads and plays real audio files (.wav, .mp3, .mp4) via Web Audio API.
// Decoded buffers are cached so each file is fetched only once.
//
// Routing:  BufferSource → per-sound GainNode → bus GainNode → master GainNode → destination
//
// Buses:    combat, spells, items, ambient, ui  (each independently adjustable)
// Polyphony: max concurrent plays per URL, oldest voice is killed when cap is hit.

let _ctx = null;
let _master = null;
let _muted = false;
let _volume = 0.5;

/** Map<string, AudioBuffer> — decoded file cache keyed by URL. */
const _cache = new Map();

/** Map<string, Promise<AudioBuffer|null>> — in-flight loads. */
const _loading = new Map();

// ── Internals ───────────────────────────────────────────────

/** @returns {AudioContext} */
function ctx() {
  if (!_ctx) {
    _ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
  }
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

/** @returns {GainNode} */
function masterGain() {
  if (!_master) {
    _master = ctx().createGain();
    _master.gain.value = _muted ? 0 : _volume;
    _master.connect(ctx().destination);
  }
  return _master;
}

// ── Category buses ──────────────────────────────────────────

/** @type {Map<string, GainNode>} */
const _buses = new Map();

const BUS_DEFAULTS = {
  combat:  1.0,
  spells:  1.0,
  items:   0.8,
  ambient: 0.6,
  ui:      1.0,
};

/**
 * Get (or lazily create) a category bus GainNode.
 * @param {string} name
 * @returns {GainNode}
 */
function bus(name) {
  if (_buses.has(name)) return _buses.get(name);
  const g = ctx().createGain();
  g.gain.value = BUS_DEFAULTS[name] ?? 1.0;
  g.connect(masterGain());
  _buses.set(name, g);
  return g;
}

/**
 * Set volume for a category bus (0–1).
 * @param {string} name — "combat" | "spells" | "items" | "ambient" | "ui"
 * @param {number} v
 */
export function setBusVolume(name, v) {
  bus(name).gain.value = Math.max(0, Math.min(1, v));
}

/** Get current volume for a category bus. */
export function getBusVolume(name) {
  return bus(name).gain.value;
}

// ── Polyphony tracking ──────────────────────────────────────

const DEFAULT_MAX_VOICES = 3;

/**
 * Map<url, Array<BufferSourceNode>> — active voices per sound URL.
 * When a voice ends it removes itself. When cap is exceeded the oldest is stopped.
 */
const _voices = new Map();

function trackVoice(url, src, maxVoices) {
  if (!_voices.has(url)) _voices.set(url, []);
  const list = _voices.get(url);

  // Kill oldest voices if we're at the cap
  while (list.length >= maxVoices) {
    const old = list.shift();
    try { old.stop(); } catch (_) { /* already stopped */ }
  }

  list.push(src);
  src.onended = () => {
    const idx = list.indexOf(src);
    if (idx !== -1) list.splice(idx, 1);
  };
}

// ── File loading ────────────────────────────────────────────

/**
 * Fetch + decode an audio file. Returns cached buffer on repeat calls.
 * @param {string} url
 * @returns {Promise<AudioBuffer|null>}
 */
function loadBuffer(url) {
  if (_cache.has(url)) return Promise.resolve(_cache.get(url));
  if (_loading.has(url)) return _loading.get(url);

  const promise = fetch(url)
    .then(r => {
      if (!r.ok) throw new Error(`Audio fetch failed: ${r.status} ${url}`);
      return r.arrayBuffer();
    })
    .then(ab => ctx().decodeAudioData(ab))
    .then(buf => {
      _cache.set(url, buf);
      _loading.delete(url);
      return buf;
    })
    .catch(err => {
      console.warn(`[audio] Failed to load ${url}:`, err.message);
      _loading.delete(url);
      return null;
    });

  _loading.set(url, promise);
  return promise;
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
 * Preload one or more audio files into the buffer cache.
 * Call during init so sounds are ready when needed.
 * @param {string[]} urls
 * @returns {Promise<void>}
 */
export function preload(urls) {
  return Promise.all(urls.map(loadBuffer)).then(() => {});
}

/**
 * Play a sound once.
 * @param {string} url — path to audio file (relative to site root)
 * @param {{
 *   volume?: number,       // 0–1, per-sound gain (default 1)
 *   rate?: number,         // playback rate (default 1)
 *   detune?: number,       // cents detune (default 0)
 *   delay?: number,        // seconds before playback starts (default 0)
 *   bus?: string,          // category bus name (default "ui")
 *   maxVoices?: number,    // max concurrent plays of this URL (default 3)
 * }} [opts]
 */
export function play(url, opts) {
  if (_muted) return;
  const buf = _cache.get(url);
  if (buf) {
    _playBuffer(url, buf, opts);
    return;
  }
  loadBuffer(url).then(b => {
    if (b && !_muted) _playBuffer(url, b, opts);
  });
}

/** Map<string, { src, gain }> — currently playing loops keyed by URL. */
const _loops = new Map();

/**
 * Start a looping sound. If already looping, does nothing.
 * @param {string} url
 * @param {{ volume?: number, fadeIn?: number, bus?: string }} [opts]
 */
export function startLoop(url, opts) {
  if (_loops.has(url)) return;
  const buf = _cache.get(url);
  if (buf) {
    _startLoopBuffer(url, buf, opts);
    return;
  }
  loadBuffer(url).then(b => {
    if (b && !_loops.has(url)) _startLoopBuffer(url, b, opts);
  });
}

function _startLoopBuffer(url, buf, opts) {
  try {
    const ac = ctx();
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const gain = ac.createGain();
    const vol = Number(opts?.volume ?? 1);
    const fadeIn = Number(opts?.fadeIn || 0);
    const dest = bus(opts?.bus || "ambient");

    if (fadeIn > 0) {
      gain.gain.setValueAtTime(0, ac.currentTime);
      gain.gain.linearRampToValueAtTime(vol, ac.currentTime + fadeIn);
    } else {
      gain.gain.value = vol;
    }

    src.connect(gain);
    gain.connect(dest);
    src.start();
    _loops.set(url, { src, gain });
  } catch (_) {
    // Web Audio not available
  }
}

/**
 * Stop a looping sound.
 * @param {string} url
 * @param {{ fadeOut?: number }} [opts]
 */
export function stopLoop(url, opts) {
  const entry = _loops.get(url);
  if (!entry) return;
  _loops.delete(url);

  const fadeOut = Number(opts?.fadeOut || 0);
  try {
    if (fadeOut > 0) {
      const ac = ctx();
      entry.gain.gain.setValueAtTime(entry.gain.gain.value, ac.currentTime);
      entry.gain.gain.linearRampToValueAtTime(0, ac.currentTime + fadeOut);
      entry.src.stop(ac.currentTime + fadeOut + 0.05);
    } else {
      entry.src.stop();
    }
  } catch (_) {
    // already stopped
  }
}

/** Stop all active loops. */
export function stopAllLoops() {
  for (const url of [..._loops.keys()]) stopLoop(url);
}

// ── Internal playback ───────────────────────────────────────

function _playBuffer(url, buf, opts) {
  try {
    const ac = ctx();
    const src = ac.createBufferSource();
    src.buffer = buf;

    if (opts?.rate) src.playbackRate.value = opts.rate;
    if (opts?.detune) src.detune.value = opts.detune;

    const dest = bus(opts?.bus || "ui");
    const vol = Number(opts?.volume ?? 1);

    if (vol < 1) {
      const g = ac.createGain();
      g.gain.value = vol;
      src.connect(g);
      g.connect(dest);
    } else {
      src.connect(dest);
    }

    const maxV = Number(opts?.maxVoices ?? DEFAULT_MAX_VOICES);
    trackVoice(url, src, maxV);

    const when = opts?.delay ? ac.currentTime + opts.delay : 0;
    src.start(when);
  } catch (_) {
    // Web Audio not available — silent fail
  }
}
