// sound.js — drop-in pure browser tone generator
export const Sound = (() => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const env = (gain, t0, a=0.01, d=0.08, s=0.4, r=0.1) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(1, t0+a);
    g.gain.linearRampToValueAtTime(s, t0+a+d);
    g.gain.linearRampToValueAtTime(0, t0+a+d+r);
    gain && gain.connect(g);
    return g;
  };
  const note = (freq=440, dur=0.2, type='square', vol=0.15) => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    const gain = ctx.createGain(); gain.gain.value = vol;
    const e = env(null, now);
    osc.connect(e).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.2);
  };
  return { note, ctx };
})();
