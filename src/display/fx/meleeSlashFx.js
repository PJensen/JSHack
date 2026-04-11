// display/fx/meleeSlashFx.js
// Melee attack visual language: sweeps, stabs, impacts, parry sparks, dodge whiffs.
// Each weapon class + attack kind maps to a distinct visual primitive so combat
// reads expressively — no two consecutive swings should look identical.
// Only fires for weapon-wielding melee (impactProfile.weaponClass !== 'unarmed').

import { MeleeSlashFx } from "./fxEntries.js";

// ── Timing ─────────────────────────────────────────────────────────────────
const SWEEP_TTL       = 0.14;   // sword/axe arc lifetime
const STAB_TTL        = 0.11;   // dagger thrust
const IMPACT_TTL      = 0.13;   // mace/blunt burst
const PARRY_TTL       = 0.10;   // metallic spark
const WHIFF_TTL       = 0.16;   // ghostly miss trail (lingers slightly)
const OFFHAND_DELAY   = 0.15;   // match bump/gore offhand delay

// ── Weapon colour palettes [r, g, b] ──────────────────────────────────────
const COL_BLADE   = [220, 230, 240]; // pale steel
const COL_AXE     = [240, 220, 200]; // warm steel
const COL_BLUNT   = [255, 200, 140]; // amber
const COL_DAGGER  = [240, 245, 255]; // cold white
const COL_DEFAULT = [230, 230, 230]; // neutral
const COL_PARRY   = [255, 255, 220]; // bright metallic yellow-white
const COL_WHIFF   = [180, 190, 210]; // ghostly blue-grey

// ── Weapon silhouette profiles ────────────────────────────────────────────
// Each class gets explicit length + alpha distribution along that length.
// t=0 is near the grip/handle, t=1 is the weapon's striking end.
const DEFAULT_WEAPON_PROFILE = Object.freeze({
  length: 0.9,
  widthScale: 1.0,
  handleStart: 0.24, // where the rendered shape begins, as fraction of length
  alphaStops: Object.freeze([
    [0.00, 0.18],
    [0.50, 0.55],
    [1.00, 1.00],
  ]),
});

const WEAPON_VFX_PROFILES = Object.freeze({
  sword: Object.freeze({
    length: 1.0,
    widthScale: 0.95,
    handleStart: 0.28,
    alphaStops: Object.freeze([
      [0.00, 0.20],
      [0.42, 0.48],
      [0.78, 0.82],
      [1.00, 1.00],
    ]),
  }),
  dagger: Object.freeze({
    length: 0.68,
    widthScale: 0.82,
    handleStart: 0.30,
    alphaStops: Object.freeze([
      [0.00, 0.22],
      [0.50, 0.66],
      [1.00, 1.00],
    ]),
  }),
  axe: Object.freeze({
    length: 0.92,
    widthScale: 1.10,
    handleStart: 0.22,
    alphaStops: Object.freeze([
      [0.00, 0.16],
      [0.56, 0.34],
      [0.82, 1.00],
      [1.00, 0.86],
    ]),
  }),
  mace: Object.freeze({
    length: 0.88,
    widthScale: 1.18,
    handleStart: 0.20,
    alphaStops: Object.freeze([
      [0.00, 0.12],
      [0.60, 0.24],
      [0.84, 0.96],
      [1.00, 1.00],
    ]),
  }),
  morningstar: Object.freeze({
    length: 1.10,
    widthScale: 1.20,
    handleStart: 0.18,
    alphaStops: Object.freeze([
      [0.00, 0.06],
      [0.70, 0.10],
      [0.85, 0.80],
      [1.00, 1.00],
    ]),
  }),
  nunchucks: Object.freeze({
    length: 0.98,
    widthScale: 1.16,
    handleStart: 0.20,
    alphaStops: Object.freeze([
      [0.00, 0.12],
      [0.58, 0.26],
      [0.86, 0.96],
      [1.00, 1.00],
    ]),
  }),
  staff: Object.freeze({
    length: 1.30,
    widthScale: 0.90,
    handleStart: 0.16,
    alphaStops: Object.freeze([
      [0.00, 0.16],
      [0.72, 0.58],
      [1.00, 0.86],
    ]),
  }),
  spear: Object.freeze({
    length: 1.38,
    widthScale: 0.88,
    handleStart: 0.14,
    alphaStops: Object.freeze([
      [0.00, 0.16],
      [0.76, 0.48],
      [0.94, 1.00],
      [1.00, 0.92],
    ]),
  }),
  bow: Object.freeze({
    length: 1.20,
    widthScale: 0.84,
    handleStart: 0.20,
    alphaStops: Object.freeze([
      [0.00, 0.24],
      [0.50, 0.72],
      [1.00, 0.86],
    ]),
  }),
  weapon: DEFAULT_WEAPON_PROFILE,
});

