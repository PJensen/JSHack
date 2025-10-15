# Glyph FX Interface Specification

This document defines the contract for writing glyph effects (FX) that run both in the FX Builder and in the engine. It covers the effect function signature, the `env` object, envelope timing/easing, and authoring best practices, plus a small engine-side helper.

## Effect function contract

- Signature
  - `function draw(ctx, glyph, x, y, size, t, dt, seed, baselineY, env)`
- Parameters
  - `ctx: CanvasRenderingContext2D`
    - Your drawing target. Always `ctx.save()` before changes and `ctx.restore()` after.
  - `glyph: string`
    - The character to render (e.g., "@"). Treat as a generic string.
  - `x, y: number`
    - Baseline-anchored position in CSS pixels. `y` is the alphabetic baseline.
  - `size: number`
    - Font size in CSS pixels. Typical: `ctx.font = size + 'px monospace'; ctx.textBaseline = 'alphabetic'`.
  - `t: number`
    - Seconds since the FX started playing (monotonic).
  - `dt: number`
    - Seconds since last frame.
  - `seed: number`
    - Stable numeric seed per FX instance/cell for deterministic randomness.
  - `baselineY: number`
    - Same as `y` here; included for clarity.
  - `env: object | undefined`
    - Envelope state. Use this to ramp in/out, scale, and jitter consistently.
- Return value
  - None. Draw directly on `ctx`.

## Coordinate and drawing conventions

- Baseline anchoring
  - The baseline is authoritative. To place the glyph left-aligned on baseline: `ctx.fillText(glyph, x - size/2, y)`.
- Who renders the base glyph?
  - Engine: typically renders the base glyph in the normal text/tiles pass. The VFX pass should overlay visuals and does not need to re-render the glyph (but the glyph string is still provided to allow outlines/shadows/special cases).
  - Builder: renders the base glyph for preview automatically before calling your effect, so you can focus on overlay-only FX.
- Global envelope transforms (when enabled)
  - The builder applies transforms before your code runs:
    1. Translate to glyph center
    2. Scale by `env.scale`
    3. Translate back
    4. Apply jitter translation `(env.jx, env.jy)`
    5. Multiply `ctx.globalAlpha` by `env.gain`
  - Your effect transforms and alpha will stack on top; prefer multiplying by `env.gain` rather than replacing alpha.
- Useful composite ops
  - `lighter` (additive glow), `multiply` (char/soot), `destination-out` (erode/holes).

## The `env` object

Provided by the builder (and expected from the engine) to describe envelope progression and convenience transforms.

- Phases and progress
  - `env.phase: 'onset' | 'steady' | 'comedown'`
  - `env.u: number in [0..1]`
    - Normalized progress over the full envelope cycle.
  - `env.uLocal: number in [0..1]`
    - Phase-local progress.
  - `env.gain: number in [0..1]`
    - Intensity envelope. 0→1 during onset (eased), 1 at steady, 1→0 during comedown (eased).
- Transforms and helpers
  - `env.scale: number`
    - 1 + (Scale Max) × `env.gain`.
  - `env.jitter: number`
    - Max jitter magnitude in pixels (bell-shaped peaking near the end of onset).
  - `env.jx, env.jy: number`
    - Jitter offsets precomputed for you.
  - `env.bias: number`
    - Soft sinusoidal bias for shaping; optional.
- Fractions (for debugging/diagnostics)
  - `env.on, env.pk, env.off: number`
    - Fractions of the cycle for onset, steady, and comedown, derived from ms durations.

Guard against missing `env` in custom runtimes:

```js
const a = env ? env.gain : 1; // use a to scale intensity/alpha
```

Optionally, an engine may pass an additional `opts` property bag as a final argument after `env` for effect-specific configuration. See below.

## Envelope configuration (ms-based) and behavior

- Inputs
  - Onset (ms): ramp-in duration
  - Steady (ms): time at full intensity (1.0)
  - Comedown (ms): ramp-out duration
  - Easing: `linear` | `quad` (quadratic) | `exp` (exponential)
  - Hold at steady (boolean): if true, ramp in once and remain at full intensity
