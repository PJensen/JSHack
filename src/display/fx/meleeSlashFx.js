// display/fx/meleeSlashFx.js
// Melee attack visual language: sweeps, stabs, impacts, parry sparks, dodge whiffs.
// Each weapon class + attack kind maps to a distinct visual primitive so combat
// reads expressively — no two consecutive swings should look identical.

import { MeleeSlashFx } from "./fxEntries.js";

// ── Timing ─────────────────────────────────────────────────────────────────
const SWEEP_TTL       = 0.14;   // sword/axe arc lifetime
const STAB_TTL        = 0.11;   // dagger thrust
const IMPACT_TTL      = 0.13;   // mace/blunt burst
const PARRY_TTL       = 0.10;   // metallic spark
const WHIFF_TTL       = 0.18;   // ghostly miss trail (lingers slightly)
const OFFHAND_DELAY   = 0.15;   // match bump/gore offhand delay

// ── Weapon colour palettes [r, g, b] ──────────────────────────────────────
const COL_BLADE   = [220, 230, 240]; // pale steel
const COL_AXE     = [240, 220, 200]; // warm steel
const COL_BLUNT   = [255, 200, 140]; // amber
const COL_DAGGER  = [240, 245, 255]; // cold white
const COL_DEFAULT = [230, 230, 230]; // neutral
const COL_PARRY   = [255, 255, 220]; // bright metallic yellow-white
const COL_WHIFF   = [180, 190, 210]; // ghostly blue-grey

// ── Damage colour shift ───────────────────────────────────────────────────
// Lerps the base weapon colour toward hot white/red as damage increases.
const DMG_SCALE_CAP = 12;

function lerpColor(base, t) {
  // t: 0 = base colour, 1 = hot red-white [255, 180, 160]
  const hot = [255, 180, 160];
  return [
    base[0] + (hot[0] - base[0]) * t,
    base[1] + (hot[1] - base[1]) * t,
    base[2] + (hot[2] - base[2]) * t,
  ];
}

function damageColorShift(baseColor, amount, critical) {
  const t = Math.min(1, (amount || 0) / DMG_SCALE_CAP);
  const shifted = lerpColor(baseColor, t * 0.6);
  if (critical) {
    // Crits push further toward white
    return lerpColor(shifted, 0.35);
  }
  return shifted;
}

// ── Size scaling ──────────────────────────────────────────────────────────
function damageRadiusScale(amount) {
  if (!(amount > 0)) return 0.85;
  return 0.85 + Math.min(0.45, Math.log(1 + amount / 3) * 0.25);
}

function damageSweepScale(amount) {
  // Wider sweep for bigger hits
  if (!(amount > 0)) return 1.0;
  return 1.0 + Math.min(0.3, amount / DMG_SCALE_CAP * 0.3);
}

function damageLineWidthScale(amount) {
  if (!(amount > 0)) return 1.0;
  return 1.0 + Math.min(0.5, amount / DMG_SCALE_CAP * 0.5);
}

// ── Angle helpers ─────────────────────────────────────────────────────────
function impactAngle(iv) {
  if (!iv) return 0;
  return Math.atan2(iv.dy || 0, iv.dx || 0);
}

// Simple deterministic jitter from a counter
function jitter(counter) {
  // Returns a value in [-0.25, 0.25] radians
  const x = Math.sin(counter * 7.31 + 2.17) * 0.5 + 0.5; // 0..1
  return (x - 0.5) * 0.5;
}