// ── Element tint overrides ────────────────────────────────────────────────
// Keys must match the canonical tint ids from rules/data/elementTints.js
const ELEMENT_TINTS = {
  fire:     [255, 140, 60],   // hot orange
  poison:   [120, 220, 80],   // sickly green
  frost:    [140, 200, 255],  // icy blue
  acid:     [180, 255, 40],   // caustic yellow-green
  electric: [160, 180, 255],  // crackling blue-white
};

// ── Damage colour shift ───────────────────────────────────────────────────
// Lerps the base weapon colour toward hot white/red as damage increases.
const DMG_SCALE_CAP = 12;

function lerpColor(base, target, t) {
  return [
    base[0] + (target[0] - base[0]) * t,
    base[1] + (target[1] - base[1]) * t,
    base[2] + (target[2] - base[2]) * t,
  ];
}

function resolveBaseColor(weaponClass, elementTint) {
  // Element enchants override the weapon's base colour
  if (elementTint && ELEMENT_TINTS[elementTint]) {
    return ELEMENT_TINTS[elementTint];
  }
  switch (weaponClass) {
    case 'sword':       return COL_BLADE;
    case 'axe':         return COL_AXE;
    case 'mace':        return COL_BLUNT;
    case 'morningstar': return COL_BLUNT;
    case 'dagger':      return COL_DAGGER;
    default:            return COL_DEFAULT;
  }
}

function damageColorShift(baseColor, amount, critical) {
  const t = Math.min(1, (amount || 0) / DMG_SCALE_CAP);
  const bloodRed = [255, 60, 40];
  const shifted = lerpColor(baseColor, bloodRed, t * 0.6);
  if (critical) {
    // Crits push toward bright gold — devastating, powerful
    return lerpColor(shifted, [255, 220, 80], 0.4);
  }
  return shifted;
}

// ── Size scaling ──────────────────────────────────────────────────────────
function damageRadiusScale(amount) {
  if (!(amount > 0)) return 0.55;
  return 0.55 + Math.min(0.25, Math.log(1 + amount / 3) * 0.15);
}

function damageSweepScale(amount) {
  if (!(amount > 0)) return 1.0;
  return 1.0 + Math.min(0.3, amount / DMG_SCALE_CAP * 0.3);
}