- Derived fractions
  - Let `totalMs = onset + steady + comedown` (1 if zero to prevent divide-by-zero)
    - `on = onset / totalMs`, `pk = steady / totalMs`, `off = comedown / totalMs`
- Easing shapes
  - Linear: `f(x) = x`
  - Quadratic (smooth): `f(x) = x < 0.5 ? 2x^2 : 1 − (−2x + 2)^2 / 2`
  - Exponential (strong S-curve):
    - `f(x) = x==0||x==1 ? x : x<0.5 ? 0.5*2^(20x−10) : 1 − 0.5*2^(−20x+10)`
- Gain curve
  - Onset: `gain = ease(uLocal)`
  - Steady: `gain = 1`
  - Comedown: `gain = 1 − ease(uLocal)`
- Hold-at-steady semantics
  - Preview: once time surpasses Onset ms, `env.phase` becomes `steady` and `env.gain` remains 1 indefinitely.
  - Engine: you typically hold until an external stop event, then you initiate comedown over `Comedown (ms)`.

## Authoring guidance

- Always scale your intensities by the envelope
  - `const a = env ? env.gain : 1;`
  - `ctx.globalAlpha = 0.85 * a;`
- Anchor to the baseline for glyph placement
  - `ctx.fillText(glyph, x - size/2, y)`
- Manage state with care
  - Wrap drawing in `ctx.save()`/`ctx.restore()`.
- Deterministic randomness
  - Use `seed` to keep a stable look per instance. Simple pattern:
    ```js
    function rand01(i){
      const r = Math.sin(seed*997 + i*12.9898) * 43758.5453;
      return (r % 1 + 1) % 1;
    }
    ```
- Keep it light
  - Prefer a handful of simple shapes over heavy blurs per frame.

## Engine responsibilities and opts

- Base glyph rendering
  - The base glyph should be drawn during the normal text/tiles pass, not by the effect. The FX pass overlays on top. You still receive `glyph` in case you want to derive silhouettes, outlines, or echoes.
- Suggested `opts` bag (engine → effect)
  - `opts`: opaque property bag, passed as the last argument: `fn(ctx, glyph, x, y, size, t, dt, seed, baselineY, env, opts)`
    - Example fields you might pass:
      - `teamColor`, `faction`, `material` (ink, metal, stone), `lighting`, `blocked`, `statusEffects` (burning, frozen), `z` for layering hints
      - `drawBase: boolean` in debug tools to request the effect to also render the base glyph if desired
  - Backward compatibility: effects authored for the builder (no `opts`) will continue to work; ignore the extra argument when unused.

## Patterns and mini-examples

- Envelope-aware glow (like Neon Pulse)
  ```js
  (function(ctx,glyph,x,y,size,t,dt,seed,baselineY,env){
    const a = env ? env.gain : 1;
    ctx.save();
    ctx.font = size + 'px monospace';
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = Math.max(1, size*0.06);
    ctx.strokeStyle = 'rgba(80,255,200,0.9)';
    ctx.globalAlpha = 0.85 * a; ctx.strokeText(glyph, x - size/2, y);
    ctx.globalAlpha = 0.35 * a; ctx.fillStyle = 'rgba(10,30,24,1)';
    ctx.fillText(glyph, x - size/2, y);
    ctx.restore();
  })
  ```

- Progress-driven erosion (e.g., ash)
  ```js
  (function(ctx,glyph,x,y,size,t,dt,seed,baselineY,env){
    const u = env ? env.u : (0.5 + 0.5*Math.sin(t));
    const a = env ? env.gain : 1;
    ctx.save();
    // draw base
    ctx.globalAlpha = 0.8 * a;
    ctx.fillStyle = '#ddd';
    ctx.font = size + 'px monospace';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(glyph, x - size/2, y);
    // punch holes proportional to u
    ctx.globalCompositeOperation = 'destination-out';
    for(let i=0;i<40*u;i++){
      const rx = (Math.sin(seed*997+i*13.7)*43758.5453)%1; const rxf=(rx<0?rx+1:rx);
      const ry = (Math.sin(seed*419+i*7.11)*21942.1371)%1; const ryf=(ry<0?ry+1:ry);
      const px = x - size*0.5 + rxf*size;
      const py = y - size*0.9 + ryf*size*0.95;
      const rad = size*(0.008 + 0.02*u);
      ctx.beginPath(); ctx.arc(px,py,rad,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  })
  ```

