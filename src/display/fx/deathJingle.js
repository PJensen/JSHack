// Death jingle — Web Audio API synth. No audio files needed.
// Plays a dark, descending minor-key phrase when the player dies.

let _ctx = null;

function ctx() {
  if (!_ctx) {
    _ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
  }
  return _ctx;
}

/**
 * Play a single tone with attack/decay envelope.
 * @param {AudioContext} ac
 * @param {number} freq  - Hz
 * @param {number} start - seconds offset from ac.currentTime
 * @param {number} dur   - seconds
 * @param {string} type  - oscillator waveform
 * @param {number} gain  - peak gain (0-1)
 * @param {GainNode} master
 */
function tone(ac, freq, start, dur, type, gain, master) {
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;

  const t0 = ac.currentTime + start;
  const attack = 0.02;
  const release = Math.min(dur * 0.4, 0.3);
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(gain, t0 + attack);
  env.gain.setValueAtTime(gain, t0 + dur - release);
  env.gain.linearRampToValueAtTime(0, t0 + dur);

  osc.connect(env);
  env.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/**
 * Low rumbling sub-bass boom.
 */
function boom(ac, start, master) {
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(65, ac.currentTime + start);
  osc.frequency.exponentialRampToValueAtTime(30, ac.currentTime + start + 1.2);

  const t0 = ac.currentTime + start;
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(0.35, t0 + 0.05);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + 1.4);

  osc.connect(env);
  env.connect(master);
  osc.start(t0);
  osc.stop(t0 + 1.5);
}

/**
 * Play the death jingle.
 * Dark descending minor phrase with sub-bass boom and eerie choir pad.
 */
export function playDeathJingle() {
  try {
    const ac = ctx();
    if (ac.state === 'suspended') ac.resume();

    const master = ac.createGain();
    master.gain.value = 0.45;
    master.connect(ac.destination);

    // --- Sub-bass boom ---
    boom(ac, 0, master);

    // --- Descending minor melody (sawtooth, filtered feel) ---
    // D4 → C4 → Bb3 → A3 (D minor descent)
    const melody = [
      { freq: 293.66, start: 0.05, dur: 0.35 },   // D4
      { freq: 261.63, start: 0.40, dur: 0.35 },   // C4
      { freq: 233.08, start: 0.75, dur: 0.35 },   // Bb3
      { freq: 220.00, start: 1.10, dur: 0.70 },   // A3 (held)
    ];
    for (const n of melody) {
      tone(ac, n.freq, n.start, n.dur, 'sawtooth', 0.12, master);
    }

    // --- Eerie choir pad (triangle, slow attack) ---
    // D minor triad: D3, F3, A3
    const chordStart = 0.3;
    const chordDur = 2.0;
    const pad = [146.83, 174.61, 220.00]; // D3, F3, A3
    for (const f of pad) {
      const osc = ac.createOscillator();
      const env = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;

      const t0 = ac.currentTime + chordStart;
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(0.08, t0 + 0.6);
      env.gain.setValueAtTime(0.08, t0 + chordDur - 0.8);
      env.gain.linearRampToValueAtTime(0, t0 + chordDur);

      osc.connect(env);
      env.connect(master);
      osc.start(t0);
      osc.stop(t0 + chordDur + 0.1);
    }

    // --- High ghostly whistle (sine, very quiet) ---
    tone(ac, 880, 0.6, 1.5, 'sine', 0.03, master);  // A5 whisper
    tone(ac, 830.61, 1.0, 1.2, 'sine', 0.025, master); // Ab5 detune

    // --- Final low bell toll ---
    tone(ac, 73.42, 1.8, 1.5, 'sine', 0.18, master); // D2
    tone(ac, 146.83, 1.8, 1.2, 'triangle', 0.06, master); // D3 harmonic

    // Auto-cleanup master node
    setTimeout(() => { master.disconnect(); }, 4000);
  } catch (_) {
    // Web Audio not available — silent fail
  }
}