function damageLineWidthScale(amount) {
  if (!(amount > 0)) return 1.0;
  return 1.0 + Math.min(0.5, amount / DMG_SCALE_CAP * 0.5);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function coerceLengthScaleFromCm(weaponLengthCm) {
  const cm = Number(weaponLengthCm);
  if (!(cm > 0)) return 1.0;
  // 90cm baseline, clamped so absurd data does not blow up VFX.
  return clamp(cm / 90, 0.5, 1.7);
}

function sanitizeProfileObject(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const length = Number(profile.length);
  const widthScale = Number(profile.widthScale);
  const handleStart = Number(profile.handleStart);
  const alphaStopsSrc = Array.isArray(profile.alphaStops) ? profile.alphaStops : null;
  let alphaStops = null;
  if (alphaStopsSrc && alphaStopsSrc.length >= 2) {
    alphaStops = alphaStopsSrc
      .map((it) => [Number(it?.[0]), Number(it?.[1])])
      .filter((it) => Number.isFinite(it[0]) && Number.isFinite(it[1]))
      .map((it) => [clamp(it[0], 0, 1), clamp(it[1], 0, 1)])
      .sort((a, b) => a[0] - b[0]);
  }
  return {
    length: Number.isFinite(length) ? clamp(length, 0.4, 2.0) : undefined,
    widthScale: Number.isFinite(widthScale) ? clamp(widthScale, 0.5, 1.8) : undefined,
    handleStart: Number.isFinite(handleStart) ? clamp(handleStart, 0, 0.85) : undefined,
    alphaStops: alphaStops || undefined,
  };
}

function resolveWeaponProfile(weaponClass, profileRef, weaponLengthCm) {
  const profileKey = typeof profileRef === 'string' ? profileRef : '';
  const baseFromClass = WEAPON_VFX_PROFILES[weaponClass] || DEFAULT_WEAPON_PROFILE;
  const baseFromKey = WEAPON_VFX_PROFILES[profileKey] || baseFromClass;
  const inline = sanitizeProfileObject(profileRef);
  const merged = inline ? { ...baseFromKey, ...inline } : baseFromKey;
  return {
    ...merged,
    length: (Number(merged.length) || 1.0) * coerceLengthScaleFromCm(weaponLengthCm),
  };
}

function profileAlpha(profile, t) {
  const stops = profile?.alphaStops || DEFAULT_WEAPON_PROFILE.alphaStops;
  const k = Math.max(0, Math.min(1, Number(t) || 0));
  for (let i = 1; i < stops.length; i++) {
    const [x0, a0] = stops[i - 1];
    const [x1, a1] = stops[i];
    if (k <= x1) {
      const span = Math.max(1e-6, x1 - x0);
      const localT = Math.max(0, Math.min(1, (k - x0) / span));
      return a0 + (a1 - a0) * localT;
    }
  }
  return stops[stops.length - 1][1];
}

// ── Angle helpers ─────────────────────────────────────────────────────────

// Resolve the primary direction for the slash VFX.
// facingVector (attacker's facing) takes priority; impactVector is the fallback.
function resolveBaseAngle(facingVec, impactVec) {
  if (facingVec && Number.isFinite(facingVec.dx) && Number.isFinite(facingVec.dy)) {
    const mag = Math.hypot(facingVec.dx, facingVec.dy);
    if (mag > 0) return Math.atan2(facingVec.dy, facingVec.dx);
  }
  if (impactVec) return Math.atan2(impactVec.dy || 0, impactVec.dx || 0);
  return 0;
}

// Simple deterministic jitter from a counter
function jitter(counter) {
  const x = Math.sin(counter * 7.31 + 2.17) * 0.5 + 0.5; // 0..1
  return (x - 0.5) * 0.5; // [-0.25, 0.25] radians
}

// ═══════════════════════════════════════════════════════════════════════════
// Controller
// ═══════════════════════════════════════════════════════════════════════════
export function createMeleeSlashFxController() {
  /** @type {MeleeSlashFx[]} */
  const _active = [];

  /** @type {{fx: MeleeSlashFx, delay: number}[]} */
  const _pending = [];

  // Per-attacker swing counter for alternation (left/right sweeps)
  /** @type {Map<number, number>} */
  const _swingCounter = new Map();

  function nextSwing(attackerId, offhand) {
    if (offhand) return _swingCounter.get(attackerId) || 0;
    const n = (_swingCounter.get(attackerId) || 0) + 1;
    _swingCounter.set(attackerId, n);
    return n;
  }

  // Dual-wield direction pairings — picked randomly each attack.
  const _DUAL_PAIRS = [[-1, -1], [+1, +1], [-1, +1], [+1, -1]];
  let _lastDualPair = null;

  function swingDirection(n, offhand) {
    if (!offhand) {
      // Pick a random pairing for this attack (main hand fires first).
      _lastDualPair = _DUAL_PAIRS[(Math.random() * 4) | 0];
      return _lastDualPair[0];
    }
    return (_lastDualPair || _DUAL_PAIRS[0])[1];
  }

  // ── Spawn helpers ─────────────────────────────────────────────────────

  function spawnSweep(x, y, facingVec, impactVec, weaponClass, profileRef, weaponLengthCm, elementTint, amount, critical, attackerId, offhand) {
    const n = nextSwing(attackerId, offhand);
    const baseAngle = resolveBaseAngle(facingVec, impactVec);
    const isAxe = (weaponClass === 'axe' || weaponClass === 'morningstar');
    const profile = resolveWeaponProfile(weaponClass, profileRef, weaponLengthCm);

    const direction = swingDirection(n, offhand);

    // Base sweep: swords 100°, axes 130°
    const baseSweep = isAxe ? (130 * Math.PI / 180) : (100 * Math.PI / 180);
    const sweep = baseSweep * damageSweepScale(amount) * direction;

    // Start angle: perpendicular to facing, offset by half sweep + jitter
    const startAngle = baseAngle - sweep / 2 + jitter(n) + (offhand ? Math.PI * 0.15 : 0);

    const baseCol = resolveBaseColor(weaponClass, elementTint);
    const color = damageColorShift(baseCol, amount, critical);
    const radius = damageRadiusScale(amount) * (isAxe ? 1.0 : 0.9) * profile.length * (offhand ? 0.92 : 1.0);
    const lw = (isAxe ? 0.18 : 0.13) * damageLineWidthScale(amount) * profile.widthScale;

    const fx = new MeleeSlashFx({
      x, y,
      startAngle,
      sweepAngle: sweep,
      radius,
      ttl: SWEEP_TTL,
      color,
      lineWidth: lw,
      style: 'sweep',
    });
    fx.weaponProfile = profile;
    return fx;
  }

  function spawnStab(x, y, facingVec, impactVec, weaponClass, profileRef, weaponLengthCm, elementTint, amount, critical, attackerId, offhand) {
    const n = nextSwing(attackerId, offhand);
    const baseAngle = resolveBaseAngle(facingVec, impactVec);
    const profile = resolveWeaponProfile(weaponClass || 'dagger', profileRef, weaponLengthCm);

    // Stab: very narrow arc (20-30°) in the facing direction
    // Alternate slightly left/right of center
    const sideOffset = swingDirection(n, offhand) * 0.15;
    const sweep = (25 * Math.PI / 180) * damageSweepScale(amount);
    const startAngle = baseAngle - sweep / 2 + sideOffset + jitter(n) * 0.5;

    const baseCol = resolveBaseColor('dagger', elementTint);
    const color = damageColorShift(baseCol, amount, critical);
    const radius = damageRadiusScale(amount) * 0.85 * profile.length * (offhand ? 0.9 : 1.0); // stabs are compact thrusts
    const lw = 0.10 * damageLineWidthScale(amount) * profile.widthScale;

    const fx = new MeleeSlashFx({
      x, y,
      startAngle,
      sweepAngle: sweep,
      radius,
      ttl: STAB_TTL,
      color,
      lineWidth: lw,
      style: 'stab',
    });
    fx.weaponProfile = profile;
    return fx;
  }

  function spawnImpact(x, y, facingVec, impactVec, weaponClass, profileRef, weaponLengthCm, elementTint, amount, critical, attackerId) {
    const n = nextSwing(attackerId);
    const baseAngle = resolveBaseAngle(facingVec, impactVec);
    const profile = resolveWeaponProfile(weaponClass, profileRef, weaponLengthCm);

    // Impact: wide but short burst — 160-200° centered on facing direction
    // Alternate the center offset
    const offsetAngle = (n % 3 === 0) ? 0 : ((n % 3 === 1) ? 0.3 : -0.3);
    const baseSweep = 170 * Math.PI / 180;
    const sweep = baseSweep * damageSweepScale(amount);
    const startAngle = baseAngle - sweep / 2 + offsetAngle;

    const baseCol = resolveBaseColor(weaponClass, elementTint);
    const color = damageColorShift(baseCol, amount, critical);
    const radius = damageRadiusScale(amount) * 0.65 * profile.length; // shorter radius — compact burst
    const lw = 0.22 * damageLineWidthScale(amount) * profile.widthScale; // thicker lines

    const fx = new MeleeSlashFx({
      x, y,
      startAngle,
      sweepAngle: sweep,
      radius,
      ttl: IMPACT_TTL,
      color,
      lineWidth: lw,
      style: 'impact',
    });
    fx.weaponProfile = profile;
    return fx;
  }

  function spawnParry(x, y, attackerPos) {
    const dx = (attackerPos?.x ?? x) - x;
    const dy = (attackerPos?.y ?? y) - y;
    const angle = Math.atan2(dy, dx);

    return new MeleeSlashFx({
      x, y,
      startAngle: angle - Math.PI * 0.5,
      sweepAngle: Math.PI,  // 180° spread for the spark fan
      radius: 0.5,
      ttl: PARRY_TTL,
      color: COL_PARRY,
      lineWidth: 0.10,
      style: 'parry',
    });
  }

  function spawnWhiff(x, y, attackerPos) {
    const dx = x - (attackerPos?.x ?? x);
    const dy = y - (attackerPos?.y ?? y);
    const angle = Math.atan2(dy, dx);

    return new MeleeSlashFx({
      x, y,
      startAngle: angle - Math.PI * 0.4,
      sweepAngle: Math.PI * 0.8,  // 144° ghostly sweep
      radius: 0.65,
      ttl: WHIFF_TTL,
      color: COL_WHIFF,
      lineWidth: 0.08,
      style: 'whiff',
    });
  }

  // ── Public API ────────────────────────────────────────────────────────

  function tick(dt) {
    // Advance pending (delayed) effects
    for (let i = _pending.length - 1; i >= 0; i--) {
      _pending[i].delay -= dt;
      if (_pending[i].delay <= 0) {
        _active.push(_pending[i].fx);
        _pending.splice(i, 1);
      }
    }
    // Advance active effects
    for (let i = _active.length - 1; i >= 0; i--) {
      _active[i].tick(dt);
      if (_active[i].expired) _active.splice(i, 1);
    }
  }

  function draw(ctx) {
    if (!_active.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < _active.length; i++) {
      const fx = _active[i];
      switch (fx.style) {
        case 'sweep':  drawSweep(ctx, fx);  break;
        case 'stab':   drawStab(ctx, fx);   break;
        case 'impact': drawImpact(ctx, fx); break;
        case 'parry':  drawParry(ctx, fx);  break;
        case 'whiff':  drawWhiff(ctx, fx);  break;
      }
    }

    ctx.restore();
  }

  // ── Draw routines ─────────────────────────────────────────────────────

  function drawSweep(ctx, fx) {
    const t = fx.progress;
    const alpha = fx.alpha;
    const [cr, cg, cb] = fx.color;
    const profile = fx.weaponProfile || DEFAULT_WEAPON_PROFILE;

    // Sweep grows to full over first 35% of lifetime
    const sweepT = Math.min(1, t * (1 / 0.35));
    const currentSweep = fx.sweepAngle * sweepT;
    const tipR = fx.radius * (0.7 + t * 0.3);
    const rootR = tipR * Math.max(0.05, Math.min(0.85, profile.handleStart));
    const midR = (rootR + tipR) * 0.5;
    const span = tipR - rootR;

    // Outer glow
    ctx.strokeStyle = `rgba(${cr|0},${cg|0},${cb|0},${(0.3 * alpha).toFixed(3)})`;
    ctx.lineWidth = span + 0.12 * (1 - t);
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, midR, fx.startAngle, fx.startAngle + currentSweep, currentSweep < 0);
    ctx.stroke();

    // Core slash — single thick arc with radial gradient for weapon bulk.
    const stops = profile.alphaStops || DEFAULT_WEAPON_PROFILE.alphaStops;
    const grad = ctx.createRadialGradient(fx.x, fx.y, rootR, fx.x, fx.y, tipR);
    for (let i = 0; i < stops.length; i++) {
      const pos = Math.max(0, Math.min(1, Number(stops[i][0]) || 0));
      const pA = Math.max(0, Math.min(1, Number(stops[i][1]) || 0));
      grad.addColorStop(pos, `rgba(255,250,245,${(0.75 * alpha * pA * (1 - t * 0.3)).toFixed(3)})`);
    }
    ctx.strokeStyle = grad;
    ctx.lineWidth = span;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, midR, fx.startAngle, fx.startAngle + currentSweep, currentSweep < 0);
    ctx.stroke();

    // Leading edge spark
    if (sweepT < 1) {
      const edgeAngle = fx.startAngle + currentSweep;
      const ex = fx.x + Math.cos(edgeAngle) * tipR;
      const ey = fx.y + Math.sin(edgeAngle) * tipR;
      ctx.fillStyle = `rgba(255,255,255,${(0.6 * alpha).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(ex, ey, 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStab(ctx, fx) {
    const t = fx.progress;
    const alpha = fx.alpha;
    const [cr, cg, cb] = fx.color;
    const profile = fx.weaponProfile || DEFAULT_WEAPON_PROFILE;

    // Stab: thrust line extends then fades
    const thrustT = Math.min(1, t * (1 / 0.25)); // fully extended at 25% lifetime
    const centerAngle = fx.startAngle + fx.sweepAngle / 2;
    const len = fx.radius * thrustT;

    const x0 = fx.x + Math.cos(centerAngle) * 0.08;
    const y0 = fx.y + Math.sin(centerAngle) * 0.08;
    const x1 = fx.x + Math.cos(centerAngle) * len;
    const y1 = fx.y + Math.sin(centerAngle) * len;

    // Outer glow
    ctx.strokeStyle = `rgba(${cr|0},${cg|0},${cb|0},${(0.30 * alpha).toFixed(3)})`;
    ctx.lineWidth = fx.lineWidth + 0.08;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    // Core gradient: handle lighter alpha, tip denser alpha.
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    const stops = profile.alphaStops || DEFAULT_WEAPON_PROFILE.alphaStops;
    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];
      const pos = Math.max(0, Math.min(1, Number(stop[0]) || 0));
      const pAlpha = Math.max(0, Math.min(1, Number(stop[1]) || 0));
      grad.addColorStop(pos, `rgba(255,252,250,${(0.78 * alpha * pAlpha).toFixed(3)})`);
    }
    ctx.strokeStyle = grad;
    ctx.lineWidth = fx.lineWidth;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    // Tip spark
    if (thrustT >= 0.8) {
      ctx.fillStyle = `rgba(255,255,255,${(0.5 * alpha * (1 - (thrustT - 0.8) / 0.2)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x1, y1, 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawImpact(ctx, fx) {
    const t = fx.progress;
    const alpha = fx.alpha;
    const [cr, cg, cb] = fx.color;
    const profile = fx.weaponProfile || DEFAULT_WEAPON_PROFILE;

    // Impact: expanding ring burst + radial lines
    const expandT = Math.min(1, t * (1 / 0.30));
    const tipR = fx.radius * (0.4 + expandT * 0.6);
    const rootR = tipR * Math.max(0.05, Math.min(0.85, profile.handleStart));
    const midR = (rootR + tipR) * 0.5;
    const span = tipR - rootR;

    // Thick ring with radial gradient for weapon bulk.
    const stops = profile.alphaStops || DEFAULT_WEAPON_PROFILE.alphaStops;
    const grad = ctx.createRadialGradient(fx.x, fx.y, rootR, fx.x, fx.y, tipR);
    for (let i = 0; i < stops.length; i++) {
      const pos = Math.max(0, Math.min(1, Number(stops[i][0]) || 0));
      const pA = Math.max(0, Math.min(1, Number(stops[i][1]) || 0));
      grad.addColorStop(pos, `rgba(${cr|0},${cg|0},${cb|0},${(0.4 * alpha * pA).toFixed(3)})`);
    }
    ctx.strokeStyle = grad;
    ctx.lineWidth = span * (1.5 - t);
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, midR, fx.startAngle, fx.startAngle + fx.sweepAngle);
    ctx.stroke();

    // Inner bright highlight
    ctx.strokeStyle = `rgba(255,240,220,${(0.6 * alpha * (1 - t * 0.5)).toFixed(3)})`;
    ctx.lineWidth = fx.lineWidth * 0.7;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, rootR + span * 0.72, fx.startAngle, fx.startAngle + fx.sweepAngle);
    ctx.stroke();

    // Radial impact lines bursting outward
    const centerAngle = fx.startAngle + fx.sweepAngle / 2;
    const lineCount = 5;
    const spread = fx.sweepAngle * 0.6;
    ctx.strokeStyle = `rgba(255,255,240,${(0.5 * alpha * (1 - t)).toFixed(3)})`;
    ctx.lineWidth = 0.06;
    ctx.lineCap = 'round';
    for (let j = 0; j < lineCount; j++) {
      const a = centerAngle - spread / 2 + (spread / (lineCount - 1)) * j;
      const r0 = rootR + span * 0.18;
      const r1 = tipR * (0.5 + expandT * 0.5);
      ctx.beginPath();
      ctx.moveTo(fx.x + Math.cos(a) * r0, fx.y + Math.sin(a) * r0);
      ctx.lineTo(fx.x + Math.cos(a) * r1, fx.y + Math.sin(a) * r1);
      ctx.stroke();
    }

    // Center flash (brief)
    if (t < 0.3) {
      const flashA = 0.4 * (1 - t / 0.3) * alpha;
      ctx.fillStyle = `rgba(255,250,230,${flashA.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 0.15 * (1 - t / 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParry(ctx, fx) {
    const t = fx.progress;
    const alpha = fx.alpha;
    const [cr, cg, cb] = fx.color;

    // Parry: starburst of short bright lines + central flash
    const sparkCount = 6;
    const spreadAngle = fx.sweepAngle;
    const centerAngle = fx.startAngle + spreadAngle / 2;

    const expandT = Math.min(1, t * (1 / 0.25));
    ctx.lineCap = 'round';
    for (let j = 0; j < sparkCount; j++) {
      const a = centerAngle - spreadAngle / 2 + (spreadAngle / (sparkCount - 1)) * j;
      const r0 = 0.05 + expandT * 0.08;
      const r1 = 0.15 + expandT * fx.radius * (0.6 + 0.4 * Math.sin(j * 2.3 + 1.7));

      const sparkAlpha = alpha * (0.6 + 0.4 * Math.sin(j * 3.1));
      ctx.strokeStyle = `rgba(${cr|0},${cg|0},${cb|0},${(0.8 * sparkAlpha).toFixed(3)})`;
      ctx.lineWidth = 0.05 + 0.03 * (1 - t);
      ctx.beginPath();
      ctx.moveTo(fx.x + Math.cos(a) * r0, fx.y + Math.sin(a) * r0);
      ctx.lineTo(fx.x + Math.cos(a) * r1, fx.y + Math.sin(a) * r1);
      ctx.stroke();
    }

    // Central flash
    if (t < 0.4) {
      const flashA = 0.7 * (1 - t / 0.4) * alpha;
      ctx.fillStyle = `rgba(255,255,240,${flashA.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 0.12 * (1 - t * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWhiff(ctx, fx) {
    const t = fx.progress;
    const alpha = fx.alpha;
    const [cr, cg, cb] = fx.color;

    // Whiff: faint, ghostly arc that sweeps through empty air
    const sweepT = Math.min(1, t * (1 / 0.30));
    const currentSweep = fx.sweepAngle * sweepT;
    const R = fx.radius * (0.8 + t * 0.2);

    // Ghostly outer trail — very faint
    ctx.strokeStyle = `rgba(${cr|0},${cg|0},${cb|0},${(0.15 * alpha).toFixed(3)})`;
    ctx.lineWidth = fx.lineWidth + 0.06;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, R + 0.06, fx.startAngle, fx.startAngle + currentSweep, currentSweep < 0);
    ctx.stroke();

    // Inner whisp — dashed for "through air" feel
    ctx.strokeStyle = `rgba(${cr|0},${cg|0},${cb|0},${(0.25 * alpha * (1 - t * 0.4)).toFixed(3)})`;
    ctx.lineWidth = fx.lineWidth;
    ctx.setLineDash([0.08, 0.06]);
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, R, fx.startAngle, fx.startAngle + currentSweep, currentSweep < 0);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Event wiring ──────────────────────────────────────────────────────

  function installListeners({ world, getPosition, isPlayer }) {
    // Melee hit: spawn weapon-appropriate slash VFX
    world.on('damaged', (ev) => {
      const { source, target, amount, critical, impactProfile, impactVector, offhand, cause } = ev;
      // Only fire for melee weapon hits (impactProfile present, cause is melee)
      if (!impactProfile) return;
      if (cause !== 'melee') return;

      // Skip unarmed — this visual language is for weapon-wielders only
      const weaponClass = impactProfile.weaponClass || 'weapon';
      if (weaponClass === 'unarmed') return;

      const a = Number(source || 0) | 0;
      const t = Number(target || 0) | 0;
      if (!(a > 0) || !(t > 0)) return;

      const apos = getPosition(a);
      const tpos = getPosition(t);
      if (!tpos) return;

      // Place FX origin 60% from attacker toward target — near the weapon's reach,
      // close to the attacker's facing dot rather than centered on the target.
      const ox = apos ? apos.x + (tpos.x - apos.x) * 0.6 : tpos.x;
      const oy = apos ? apos.y + (tpos.y - apos.y) * 0.6 : tpos.y;

      const attackKind = impactProfile.attackKind || 'strike';
      const facingVec = impactProfile.facingVector || null;
      const elementTint = impactProfile.elementTint || null;
      const profileRef = impactProfile.weaponVfxProfile || null;
      const weaponLengthCm = Number(impactProfile.weaponLengthCm || 0) || null;

      let fxEntry;
      if (attackKind === 'stab') {
        fxEntry = spawnStab(ox, oy, facingVec, impactVector, weaponClass, profileRef, weaponLengthCm, elementTint, amount, critical, a, offhand);
      } else if (attackKind === 'blunt') {
        fxEntry = spawnImpact(ox, oy, facingVec, impactVector, weaponClass, profileRef, weaponLengthCm, elementTint, amount, critical, a);
      } else {
        // slash / strike → sweep
        fxEntry = spawnSweep(ox, oy, facingVec, impactVector, weaponClass, profileRef, weaponLengthCm, elementTint, amount, critical, a, offhand);
      }

      if (offhand) {
        _pending.push({ fx: fxEntry, delay: OFFHAND_DELAY });
      } else {
        _active.push(fxEntry);
      }
    });

    // Parry spark — at the contact point between the two fighters
    world.on('combat:parry', ({ defender, attacker, at }) => {
      const dId = Number(defender || 0) | 0;
      const aId = Number(attacker || 0) | 0;
      const defPos = at || getPosition(dId);
      const atkPos = getPosition(aId);
      if (!defPos) return;

      const ox = atkPos ? atkPos.x + (defPos.x - atkPos.x) * 0.6 : defPos.x;
      const oy = atkPos ? atkPos.y + (defPos.y - atkPos.y) * 0.6 : defPos.y;
      _active.push(spawnParry(ox, oy, atkPos));
    });

    // Miss whiff — awkward swing through air on a failed to-hit roll
    world.on('status', (ev) => {
      if (!ev || ev.kind !== 'miss' || !ev.source) return;
      const aId = Number(ev.source) | 0;
      const dId = Number(ev.id) | 0;
      if (!(aId > 0)) return;
      const atkPos = getPosition(aId);
      const defPos = getPosition(dId);
      if (!defPos) return;

      const ox = atkPos ? atkPos.x + (defPos.x - atkPos.x) * 0.6 : defPos.x;
      const oy = atkPos ? atkPos.y + (defPos.y - atkPos.y) * 0.6 : defPos.y;
      _active.push(spawnWhiff(ox, oy, atkPos));
    });

    // Dodge whiff — originates from the attacker's swing
    world.on('combat:dodge', ({ defender, attacker, at }) => {
      const dId = Number(defender || 0) | 0;
      const aId = Number(attacker || 0) | 0;
      const defPos = at || getPosition(dId);
      const atkPos = getPosition(aId);
      if (!defPos) return;

      const ox = atkPos ? atkPos.x + (defPos.x - atkPos.x) * 0.6 : defPos.x;
      const oy = atkPos ? atkPos.y + (defPos.y - atkPos.y) * 0.6 : defPos.y;
      _active.push(spawnWhiff(ox, oy, atkPos));
    });
  }

  return { tick, draw, installListeners };
}
