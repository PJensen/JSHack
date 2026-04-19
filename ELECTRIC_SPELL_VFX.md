# Electric Spell VFX — Shelved Concepts

Developed during plasma cloud iteration (2026-04-18). Not used for grid bug death hazard.
Good fit for a targeted electric spell (e.g. lightning bolt, chain lightning, shock orb).

## Outer Bloom

Wide (r+2.2) faint radial gradient centered on impact point. Electrifies ambient air.

```javascript
let grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r + 2.2);
grad.addColorStop(0,   `rgba(20,80,160,${((0.12 + flashBoost * 0.08) * alphaScale).toFixed(3)})`);
grad.addColorStop(0.5, `rgba(10,40,100,${((0.06) * alphaScale).toFixed(3)})`);
grad.addColorStop(1,   'rgba(0,10,40,0)');
ctx.fillStyle = grad;
ctx.beginPath();
ctx.arc(cx, cy, r + 2.2, 0, TAU);
ctx.fill();
```

Pair with SDF light field `radius: 1.5, color: [60, 140, 200]` per tile in footprint.

---

## Discrete-Snap Crackle Arcs

Internal lightning arcs that jump at ~12fps. LCG seeded from `floor(fxTime * 12)` so
they snap discretely rather than smoothly animate. No `Math.random()`.

```javascript
const bucket = Math.floor(_fxTime * 12);
const crackCount = 3 + (r * 3);
const vol = r + 0.5;
ctx.globalCompositeOperation = 'lighter';

for (let c = 0; c < crackCount; c++) {
  let s = (((bucket * 1664525 + (cloud.phase * 7919 | 0)) >>> 0) ^ (c * 22695477 >>> 0)) >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xFFFFFFFF; };

  const ax = cx + (rnd() * 2 - 1) * vol;
  const ay = cy + (rnd() * 2 - 1) * vol;
  const bx = cx + (rnd() * 2 - 1) * vol;
  const by = cy + (rnd() * 2 - 1) * vol;
  const mx = (ax + bx) * 0.5 + (rnd() - 0.5) * vol * 0.7;
  const my = (ay + by) * 0.5 + (rnd() - 0.5) * vol * 0.7;

  const brightness = rnd();
  const arcA = (0.40 + brightness * 0.40 + flashBoost * 0.20) * alphaScale;
  ctx.strokeStyle = brightness > 0.65
    ? `rgba(230,250,255,${arcA.toFixed(3)})`
    : `rgba(100,200,255,${arcA.toFixed(3)})`;
  ctx.lineWidth = 0.025 + pulse * 0.015;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo(mx, my, bx, by);
  ctx.stroke();
}
```

---

## Branching Arcs

Fork off the main crackle arc at a random Bezier midpoint. Add after main arc draw,
same LCG `rnd` chain. Endpoint pulled toward center to stay inside the lit volume.

```javascript
// After main arc stroke, continuing same rnd() chain:
const branchT = 0.3 + rnd() * 0.4;
const bt1 = 1 - branchT;
// Proper quadratic Bezier point at t
const fpx = bt1 * bt1 * ax + 2 * bt1 * branchT * mx + branchT * branchT * bx;
const fpy = bt1 * bt1 * ay + 2 * bt1 * branchT * my + branchT * branchT * by;
// Endpoint pulled toward center so it stays in the lit volume
const bex = cx + (fpx - cx) * 0.4 + (rnd() - 0.5) * vol * 0.5;
const bey = cy + (fpy - cy) * 0.4 + (rnd() - 0.5) * vol * 0.5;
const bmx = (fpx + bex) * 0.5 + (rnd() - 0.5) * 0.25;
const bmy = (fpy + bey) * 0.5 + (rnd() - 0.5) * 0.25;
ctx.lineWidth = 0.012 + pulse * 0.006;
ctx.strokeStyle = hot
  ? `rgba(210,245,255,${(arcA * 0.55).toFixed(3)})`
  : `rgba(80,170,240,${(arcA * 0.55).toFixed(3)})`;
ctx.beginPath();
ctx.moveTo(fpx, fpy);
ctx.quadraticCurveTo(bmx, bmy, bex, bey);
ctx.stroke();
```

---

## Notes

- Crackle + branch arcs require `ctx.globalCompositeOperation = 'lighter'`
- Works best over a volumetric glow base (the 3-layer radial gradient stack)
- For a targeted spell: spawn as `kind: "electric"` HazardArea with `turnsLeft: 3`, `radius: 2`
- The LCG approach is reusable for any discrete-snap FX that must be deterministic
