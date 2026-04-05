// Audio engine — loads and plays real audio files (.wav, .mp3, .mp4) via Web Audio API.
// Decoded buffers are cached so each file is fetched only once.

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
 * Play a sound.
 * @param {string} url — path to audio file (relative to site root)
 * @param {{
 *   volume?: number,       // 0–1, multiplied with master (default 1)
 *   rate?: number,         // playback rate (default 1)
 *   detune?: number,       // cents detune (default 0)
 *   delay?: number,        // seconds before playback starts (default 0)
 * }} [opts]
 */
export function play(url, opts) {
  if (_muted) return;
  const buf = _cache.get(url);
  if (buf) {
    _playBuffer(buf, opts);
    return;
  }
  // Not cached yet — load then play (slight latency on first use)
  loadBuffer(url).then(b => {
    if (b && !_muted) _playBuffer(b, opts);
  });
}

/** @param {AudioBuffer} buf */
function _playBuffer(buf, opts) {
  try {
    const ac = ctx();
    const src = ac.createBufferSource();
    src.buffer = buf;

    if (opts?.rate) src.playbackRate.value = opts.rate;
    if (opts?.detune) src.detune.value = opts.detune;

    const vol = Number(opts?.volume ?? 1);
    if (vol < 1) {
      const g = ac.createGain();
      g.gain.value = vol;
      src.connect(g);
      g.connect(masterGain());
    } else {
      src.connect(masterGain());
    }

    const when = opts?.delay ? ac.currentTime + opts.delay : 0;
    src.start(when);
  } catch (_) {
    // Web Audio not available — silent fail
  }
}
