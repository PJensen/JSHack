// Audio engine — loads and plays real audio files (.wav, .mp3, .mp4) via Web Audio API.
// Decoded buffers are cached so each file is fetched only once.
//
// Routing:  BufferSource → GainNode → StereoPanner → ConvolverNode(reverb) → Bus → Master → speakers
//
// Buses:    combat, spells, items, ambient, ui  (each independently adjustable)
// Polyphony: max concurrent plays per URL, oldest voice is killed when cap is hit.
// Pitch:    randomPitch option jitters detune ±N cents per play for variation.
// Reverb:   convolver-based reverb send, wet/dry mix adjustable per environment.

let _ctx = null;
let _master = null;
let _muted = false;
let _volume = 0.8;

/** Map<string, AudioBuffer> — decoded file cache keyed by URL. */
const _cache = new Map();

/** Map<string, Promise<AudioBuffer|null>> — in-flight loads. */
const _loading = new Map();

// ── Internals ───────────────────────────────────────────────

/** Convert cents to playback-rate multiplier. */
function centsToRate(cents) {
  return Math.pow(2, Number(cents || 0) / 1200);
}

/**
 * Compute final playback rate from base rate + fixed/random pitch in cents.
 * Using playbackRate (instead of only detune) keeps pitch variation reliable
 * across browser engines.
 * @param {{ rate?: number, detune?: number, randomPitch?: number } | undefined} opts
 * @param {() => number} rng returns [0,1)
 */
export function computePlaybackRate(opts, rng = Math.random) {
  const baseRate = Number(opts?.rate ?? 1);
  const detune = Number(opts?.detune || 0);
  const randomPitch = Number(opts?.randomPitch || 0);
  const jitter = randomPitch > 0 ? (rng() * 2 - 1) * randomPitch : 0;
  return baseRate * centsToRate(detune + jitter);
}

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
  ambient: 0.9,
  "ambient:loop": 0.45,
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

// ── Reverb ──────────────────────────────────────────────────

let _reverbNode = null;   // ConvolverNode
let _reverbSend = null;   // GainNode — wet level (0 = dry, 1 = full reverb)
let _reverbDry = null;    // GainNode — dry pass-through

/**
 * Generate a synthetic impulse response for a stone room.
 * @param {AudioContext} ac
 * @param {number} duration — seconds
 * @param {number} decay    — higher = faster decay
 * @returns {AudioBuffer}
 */