## Engine parity: minimal helper

Use (or adapt) this minimal helper in your engine to compute an `env` equivalent to the builder. Feed it the effect-local clock `effT` (seconds) that you control.

```js
function easeShape(x, type){
  x = Math.max(0, Math.min(1, x));
  switch(type){
    case 'quad': return x<0.5 ? 2*x*x : 1 - Math.pow(-2*x+2,2)/2;
    case 'exp':  if(x===0||x===1) return x; return x<0.5 ? Math.pow(2, 20*x-10)/2 : 1 - Math.pow(2, -20*x+10)/2;
    default:     return x; // linear
  }
}

function computeEnv(effT, params, size, seed){
  const onMs = Math.max(0, params.onsetMs|0);
  const pkMs = Math.max(0, params.steadyMs|0);
  const offMs = Math.max(0, params.comedownMs|0);
  const ease = params.easing || 'linear';
  const hold = !!params.holdSteady;
  const totalMs = Math.max(1, onMs + pkMs + offMs);
  const on = onMs/totalMs, pk = pkMs/totalMs, off = offMs/totalMs;

  let phase, u, uLocal, gain;
  if(onMs===0 && offMs===0){
    phase='steady'; u=1; uLocal=1; gain=1;
  } else if(effT*1000 < onMs){
    phase='onset';
    const local = (effT*1000)/Math.max(1,onMs); uLocal=Math.max(0,Math.min(1,local));
    u = uLocal*on;
    gain = easeShape(uLocal, ease);
  } else if(hold || effT*1000 < onMs + pkMs){
    phase='steady'; uLocal = pkMs>0 ? ((effT*1000 - onMs)/Math.max(1,pkMs)) : 1; u = on + uLocal*pk; gain=1;
  } else {
    phase='comedown';
    const local = (effT*1000 - onMs - pkMs)/Math.max(1,offMs); uLocal=Math.max(0,Math.min(1,local));
    u = on + pk + uLocal*off;
    gain = 1 - easeShape(uLocal, ease);
  }

  // Optional: scale/jitter parity
  const scaleMax = params.scaleMax || 0; // e.g., 0.12
  const jitterMax = params.jitterMax || 0; // pixels
  const bellCenter = on, bellWidth = Math.max(1e-6, on*0.75);
  const bell = Math.max(0, 1 - Math.abs((u - bellCenter)/bellWidth));
  const jitter = jitterMax * bell * 0.8;
  function noise01(s, x){
    // simple hash-based noise
    let n = (s*73856093 ^ (x*1e6|0))|0; n = (n ^ 61) ^ (n>>>16); n = n + (n<<3); n = n ^ (n>>>4); n = n * 0x27d4eb2d; n = n ^ (n>>>15);
    const f = Math.sin(n)*43758.5453; return (f - Math.floor(f));
  }
  const jx = (noise01(seed, u+0.13)-0.5) * 2 * jitter;
  const jy = (noise01(seed, u+0.71)-0.5) * 2 * jitter;
  const scale = 1 + scaleMax * gain;

  return { phase, u, uLocal, gain, scale, jitter, jx, jy, bias: Math.sin(Math.PI*u), on, pk, off };
}
```

When you call the effect from the engine, use:

```js
// Note the optional opts bag at the end
effectFn(ctx, glyph, x, y, size, t, dt, seed, baselineY, env, opts);
```

## Quick authoring checklist

- [ ] Accept the full signature and wrap with `ctx.save()` / `ctx.restore()`
- [ ] Multiply intensities/alpha by `env.gain` (if `env` provided)
- [ ] Align to baseline (`x - size/2`, `y`) for glyph placement
- [ ] Use `seed` for deterministic randomness
- [ ] Keep transforms and compositing minimal per frame

---

Questions or improvements you want in the interface? Add an issue or inline comments and we’ll iterate.