// ── Weapon class → base colour ────────────────────────────────────────────
function baseColorForWeapon(weaponClass) {
  switch (weaponClass) {
    case 'sword':       return COL_BLADE;
    case 'axe':         return COL_AXE;
    case 'mace':        return COL_BLUNT;
    case 'morningstar': return COL_BLUNT;
    case 'dagger':      return COL_DAGGER;
    default:            return COL_DEFAULT;
  }
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

  function nextSwing(attackerId) {
    const n = (_swingCounter.get(attackerId) || 0) + 1;
    _swingCounter.set(attackerId, n);
    return n;
  }

  // ── Spawn helpers ─────────────────────────────────────────────────────

  function spawnSweep(x, y, impactVec, weaponClass, amount, critical, attackerId, offhand) {
    const n = nextSwing(attackerId);
    const baseAngle = impactAngle(impactVec);
    const isAxe = (weaponClass === 'axe' || weaponClass === 'morningstar');

    // Alternate: even swings go CW (positive sweep), odd go CCW (negative)
    const direction = (n % 2 === 0) ? 1 : -1;

    // Base sweep: swords 100°, axes 130°
    const baseSweep = isAxe ? (130 * Math.PI / 180) : (100 * Math.PI / 180);
    const sweep = baseSweep * damageSweepScale(amount) * direction;

    // Start angle: perpendicular to impact direction, offset by half sweep + jitter
    const startAngle = baseAngle - sweep / 2 + jitter(n) + (offhand ? Math.PI * 0.15 : 0);

    const baseCol = baseColorForWeapon(weaponClass);
    const color = damageColorShift(baseCol, amount, critical);
    const radius = damageRadiusScale(amount) * (isAxe ? 1.1 : 1.0);
    const lw = (isAxe ? 0.18 : 0.13) * damageLineWidthScale(amount);

    return new MeleeSlashFx({
      x, y,
      startAngle,
      sweepAngle: sweep,
      radius,
      ttl: SWEEP_TTL,
      color,
      lineWidth: lw,
      style: 'sweep',
    });
  }

  function spawnStab(x, y, impactVec, amount, critical, attackerId, offhand) {
    const n = nextSwing(attackerId);
    const baseAngle = impactAngle(impactVec);

    // Stab: very narrow arc (20-30°) in the impact direction
    // Alternate slightly left/right of center
    const sideOffset = (n % 2 === 0) ? 0.15 : -0.15;
    const sweep = (25 * Math.PI / 180) * damageSweepScale(amount);
    const startAngle = baseAngle - sweep / 2 + sideOffset + jitter(n) * 0.5;

    const color = damageColorShift(COL_DAGGER, amount, critical);
    const radius = damageRadiusScale(amount) * 1.15; // stabs reach a bit further
    const lw = 0.10 * damageLineWidthScale(amount);

    return new MeleeSlashFx({
      x, y,
      startAngle,
      sweepAngle: sweep,
      radius,
      ttl: STAB_TTL,
      color,
      lineWidth: lw,
      style: 'stab',
    });
  }

  function spawnImpact(x, y, impactVec, weaponClass, amount, critical, attackerId) {
    const n = nextSwing(attackerId);
    const baseAngle = impactAngle(impactVec);

    // Impact: wide but short burst — 160-200° centered on impact direction
    // Alternate the center offset
    const offsetAngle = (n % 3 === 0) ? 0 : ((n % 3 === 1) ? 0.3 : -0.3);
    const baseSweep = 170 * Math.PI / 180;
    const sweep = baseSweep * damageSweepScale(amount);
    const startAngle = baseAngle - sweep / 2 + offsetAngle;

    const baseCol = baseColorForWeapon(weaponClass);
    const color = damageColorShift(baseCol, amount, critical);
    const radius = damageRadiusScale(amount) * 0.75; // shorter radius — compact burst
    const lw = 0.22 * damageLineWidthScale(amount); // thicker lines

    return new MeleeSlashFx({
      x, y,
      startAngle,
      sweepAngle: sweep,
      radius,
      ttl: IMPACT_TTL,
      color,
      lineWidth: lw,
      style: 'impact',
    });
  }

  function spawnParry(x, y, attackerPos) {
    // Spark burst at the contact point
    const dx = (attackerPos?.x ?? x) - x;
    const dy = (attackerPos?.y ?? y) - y;
    const angle = Math.atan2(dy, dx);

    // Parry: small starburst of 3 short arcs radiating from contact
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

    // Whiff: wide faint arc sweeping through the dodge location
    return new MeleeSlashFx({
      x, y,
      startAngle: angle - Math.PI * 0.4,
      sweepAngle: Math.PI * 0.8,  // 144° ghostly sweep
      radius: 0.9,
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

    // Sweep grows to full over first 35% of lifetime
    const sweepT = Math.min(1, t * (1 / 0.35));
    const currentSweep = fx.sweepAngle * sweepT;
    const R = fx.radius * (0.7 + t * 0.3);

    // Outer glow
    ctx.strokeStyle = `rgba(${cr|0},${cg|0},${cb|0},${(0.3 * alpha).toFixed(3)})`;
    ctx.lineWidth = fx.lineWidth + 0.12 * (1 - t);
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, R + 0.10, fx.startAngle, fx.startAngle + currentSweep, currentSweep < 0);
    ctx.stroke();

    // Core slash — brighter, thinner
    ctx.strokeStyle = `rgba(255,250,245,${(0.75 * alpha * (1 - t * 0.3)).toFixed(3)})`;
    ctx.lineWidth = fx.lineWidth;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, R, fx.startAngle, fx.startAngle + currentSweep, currentSweep < 0);
    ctx.stroke();

    // Leading edge spark
    if (sweepT < 1) {
      const edgeAngle = fx.startAngle + currentSweep;
      const ex = fx.x + Math.cos(edgeAngle) * R;
      const ey = fx.y + Math.sin(edgeAngle) * R;
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

    // Stab: a quick thrust line that extends then fades
    const thrustT = Math.min(1, t * (1 / 0.25)); // fully extended at 25% lifetime
    const centerAngle = fx.startAngle + fx.sweepAngle / 2;
    const len = fx.radius * thrustT;

    // Thrust line from source toward target
    const x0 = fx.x + Math.cos(centerAngle) * 0.15;
    const y0 = fx.y + Math.sin(centerAngle) * 0.15;
    const x1 = fx.x + Math.cos(centerAngle) * len;
    const y1 = fx.y + Math.sin(centerAngle) * len;

    // Outer glow
    ctx.strokeStyle = `rgba(${cr|0},${cg|0},${cb|0},${(0.35 * alpha).toFixed(3)})`;
    ctx.lineWidth = fx.lineWidth + 0.08;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    // Core — bright white
    ctx.strokeStyle = `rgba(255,252,250,${(0.8 * alpha).toFixed(3)})`;
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

    // Impact: expanding ring burst + radial lines
    const expandT = Math.min(1, t * (1 / 0.30));
    const R = fx.radius * (0.4 + expandT * 0.6);

    // Thick ring
    ctx.strokeStyle = `rgba(${cr|0},${cg|0},${cb|0},${(0.4 * alpha).toFixed(3)})`;
    ctx.lineWidth = fx.lineWidth * (1.5 - t);
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, R, fx.startAngle, fx.startAngle + fx.sweepAngle);
    ctx.stroke();

    // Inner bright ring
    ctx.strokeStyle = `rgba(255,240,220,${(0.6 * alpha * (1 - t * 0.5)).toFixed(3)})`;
    ctx.lineWidth = fx.lineWidth * 0.7;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, R * 0.7, fx.startAngle, fx.startAngle + fx.sweepAngle);
    ctx.stroke();

    // Radial impact lines (4-5 short lines bursting outward)
    const centerAngle = fx.startAngle + fx.sweepAngle / 2;
    const lineCount = 5;
    const spread = fx.sweepAngle * 0.6;
    ctx.strokeStyle = `rgba(255,255,240,${(0.5 * alpha * (1 - t)).toFixed(3)})`;
    ctx.lineWidth = 0.06;
    ctx.lineCap = 'round';
    for (let j = 0; j < lineCount; j++) {
      const a = centerAngle - spread / 2 + (spread / (lineCount - 1)) * j;
      const r0 = R * 0.3;
      const r1 = R * (0.5 + expandT * 0.5);
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

    // Spark lines radiate outward
    const expandT = Math.min(1, t * (1 / 0.20));
    ctx.lineCap = 'round';
    for (let j = 0; j < sparkCount; j++) {
      const a = centerAngle - spreadAngle / 2 + (spreadAngle / (sparkCount - 1)) * j;
      const r0 = 0.05 + expandT * 0.08;
      const r1 = 0.15 + expandT * fx.radius * (0.6 + 0.4 * Math.sin(j * 2.3 + 1.7));

      // Each spark gets slightly different brightness
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
    // Faster sweep, lower opacity, slightly wavy
    const sweepT = Math.min(1, t * (1 / 0.30));
    const currentSweep = fx.sweepAngle * sweepT;
    const R = fx.radius * (0.8 + t * 0.2);

    // Ghostly outer trail — very faint
    ctx.strokeStyle = `rgba(${cr|0},${cg|0},${cb|0},${(0.15 * alpha).toFixed(3)})`;
    ctx.lineWidth = fx.lineWidth + 0.06;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, R + 0.06, fx.startAngle, fx.startAngle + currentSweep, currentSweep < 0);
    ctx.stroke();

    // Inner whisp — slightly brighter but still ghostly
    ctx.strokeStyle = `rgba(${cr|0},${cg|0},${cb|0},${(0.25 * alpha * (1 - t * 0.4)).toFixed(3)})`;
    ctx.lineWidth = fx.lineWidth;
    ctx.setLineDash([0.08, 0.06]); // dashed for that "through air" feel
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
      // Only fire for melee weapon hits (impactProfile present)
      if (!impactProfile) return;
      if (cause !== 'melee') return;

      const a = Number(source || 0) | 0;
      const t = Number(target || 0) | 0;
      if (!(a > 0) || !(t > 0)) return;

      const tpos = getPosition(t);
      if (!tpos) return;

      const weaponClass = impactProfile.weaponClass || 'weapon';
      const attackKind = impactProfile.attackKind || 'strike';

      let fx;
      if (attackKind === 'stab') {
        fx = spawnStab(tpos.x, tpos.y, impactVector, amount, critical, a, offhand);
      } else if (attackKind === 'blunt') {
        fx = spawnImpact(tpos.x, tpos.y, impactVector, weaponClass, amount, critical, a);
      } else {
        // slash / strike → sweep
        fx = spawnSweep(tpos.x, tpos.y, impactVector, weaponClass, amount, critical, a, offhand);
      }

      if (offhand) {
        _pending.push({ fx, delay: OFFHAND_DELAY });
      } else {
        _active.push(fx);
      }
    });

    // Parry spark
    world.on('combat:parry', ({ defender, attacker, at }) => {
      const dId = Number(defender || 0) | 0;
      const aId = Number(attacker || 0) | 0;
      const defPos = at || getPosition(dId);
      const atkPos = getPosition(aId);
      if (!defPos) return;

      _active.push(spawnParry(defPos.x, defPos.y, atkPos));
    });

    // Dodge whiff
    world.on('combat:dodge', ({ defender, attacker, at }) => {
      const dId = Number(defender || 0) | 0;
      const aId = Number(attacker || 0) | 0;
      const defPos = at || getPosition(dId);
      const atkPos = getPosition(aId);
      if (!defPos) return;

      _active.push(spawnWhiff(defPos.x, defPos.y, atkPos));
    });
  }

  return { tick, draw, installListeners };
}