function generateImpulse(ac, duration, decay) {
  const len = ac.sampleRate * duration;
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

/**
 * Get the reverb send node. Lazily creates the convolver and wiring.
 * Signal flow:  sound → reverbSend(wet) → convolver → master
 *               sound → reverbDry       → bus (normal path)
 *
 * Callers connect to the returned dry node; if reverb > 0 they also
 * connect to the wet send.
 */
function getReverbNodes() {
  if (!_reverbNode) {
    const ac = ctx();
    _reverbNode = ac.createConvolver();
    // Medium stone room: 1.8s tail, moderate decay
    _reverbNode.buffer = generateImpulse(ac, 1.8, 2.5);

    _reverbSend = ac.createGain();
    _reverbSend.gain.value = 0;  // wet level, controlled by setReverbMix
    _reverbSend.connect(_reverbNode);
    _reverbNode.connect(masterGain());
  }
  return { wet: _reverbSend, convolver: _reverbNode };
}

/**
 * Set reverb wet level (0 = fully dry, 1 = full reverb).
 * Call this when the environment changes (dungeon vs overworld).
 * @param {number} mix — 0–1
 */
export function setReverbMix(mix) {
  getReverbNodes();
  _reverbSend.gain.value = Math.max(0, Math.min(1, mix));
}

export function getReverbMix() {
  return _reverbSend ? _reverbSend.gain.value : 0;
}

// ── Polyphony tracking ──────────────────────────────────────

const DEFAULT_MAX_VOICES = 3;

/**
 * Map<url, Array<BufferSourceNode>> — active voices per sound URL.
 * When a voice ends it removes itself. When cap is exceeded the oldest is stopped.
 */
const _voices = new Map();

/**
 * Global voice registry for cross-URL priority management.
 * Each entry: { src, priority, volume }
 * priority 1 = player-triggered or player-origin — immune to eviction.
 * priority 0 = spatial/distant — evicted (quietest first) when a priority-1 sound plays.
 */
const _globalVoices = [];

function _removeGlobal(src) {
  const i = _globalVoices.findIndex(v => v.src === src);
  if (i !== -1) _globalVoices.splice(i, 1);
}

/**
 * When a priority-1 sound plays, kill quiet non-priority voices to clear the mix.
 * Threshold 0.5 ≈ sounds 9+ tiles away (next-room-over combat noise).
 */
function _evictLowPriorityVoices() {
  for (let i = _globalVoices.length - 1; i >= 0; i--) {
    const v = _globalVoices[i];
    if (v.priority === 0 && v.volume < 0.5) {
      try { v.src.stop(); } catch (_) { /* already stopped */ }
      _globalVoices.splice(i, 1);
    }
  }
}

function trackVoice(url, src, maxVoices, priority = 0, volume = 1) {
  if (!_voices.has(url)) _voices.set(url, []);
  const list = _voices.get(url);

  // Kill oldest voices if we're at the per-URL cap
  while (list.length >= maxVoices) {
    const old = list.shift();
    try { old.stop(); } catch (_) { /* already stopped */ }
    _removeGlobal(old);
  }

  // Priority sound playing — clear quiet distant voices from the mix
  if (priority > 0) _evictLowPriorityVoices();

  list.push(src);
  const gEntry = { src, priority, volume };
  _globalVoices.push(gEntry);

  src.onended = () => {
    const idx = list.indexOf(src);
    if (idx !== -1) list.splice(idx, 1);
    _removeGlobal(src);
  };
}

// ── File loading ────────────────────────────────────────────

/** Set<string> — URLs that 404'd or failed. Don't retry these. */
const _failed = new Set();

/**
 * Fetch + decode an audio file. Returns cached buffer on repeat calls.
 * URLs that fail are blacklisted so we never retry them.
 * @param {string} url
 * @returns {Promise<AudioBuffer|null>}
 */
function loadBuffer(url) {
  if (_cache.has(url)) return Promise.resolve(_cache.get(url));
  if (_failed.has(url)) return Promise.resolve(null);
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
      console.warn(`[audio] ${url}: ${err.message}`);
      _loading.delete(url);
      _failed.add(url);
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
 *   randomPitch?: number,  // random detune jitter in cents (e.g. 80 → ±80 cents)
 *   delay?: number,        // seconds before playback starts (default 0)
 *   bus?: string,          // category bus name (default "ui")
 *   maxVoices?: number,    // max concurrent plays of this URL (default 3)
 *   pan?: number,          // stereo pan -1 (left) to +1 (right), default 0 (center)
 *   reverb?: boolean,      // send this sound through reverb (default true)
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

// ── Tracked playback (moving sounds) ────────────────────────

/**
 * Play a sound and return a handle for updating pan/volume each frame.
 * Used for projectiles that travel across the screen.
 *
 * @param {string} url
 * @param {{
 *   volume?: number,
 *   bus?: string,
 *   loop?: boolean,
 *   randomPitch?: number,
 * }} [opts]
 * @returns {{ updatePan(pan: number): void, updateVolume(v: number): void, stop(): void } | null}
 */
export function playTracked(url, opts) {
  if (_muted) return null;
  const buf = _cache.get(url);
  if (buf) return _playTrackedBuffer(buf, opts);
  // Async fallback — can't return handle synchronously if not preloaded
  loadBuffer(url).then(b => {
    if (b && !_muted) _playTrackedBuffer(b, opts);
  });
  return null;
}

function _playTrackedBuffer(buf, opts) {
  try {
    const ac = ctx();
    const src = ac.createBufferSource();
    src.buffer = buf;
    if (opts?.loop) src.loop = true;
    src.playbackRate.value = computePlaybackRate(opts);

    const dest = bus(opts?.bus || "spells");
    const gain = ac.createGain();
    gain.gain.value = Number(opts?.volume ?? 1);

    const panner = (typeof ac.createStereoPanner === "function")
      ? ac.createStereoPanner()
      : null;

    // Chain:  src → gain → panner → reverb send + bus
    src.connect(gain);
    if (panner) {
      gain.connect(panner);
      panner.connect(dest);
      if (_reverbSend && _reverbSend.gain.value > 0) panner.connect(_reverbSend);
    } else {
      gain.connect(dest);
      if (_reverbSend && _reverbSend.gain.value > 0) gain.connect(_reverbSend);
    }

    let stopped = false;
    src.start();

    return {
      updatePan(pan) {
        if (panner && !stopped) panner.pan.value = Math.max(-1, Math.min(1, pan));
      },
      updateVolume(v) {
        if (!stopped) gain.gain.value = Math.max(0, Math.min(1, v));
      },
      stop() {
        if (stopped) return;
        stopped = true;
        try { src.stop(); } catch (_) {}
      },
    };
  } catch (_) {
    return null;
  }
}

/** Map<string, { src?: AudioBufferSourceNode, gain?: GainNode, srcs?: Set<AudioBufferSourceNode>, gains?: Set<GainNode>, timers?: Set<number>, stopped?: boolean }> — currently playing loops keyed by URL. */
const _loops = new Map();
const _cancelledLoops = new Set();

/**
 * Start a looping sound. If already looping, does nothing.
 * @param {string} url
 * @param {{ volume?: number, fadeIn?: number, bus?: string, crossfade?: number }} [opts]
 */
export function startLoop(url, opts) {
  _cancelledLoops.delete(url);
  if (_loops.has(url)) return;
  const buf = _cache.get(url);
  if (buf) {
    _startLoopBuffer(url, buf, opts);
    return;
  }
  loadBuffer(url).then(b => {
    if (b && !_loops.has(url) && !_cancelledLoops.has(url)) _startLoopBuffer(url, b, opts);
  });
}

function _startLoopBuffer(url, buf, opts) {
  try {
    const crossfade = Math.max(0, Number(opts?.crossfade || 0));
    if (crossfade > 0 && Number(buf.duration || 0) > crossfade * 2) {
      _startCrossfadeLoopBuffer(url, buf, opts, crossfade);
      return;
    }

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

function _startCrossfadeLoopBuffer(url, buf, opts, crossfade) {
  const ac = ctx();
  const dest = bus(opts?.bus || "ambient");
  const vol = Number(opts?.volume ?? 1);
  const fadeIn = Number(opts?.fadeIn || 0);
  const intervalMs = Math.max(50, (buf.duration - crossfade) * 1000);
  const entry = { srcs: new Set(), gains: new Set(), timers: new Set(), stopped: false };

  function startVoice(isFirst = false) {
    if (entry.stopped || _cancelledLoops.has(url)) return;
    const src = ac.createBufferSource();
    const gain = ac.createGain();
    src.buffer = buf;
    gain.gain.setValueAtTime(0, ac.currentTime);
    const ramp = isFirst ? Math.max(fadeIn, 0.01) : Math.max(crossfade, 0.01);
    gain.gain.linearRampToValueAtTime(vol, ac.currentTime + ramp);
    src.connect(gain);
    gain.connect(dest);
    src.onended = () => {
      entry.srcs.delete(src);
      entry.gains.delete(gain);
    };
    entry.srcs.add(src);
    entry.gains.add(gain);
    src.start();
    try { src.stop(ac.currentTime + buf.duration + 0.05); } catch (_) { /* ignore */ }

    const timer = setTimeout(() => {
      entry.timers.delete(timer);
      startVoice(false);
    }, intervalMs);
    entry.timers.add(timer);
  }

  _loops.set(url, entry);
  startVoice(true);
}

/**
 * Stop a looping sound.
 * @param {string} url
 * @param {{ fadeOut?: number }} [opts]
 */
export function stopLoop(url, opts) {
  const entry = _loops.get(url);
  if (!entry) {
    _cancelledLoops.add(url);
    return;
  }
  _cancelledLoops.add(url);
  _loops.delete(url);

  const fadeOut = Number(opts?.fadeOut || 0);
  try {
    if (entry.srcs || entry.gains || entry.timers) {
      const ac = ctx();
      for (const timer of entry.timers || []) clearTimeout(timer);
      entry.timers?.clear();
      entry.stopped = true;
      for (const gain of entry.gains || []) {
        if (fadeOut > 0) {
          gain.gain.cancelScheduledValues(ac.currentTime);
          gain.gain.setValueAtTime(gain.gain.value, ac.currentTime);
          gain.gain.linearRampToValueAtTime(0, ac.currentTime + fadeOut);
        } else {
          gain.gain.value = 0;
        }
      }
      for (const src of entry.srcs || []) {
        try {
          if (fadeOut > 0) src.stop(ac.currentTime + fadeOut + 0.05);
          else src.stop();
        } catch (_) { /* ignore */ }
      }
      return;
    }

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

/**
 * Adjust the volume of an active loop without restarting it.
 * @param {string} url
 * @param {number} volume
 * @param {{ ramp?: number }} [opts]
 */
export function setLoopVolume(url, volume, opts) {
  const entry = _loops.get(url);
  if (!entry) return;
  const next = Math.max(0, Math.min(1, Number(volume ?? 1)));
  const ramp = Math.max(0, Number(opts?.ramp || 0));
  try {
    if (entry.gains) {
      const ac = ctx();
      for (const gain of entry.gains) {
        if (ramp > 0) {
          gain.gain.cancelScheduledValues(ac.currentTime);
          gain.gain.setValueAtTime(gain.gain.value, ac.currentTime);
          gain.gain.linearRampToValueAtTime(next, ac.currentTime + ramp);
        } else {
          gain.gain.value = next;
        }
      }
      return;
    }

    if (ramp > 0) {
      const ac = ctx();
      entry.gain.gain.cancelScheduledValues(ac.currentTime);
      entry.gain.gain.setValueAtTime(entry.gain.gain.value, ac.currentTime);
      entry.gain.gain.linearRampToValueAtTime(next, ac.currentTime + ramp);
    } else {
      entry.gain.gain.value = next;
    }
  } catch (_) {
    entry.gain.gain.value = next;
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
    // ── Pitch: fixed detune + random jitter via playbackRate ───────────────
    src.playbackRate.value = computePlaybackRate(opts);

    const dest = bus(opts?.bus || "ui");
    const vol = Number(opts?.volume ?? 1);
    const pan = Number(opts?.pan || 0);

    // Build chain:  src → [gain] → [panner] → bus  (dry path)
    //                                        ↘ reverb send  (wet path)
    let tail = src;

    if (vol < 1) {
      const g = ac.createGain();
      g.gain.value = vol;
      tail.connect(g);
      tail = g;
    }

    if (pan !== 0 && typeof ac.createStereoPanner === "function") {
      const p = ac.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      tail.connect(p);
      tail = p;
    }

    // Dry path → bus
    tail.connect(dest);

    // Wet path → reverb send (if reverb is enabled and mix > 0)
    const useReverb = opts?.reverb !== false;
    if (useReverb && _reverbSend && _reverbSend.gain.value > 0) {
      tail.connect(_reverbSend);
    }

    const maxV = Number(opts?.maxVoices ?? DEFAULT_MAX_VOICES);
    const priority = Number(opts?.priority ?? 0);
    trackVoice(url, src, maxV, priority, vol);

    const when = opts?.delay ? ac.currentTime + opts.delay : 0;
    const segment = Number(opts?.segment || 0);
    if (segment > 0 && buf.duration > segment) {
      // Pick random start position for segment playback
      const maxOffset = buf.duration - segment;
      const offset = Math.random() * maxOffset;
      src.start(when, offset, segment);
    } else {
      src.start(when);
    }
  } catch (_) {
    // Web Audio not available — silent fail
  }
}
