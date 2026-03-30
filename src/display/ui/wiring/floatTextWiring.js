// src/display/ui/wiring/floatTextWiring.js
// Float text + proc VFX wiring: vampiric, thorns, burning, fierce, healed,
// died (pet UI), damaged, status, ranged:no-ammo, attack:insufficient-stamina.

import { Particle } from "../../passes/vfx/particles/particlePool.js";
import { normalizeStatusEvent } from "../../../shared/events/statusEvent.js";

const _installed = Symbol.for('jshack:display:floatTextWiring:installed');

const _staminaLines = [
  'Too exhausted!',
  'Your arms feel heavy...',
  'You can barely lift your weapon!',
  'You gasp for breath...',
  'Your muscles refuse!',
  'Not enough strength...',
  'You stagger with fatigue!',
  'Your body protests!',
];

const STATUS_LABEL_BY_KIND = Object.freeze({
  miss: 'MISS',
  immune: 'IMMUNE',
  resist: 'RESIST',
  taunt: '!',
  alert: '!',
});

const STATUS_LABEL_BY_EFFECT = Object.freeze({
  taunt: '!',
  stoneskin: 'STONESKIN',
  resist_fire: 'FIRE RESIST',
  resist_poison: 'POISON RESIST',
  resist_electric: 'LIGHTNING RESIST',
  resist_acid: 'ACID RESIST',
});

function resolveStatusLabel(kind, effect) {
  const effectKey = String(effect || '').trim().toLowerCase();
  if (effectKey && STATUS_LABEL_BY_EFFECT[effectKey]) return STATUS_LABEL_BY_EFFECT[effectKey];
  const kindKey = String(kind || '').trim().toLowerCase();
  if (kindKey && STATUS_LABEL_BY_KIND[kindKey]) return STATUS_LABEL_BY_KIND[kindKey];
  return kindKey ? kindKey.toUpperCase() : 'STATUS';
}

const GORE_KEYWORDS = Object.freeze({
  bone: ['skeleton', 'bone', 'skull', 'zombie'],
  slime: ['slime', 'ooze', 'gel', 'jelly', 'cube'],
  none: ['ghost', 'wisp', 'shade', 'spectral', 'spirit', 'shadow'],
});

function normalizedGoreType(goreType, targetKind) {
  const explicit = String(goreType || '').trim().toLowerCase();
  if (explicit === 'blood' || explicit === 'ichor' || explicit === 'spark' || explicit === 'bone' || explicit === 'slime') return explicit;
  const kind = String(targetKind || '').trim().toLowerCase();
  if (!kind) return explicit === 'none' ? 'none' : 'blood';
  for (let i = 0; i < GORE_KEYWORDS.none.length; i++) {
    if (kind.includes(GORE_KEYWORDS.none[i])) return 'none';
  }
  for (let i = 0; i < GORE_KEYWORDS.slime.length; i++) {
    if (kind.includes(GORE_KEYWORDS.slime[i])) return 'slime';
  }
  for (let i = 0; i < GORE_KEYWORDS.bone.length; i++) {
    if (kind.includes(GORE_KEYWORDS.bone[i])) return 'bone';
  }
  return explicit === 'none' ? 'none' : 'blood';
}

/**
 * Install float text + proc VFX event listeners.
 * @param {{
 *   world: import('../../../lib/ecs-js/index.js').World,
 *   ftext: { addStatus: Function, addHeal: Function, addDamage: Function },
 *   fx: { pool: { spawn: Function } },
 *   getPosition: (id: number) => ({ x:number, y:number } | null),
 *   isVisibleAt?: (x:number, y:number) => boolean,
 *   isPet: (id: number) => boolean,
 *   isPlayer?: (id: number) => boolean,
 * }} deps
 */
export function installFloatTextWiring({ world, ftext, fx, getPosition, isVisibleAt, isPet, isPlayer }) {
  if (/** @type {any} */ (world)[_installed]) return;
  /** @type {any} */ (world)[_installed] = true;
  const canShowAt = (x, y) => (
    Number.isFinite(Number(x))
    && Number.isFinite(Number(y))
    && (typeof isVisibleAt !== 'function' || !!isVisibleAt(Number(x), Number(y)))
  );
  /** @type {Map<number, { goreType:string, damageType:string, amount:number, critical:boolean, dx:number, dy:number }>} */
  const lastImpactByTarget = new Map();

  // Proc VFX: vampiric life-steal
  world.on('proc:vampiric', ({ actor, target, amount }) => {
    const apos = getPosition(Number(actor || 0));
    const tpos = getPosition(Number(target || 0));
    if (!apos || !canShowAt(apos.x, apos.y)) return;
    ftext.addStatus(apos.x, apos.y - 0.3, 'LIFESTEAL', { color: '#ff4040', life: 0.6 });
    if (tpos) {
      const dx = apos.x - tpos.x, dy = apos.y - tpos.y;
      const dist = Math.hypot(dx, dy) || 1;
      for (let i = 0; i < 6; i++) {
        const spd = 1.5 + Math.random() * 1.0;
        fx.pool.spawn(new Particle({
          x: tpos.x + (Math.random() - 0.5) * 0.3,
          y: tpos.y + (Math.random() - 0.5) * 0.3,
          vx: (dx / dist) * spd + (Math.random() - 0.5) * 0.5,
          vy: (dy / dist) * spd + (Math.random() - 0.5) * 0.5,
          life: 0.35 + Math.random() * 0.15,
          size0: 0.15, size1: 0.04,
          r: 200, g: 50, b: 50,
          a0: 0.85,
        }));
      }
    }
  });

  // Proc VFX: thorns retaliation
  world.on('proc:thorns', ({ actor, target }) => {
    const tpos = getPosition(Number(target || 0));
    if (!tpos || !canShowAt(tpos.x, tpos.y)) return;
    ftext.addStatus(tpos.x, tpos.y - 0.3, 'THORNS', { color: '#78ff78', life: 0.6 });
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 0.8 + Math.random() * 0.6;
      fx.pool.spawn(new Particle({
        x: tpos.x, y: tpos.y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 0.2 + Math.random() * 0.15,
        size0: 0.12, size1: 0.03,
        r: 120, g: 255, b: 120,
        a0: 0.9,
      }));
    }
  });

  // Proc VFX: burning applied (one-shot ignite burst)
  world.on('proc:burning', ({ actor, target }) => {
    const tpos = getPosition(Number(target || 0));
    if (!tpos || !canShowAt(tpos.x, tpos.y)) return;
    ftext.addStatus(tpos.x, tpos.y - 0.3, 'BURNING', { color: '#ff6600', life: 0.6 });
    for (let i = 0; i < 8; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
      const spd = 0.6 + Math.random() * 0.8;
      fx.pool.spawn(new Particle({
        x: tpos.x + (Math.random() - 0.5) * 0.2,
        y: tpos.y + (Math.random() - 0.5) * 0.2,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        ay: -0.4,
        life: 0.3 + Math.random() * 0.2,
        size0: 0.18, size1: 0.04,
        r: 255, g: 140 + (Math.random() * 60) | 0, b: 20,
        a0: 0.9,
      }));
    }
  });

  world.on('proc:flaming_bat:hit', ({ target }) => {
    const tpos = getPosition(Number(target || 0));
    if (!tpos || !canShowAt(tpos.x, tpos.y)) return;
    try {
      ftext.addStatus(tpos.x, tpos.y - 0.28, 'SCORCH', { color: '#ff7a38', life: 0.55 });
    } catch (e) { console.debug('[floatTextWiring] flaming bat ftext failed:', e); }
  });

  // Proc VFX: fierce bonus damage
  world.on('proc:fierce', ({ actor, target }) => {
    const tpos = getPosition(Number(target || 0));
    if (!tpos || !canShowAt(tpos.x, tpos.y)) return;
    ftext.addStatus(tpos.x, tpos.y + 0.3, '+1', { color: '#ffa040', life: 0.4 });
  });

  function spawnBloodBurst(wx, wy, { amount = 4, hue = 'blood' } = {}) {
    const count = Math.max(10, Math.min(44, 10 + ((Number(amount) || 4) * 3) | 0));
    const bloodHue = hue === 'ichor'
      ? { r: 104, g: 165, b: 84 }
      : (hue === 'spark'
        ? { r: 240, g: 206, b: 112 }
        : { r: 168, g: 24, b: 24 });
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.5 + Math.random() * 2.2;
      fx.pool.spawn(new Particle({
        x: wx + 0.5 + (Math.random() - 0.5) * 0.14,
        y: wy + 0.5 + (Math.random() - 0.5) * 0.14,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 0.25,
        ay: 1.4,
        life: 0.16 + Math.random() * 0.42,
        size0: 0.07 + Math.random() * 0.08,
        size1: 0.01 + Math.random() * 0.02,
        r: Math.min(255, bloodHue.r + ((Math.random() * 34) | 0)),
        g: Math.min(255, bloodHue.g + ((Math.random() * 20) | 0)),
        b: Math.min(255, bloodHue.b + ((Math.random() * 16) | 0)),
        a0: 0.92,
        a1: 0,
      }));
    }
    const poolCount = Math.max(3, Math.min(16, 2 + ((Number(amount) || 4) | 0)));
    for (let i = 0; i < poolCount; i++) {
      fx.pool.spawn(new Particle({
        x: wx + 0.5 + (Math.random() - 0.5) * 0.34,
        y: wy + 0.5 + (Math.random() - 0.5) * 0.34,
        vx: 0,
        vy: 0,
        life: 10 + Math.random() * 14,
        size0: 0.05 + Math.random() * 0.05,
        size1: 0.14 + Math.random() * 0.16,
        r: Math.max(0, bloodHue.r - 10),
        g: Math.max(0, bloodHue.g - 8),
        b: Math.max(0, bloodHue.b - 8),
        a0: 0.72,
        a1: 0,
      }));
    }
  }

  world.on('proc:bleeding', ({ target }) => {
    const pos = getPosition(Number(target || 0));
    if (!pos || !canShowAt(pos.x, pos.y) || !fx?.pool) return;
    spawnBloodBurst(pos.x, pos.y, { amount: 6, hue: 'blood' });
  });

  world.on('proc:hemorrhage', ({ target }) => {
    const pos = getPosition(Number(target || 0));
    if (!pos || !canShowAt(pos.x, pos.y) || !fx?.pool) return;
    spawnBloodBurst(pos.x, pos.y, { amount: 11, hue: 'blood' });
    for (let i = 0; i < 10; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 1.1 + Math.random() * 1.8;
      fx.pool.spawn(new Particle({
        x: pos.x + 0.5,
        y: pos.y + 0.5,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 0.25,
        ay: 0.10,
        life: 0.46 + Math.random() * 0.45,
        size0: 0.11 + Math.random() * 0.09,
        size1: 0.03,
        r: 182 + ((Math.random() * 40) | 0),
        g: 24 + ((Math.random() * 16) | 0),
        b: 24 + ((Math.random() * 16) | 0),
        a0: 0.95,
        a1: 0.08,
        rotVel: (Math.random() - 0.5) * 9,
      }));
    }
  });

  // Heal floating text (message handled in messageWiring)
  world.on('healed', ({ id, amount }) => {
    const pos = getPosition(Number(id || 0));
    if (pos && canShowAt(pos.x, pos.y) && Number.isFinite(amount)) {
      try { ftext.addHeal(pos.x, pos.y, amount, { color: '#7BFF7B' }); } catch (e) { console.debug('[floatTextWiring] ftext failed:', e); }
    }
  });

  // Pet death UI notification (message handled in messageWiring)
  world.on('died', ({ id }) => {
    if (isPet(Number(id || 0))) {
      try {
        window.dispatchEvent(new CustomEvent('ui:petExists', {
          detail: { exists: false }
        }));
      } catch (e) { console.debug('[floatTextWiring] dispatch ui:petExists:', e); }
    }
  });

  // ── Melee gore VFX helpers ──────────────────────────────────────────
  // Gore type is passed through the damaged event from monster data.
  // 'blood' = fleshy, 'none' = dry/skeletal (suppressed), 'ichor' = aberrations, 'spark' = constructs.
  const GORE_STYLE = Object.freeze({
    blood: Object.freeze({
      splatBase: { r: 140, g: 18, b: 18 },
      splatVar: { r: 40, g: 12, b: 0 },
      gib: { r: 160, g: 30, b: 30 },
      stain: { r: 90, g: 10, b: 10 },
      splatLifeMin: 0.25, splatLifeSpan: 0.30,
      gibLifeMin: 0.40, gibLifeSpan: 0.40,
      stainLifeMin: 10.0, stainLifeSpan: 8.0,
      stainAlpha0: 0.52,
      allowGib: true,
      gravity: 0.08,
      gibGravity: 0.16,
    }),
    ichor: Object.freeze({
      splatBase: { r: 86, g: 160, b: 48 },
      splatVar: { r: 32, g: 44, b: 30 },
      gib: { r: 110, g: 175, b: 85 },
      stain: { r: 54, g: 94, b: 40 },
      splatLifeMin: 0.28, splatLifeSpan: 0.34,
      gibLifeMin: 0.45, gibLifeSpan: 0.38,
      stainLifeMin: 11.0, stainLifeSpan: 9.0,
      stainAlpha0: 0.48,
      allowGib: true,
      gravity: 0.06,
      gibGravity: 0.14,
    }),
    spark: Object.freeze({
      splatBase: { r: 245, g: 205, b: 90 },
      splatVar: { r: 10, g: 35, b: 45 },
      gib: { r: 255, g: 220, b: 120 },
      stain: { r: 88, g: 62, b: 28 },
      splatLifeMin: 0.22, splatLifeSpan: 0.22,
      gibLifeMin: 0.30, gibLifeSpan: 0.24,
      stainLifeMin: 8.0, stainLifeSpan: 6.0,
      stainAlpha0: 0.36,
      allowGib: false,
      gravity: 0.03,
      gibGravity: 0.08,
    }),
    bone: Object.freeze({
      splatBase: { r: 208, g: 198, b: 176 },
      splatVar: { r: 20, g: 20, b: 20 },
      gib: { r: 236, g: 226, b: 206 },
      stain: { r: 126, g: 114, b: 98 },
      splatLifeMin: 0.24, splatLifeSpan: 0.26,
      gibLifeMin: 0.46, gibLifeSpan: 0.44,
      stainLifeMin: 6.0, stainLifeSpan: 4.0,
      stainAlpha0: 0.34,
      allowGib: true,
      gravity: 0.12,
      gibGravity: 0.22,
    }),
    slime: Object.freeze({
      splatBase: { r: 84, g: 176, b: 88 },
      splatVar: { r: 35, g: 45, b: 30 },
      gib: { r: 112, g: 206, b: 120 },
      stain: { r: 48, g: 104, b: 52 },
      splatLifeMin: 0.34, splatLifeSpan: 0.42,
      gibLifeMin: 0.52, gibLifeSpan: 0.46,
      stainLifeMin: 12.0, stainLifeSpan: 8.0,
      stainAlpha0: 0.58,
      allowGib: true,
      gravity: 0.04,
      gibGravity: 0.08,
    }),
  });

  function pickGoreStyle(goreType) {
    const key = String(goreType || 'blood').toLowerCase();
    return GORE_STYLE[key] || GORE_STYLE.blood;
  }

  function isGoreImpactCause(cause) {
    const c = String(cause || '').toLowerCase();
    if (!c) return false;
    if (c === 'melee' || c === 'retaliation' || c === 'offhand' || c === 'ranged') return true;
    if (c === 'spike_trap' || c === 'shock_trap') return true;
    if (c.startsWith('spell:') && !c.endsWith(':tick') && c !== 'spell:flash_heal') return true;
    return false;
  }

  function classifyDamage(damageType) {
    const k = String(damageType || 'physical').toLowerCase();
    return Object.freeze({
      slashLike: k.includes('slash') || k.includes('cut'),
      pierceLike: k.includes('pierce') || k.includes('stab'),
      bluntLike: k.includes('blunt') || k.includes('bash') || k.includes('crush'),
      fireLike: k.includes('fire') || k.includes('burn'),
      acidLike: k.includes('acid') || k.includes('poison') || k.includes('toxic'),
      shockLike: k.includes('electric') || k.includes('lightning') || k.includes('shock'),
      coldLike: k.includes('cold') || k.includes('frost') || k.includes('ice'),
    });
  }

  function tintForDamage(color, damageType) {
    const t = classifyDamage(damageType);
    if (t.fireLike) return { r: Math.min(255, color.r + 24), g: Math.min(255, color.g + 12), b: Math.max(0, color.b - 8) };
    if (t.acidLike) return { r: Math.max(0, color.r - 14), g: Math.min(255, color.g + 24), b: Math.max(0, color.b - 16) };
    if (t.shockLike) return { r: Math.min(255, color.r + 20), g: Math.min(255, color.g + 22), b: Math.min(255, color.b + 8) };
    if (t.coldLike) return { r: Math.max(0, color.r - 20), g: Math.max(0, color.g - 6), b: Math.min(255, color.b + 24) };
    return color;
  }

  function normalizedPhysicalSignature(signature, damageType) {
    const bluntIn = Math.max(0, Number(signature?.blunt || 0));
    const pierceIn = Math.max(0, Number(signature?.pierce || 0));
    const slashIn = Math.max(0, Number(signature?.slash || 0));
    const kind = String(damageType || 'physical').toLowerCase();
    const seeded = (bluntIn + pierceIn + slashIn) > 0
      ? { blunt: bluntIn, pierce: pierceIn, slash: slashIn }
      : (kind === 'blunt'
        ? { blunt: 1, pierce: 0, slash: 0 }
        : (kind === 'pierce'
          ? { blunt: 0, pierce: 1, slash: 0 }
          : (kind === 'slash'
            ? { blunt: 0, pierce: 0, slash: 1 }
            : { blunt: 0.34, pierce: 0.33, slash: 0.33 })));
    const total = seeded.blunt + seeded.pierce + seeded.slash;
    if (!(total > 0)) return { blunt: 0.34, pierce: 0.33, slash: 0.33 };
    return {
      blunt: seeded.blunt / total,
      pierce: seeded.pierce / total,
      slash: seeded.slash / total,
    };
  }

  function meleeProfileForImpact(impactProfile, damageType, critHit) {
    const weaponClass = String(impactProfile?.weaponClass || '').toLowerCase();
    const attackKind = String(impactProfile?.attackKind || '').toLowerCase();
    const sig = normalizedPhysicalSignature(impactProfile?.signature, damageType);
    const sideSign = Math.random() < 0.5 ? -1 : 1;

    const classSideScale = weaponClass === 'mace' ? 0.35
      : (weaponClass === 'morningstar' ? 0.75
        : (weaponClass === 'dagger' ? 0.70 : 1.0));
    const classForward = weaponClass === 'dagger' ? 0.62
      : (weaponClass === 'mace' ? 0.45
        : (weaponClass === 'morningstar' ? 0.55 : 0.52));
    const classFanBonus = weaponClass === 'sword' ? 0.10
      : (weaponClass === 'axe' ? 0.08
        : (weaponClass === 'mace' ? -0.08 : 0));
    const kindFanBonus = attackKind === 'slash' ? 0.08 : (attackKind === 'stab' ? -0.04 : -0.06);

    const fan = 0.16
      + sig.slash * 0.64
      + sig.pierce * 0.24
      + sig.blunt * 0.10
      + classFanBonus
      + kindFanBonus
      + (critHit ? 0.08 : 0);
    const baseSpeed = 0.65
      + sig.pierce * 0.95
      + sig.slash * 0.55
      + sig.blunt * 0.25
      + (weaponClass === 'morningstar' ? 0.10 : 0);
    const speedSpan = 0.80
      + sig.slash * 0.85
      + sig.pierce * 0.70
      + sig.blunt * 0.25
      + (critHit ? 0.30 : 0);
    const sideShift = (0.05 + sig.slash * 0.18 + sig.pierce * 0.12 + sig.blunt * 0.04) * classSideScale;
    const originForward = classForward;
    const splatScale = 0.74 + sig.slash * 0.40 + sig.pierce * 0.14 + sig.blunt * 0.04 + (critHit ? 0.16 : 0);
    const lifeScale = 0.86 + sig.blunt * 0.34 + sig.slash * 0.12 + sig.pierce * 0.06 + (critHit ? 0.10 : 0);
    const stainScale = 0.78 + sig.blunt * 0.52 + sig.slash * 0.16 + sig.pierce * 0.08;
    const gibScale = 0.64 + sig.blunt * 0.28 + sig.slash * 0.32 + sig.pierce * 0.10 + (critHit ? 0.20 : 0);
    const backwardBias = Math.max(
      0,
      Math.min(
        0.78,
        sig.blunt * 0.55
          + (attackKind === 'blunt' ? 0.22 : 0)
          + (weaponClass === 'mace' ? 0.12 : 0),
      ),
    );

    return {
      sideSign,
      fan: Math.max(0.08, fan),
      baseSpeed: Math.max(0.4, baseSpeed),
      speedSpan: Math.max(0.3, speedSpan),
      sideShift: Math.max(0.02, sideShift),
      originForward: Math.max(0.4, originForward),
      splatScale: Math.max(0.4, splatScale),
      lifeScale: Math.max(0.6, lifeScale),
      stainScale: Math.max(0.4, stainScale),
      gibScale: Math.max(0.35, gibScale),
      backwardBias,
      signature: sig,
      weaponClass,
      attackKind,
    };
  }

  function spawnGore(pool, wx, wy, dx, dy, dmg, isCrit, goreType, damageType) {
    const style = pickGoreStyle(goreType);
    const dmgFlags = classifyDamage(damageType);
    const slashLike = dmgFlags.slashLike || dmgFlags.pierceLike;
    const bluntLike = dmgFlags.bluntLike;
    const isSpark = style === GORE_STYLE.spark;
    const splatColor = tintForDamage(style.splatBase, damageType);
    const gibColor = tintForDamage(style.gib, damageType);
    const stainColor = tintForDamage(style.stain, damageType);

    // Directional spray away from attacker.
    const splatCount = Math.min(28, 7 + ((dmg * 1.5) | 0) + (slashLike ? 5 : 0) + (isCrit ? 8 : 0));
    for (let i = 0; i < splatCount; i++) {
      const spread = (Math.random() - 0.5) * (slashLike ? 1.1 : 1.7);
      const speed = (slashLike ? 1.25 : 0.95) + Math.random() * (slashLike ? 2.0 : 1.8) + (isCrit ? 0.45 : 0);
      pool.spawn(new Particle({
        x: wx + 0.5, y: wy + 0.5,
        vx: dx * speed + spread * 0.6,
        vy: dy * speed + spread * 0.6,
        ax: 0, ay: style.gravity,
        life: style.splatLifeMin + Math.random() * style.splatLifeSpan,
        size0: isSpark ? (0.05 + Math.random() * 0.03) : (0.08 + Math.random() * 0.06),
        size1: isSpark ? 0.01 : 0.02,
        r: Math.min(255, splatColor.r + ((Math.random() * style.splatVar.r) | 0)),
        g: Math.min(255, splatColor.g + ((Math.random() * style.splatVar.g) | 0)),
        b: Math.min(255, splatColor.b + ((Math.random() * style.splatVar.b) | 0)),
        a0: isSpark ? 0.95 : 0.85,
        a1: 0,
      }));
    }

    // Chunky debris for blood/ichor only.
    if (style.allowGib && (isCrit || dmg >= 8)) {
      const gibCount = isCrit ? 8 + ((Math.random() * 5) | 0) : 3 + ((Math.random() * 2) | 0);
      for (let i = 0; i < gibCount; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 0.6 + Math.random() * 1.2;
        pool.spawn(new Particle({
          x: wx + 0.5, y: wy + 0.5,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 0.5,
          ax: 0, ay: style.gibGravity,
          life: style.gibLifeMin + Math.random() * style.gibLifeSpan,
          size0: 0.11 + Math.random() * 0.10,
          size1: 0.04,
          r: gibColor.r, g: gibColor.g, b: gibColor.b,
          a0: 0.9, a1: 0.1,
          rotVel: (Math.random() - 0.5) * 8,
        }));
      }
    }

    // Floor stain with longer persistence.
    const stainCount = bluntLike ? (dmg >= 5 ? 9 : 4) : (dmg >= 5 ? 7 : 3);
    for (let i = 0; i < stainCount; i++) {
      pool.spawn(new Particle({
        x: wx + 0.5 + (Math.random() - 0.5) * 0.42,
        y: wy + 0.5 + (Math.random() - 0.5) * 0.36,
        vx: 0, vy: 0,
        life: style.stainLifeMin + 4 + Math.random() * (style.stainLifeSpan + 8),
        size0: 0.05 + Math.random() * 0.07,
        size1: 0.16 + Math.random() * 0.16,
        r: stainColor.r, g: stainColor.g, b: stainColor.b,
        a0: Math.min(0.9, style.stainAlpha0 + 0.18), a1: 0,
      }));
    }
  }

  function spawnArrowImpactGore(pool, wx, wy, dx, dy, dmg, isCrit, goreType, damageType) {
    const style = pickGoreStyle(goreType);
    const dmgFlags = classifyDamage(damageType);
    const slashLike = dmgFlags.slashLike || dmgFlags.pierceLike;
    const isSpark = style === GORE_STYLE.spark;
    const splatColor = tintForDamage(style.splatBase, damageType);
    const gibColor = tintForDamage(style.gib, damageType);
    const stainColor = tintForDamage(style.stain, damageType);

    const splatCount = Math.min(26, 6 + ((dmg * 1.2) | 0) + (isCrit ? 6 : 0));
    for (let i = 0; i < splatCount; i++) {
      const forward = 0.14 + Math.random() * 0.42;
      const side = (Math.random() - 0.5) * (slashLike ? 0.26 : 0.34);
      const drift = (Math.random() - 0.5) * (slashLike ? 0.28 : 0.38);
      const speed = 1.0 + Math.random() * 1.9 + (isCrit ? 0.3 : 0);
      pool.spawn(new Particle({
        x: wx + 0.5 + dx * forward - dy * side,
        y: wy + 0.5 + dy * forward + dx * side,
        vx: dx * speed - dy * drift,
        vy: dy * speed + dx * drift,
        ax: 0,
        ay: style.gravity,
        life: style.splatLifeMin + Math.random() * style.splatLifeSpan,
        size0: isSpark ? (0.05 + Math.random() * 0.03) : (0.08 + Math.random() * 0.06),
        size1: isSpark ? 0.01 : 0.02,
        r: Math.min(255, splatColor.r + ((Math.random() * style.splatVar.r) | 0)),
        g: Math.min(255, splatColor.g + ((Math.random() * style.splatVar.g) | 0)),
        b: Math.min(255, splatColor.b + ((Math.random() * style.splatVar.b) | 0)),
        a0: isSpark ? 0.95 : 0.85,
        a1: 0,
      }));
    }

    if (style.allowGib && (isCrit || dmg >= 10)) {
      const gibCount = isCrit ? 5 + ((Math.random() * 3) | 0) : 2 + ((Math.random() * 2) | 0);
      for (let i = 0; i < gibCount; i++) {
        const side = (Math.random() - 0.5) * 0.30;
        const speed = 0.7 + Math.random() * 1.1;
        pool.spawn(new Particle({
          x: wx + 0.5 + dx * 0.2,
          y: wy + 0.5 + dy * 0.2,
          vx: dx * speed - dy * side,
          vy: dy * speed + dx * side - 0.45,
          ax: 0,
          ay: style.gibGravity,
          life: style.gibLifeMin + Math.random() * style.gibLifeSpan,
          size0: 0.11 + Math.random() * 0.10,
          size1: 0.04,
          r: gibColor.r,
          g: gibColor.g,
          b: gibColor.b,
          a0: 0.9,
          a1: 0.1,
          rotVel: (Math.random() - 0.5) * 8,
        }));
      }
    }

    const stainCount = dmg >= 5 ? 5 : 3;
    for (let i = 0; i < stainCount; i++) {
      const forward = 0.1 + Math.random() * 0.34;
      const side = (Math.random() - 0.5) * 0.2;
      pool.spawn(new Particle({
        x: wx + 0.5 + dx * forward - dy * side,
        y: wy + 0.5 + dy * forward + dx * side,
        vx: 0,
        vy: 0,
        life: style.stainLifeMin + 3 + Math.random() * (style.stainLifeSpan + 6),
        size0: 0.05 + Math.random() * 0.07,
        size1: 0.14 + Math.random() * 0.14,
        r: stainColor.r,
        g: stainColor.g,
        b: stainColor.b,
        a0: Math.min(0.9, style.stainAlpha0 + 0.15),
        a1: 0,
      }));
    }
  }

  function spawnMeleeImpactGore(pool, wx, wy, dx, dy, dmg, isCrit, goreType, damageType, impactProfile) {
    const style = pickGoreStyle(goreType);
    const view = meleeProfileForImpact(impactProfile, damageType, isCrit);
    const splatColor = tintForDamage(style.splatBase, damageType);
    const gibColor = tintForDamage(style.gib, damageType);
    const stainColor = tintForDamage(style.stain, damageType);
    const isSpark = style === GORE_STYLE.spark;
    const fx = Number(impactProfile?.facingVector?.dx);
    const fy = Number(impactProfile?.facingVector?.dy);
    const fMag = Math.hypot(fx, fy);
    const fwdx = fMag > 0 ? (fx / fMag) : dx;
    const fwdy = fMag > 0 ? (fy / fMag) : dy;
    const sidex = -fwdy;
    const sidey = fwdx;

    const jitter = (Math.random() - 0.5) * (0.06 + view.signature.slash * 0.04);
    const sideOffset = view.sideSign * view.sideShift + jitter;
    const ox = wx + 0.5 + fwdx * view.originForward + sidex * sideOffset;
    const oy = wy + 0.5 + fwdy * view.originForward + sidey * sideOffset;

    const splatCount = Math.min(36, Math.max(5, Math.floor((7 + dmg * 1.5 + (isCrit ? 7 : 0)) * view.splatScale)));
    for (let i = 0; i < splatCount; i++) {
      const sideThrow = (Math.random() - 0.5) * view.fan + (view.sideSign * 0.08 * view.signature.slash);
      const speed = view.baseSpeed + Math.random() * view.speedSpan;
      const backward = Math.random() * view.backwardBias;
      const travel = speed * (1 - backward * (1.1 + Math.random() * 0.6));
      pool.spawn(new Particle({
        x: ox,
        y: oy,
        vx: fwdx * travel + sidex * sideThrow,
        vy: fwdy * travel + sidey * sideThrow,
        ax: 0,
        ay: style.gravity,
        life: (style.splatLifeMin + Math.random() * style.splatLifeSpan) * view.lifeScale,
        size0: isSpark ? (0.05 + Math.random() * 0.03) : (0.08 + Math.random() * 0.06),
        size1: isSpark ? 0.01 : 0.02,
        r: Math.min(255, splatColor.r + ((Math.random() * style.splatVar.r) | 0)),
        g: Math.min(255, splatColor.g + ((Math.random() * style.splatVar.g) | 0)),
        b: Math.min(255, splatColor.b + ((Math.random() * style.splatVar.b) | 0)),
        a0: isSpark ? 0.95 : 0.85,
        a1: 0,
      }));
    }

    if (style.allowGib && (isCrit || dmg >= 8)) {
      const gibCountBase = isCrit ? 8 + ((Math.random() * 5) | 0) : 3 + ((Math.random() * 2) | 0);
      const gibCount = Math.max(1, Math.min(14, Math.floor(gibCountBase * view.gibScale)));
      for (let i = 0; i < gibCount; i++) {
        const sideThrow = (Math.random() - 0.5) * (0.40 + view.signature.slash * 0.20);
        const speed = 0.55 + Math.random() * (0.9 + view.signature.pierce * 0.3 + view.signature.blunt * 0.15);
        const travel = speed * (1 - Math.random() * view.backwardBias);
        pool.spawn(new Particle({
          x: ox,
          y: oy,
          vx: fwdx * travel + sidex * sideThrow,
          vy: fwdy * travel + sidey * sideThrow - 0.5,
          ax: 0,
          ay: style.gibGravity,
          life: (style.gibLifeMin + Math.random() * style.gibLifeSpan) * view.lifeScale,
          size0: 0.11 + Math.random() * 0.10,
          size1: 0.04,
          r: gibColor.r,
          g: gibColor.g,
          b: gibColor.b,
          a0: 0.9,
          a1: 0.1,
          rotVel: (Math.random() - 0.5) * 8,
        }));
      }
    }

    const stainCountBase = view.signature.blunt > 0.45
      ? (dmg >= 5 ? 9 : 4)
      : (dmg >= 5 ? 7 : 3);
    const stainCount = Math.max(2, Math.min(14, Math.floor(stainCountBase * view.stainScale)));
    for (let i = 0; i < stainCount; i++) {
      const forward = 0.05 + Math.random() * (0.22 + view.signature.pierce * 0.16);
      const side = (Math.random() - 0.5) * (0.22 + view.signature.slash * 0.10);
      pool.spawn(new Particle({
        x: wx + 0.5 + fwdx * forward + sidex * side,
        y: wy + 0.5 + fwdy * forward + sidey * side,
        vx: 0,
        vy: 0,
        life: style.stainLifeMin + 4 + Math.random() * (style.stainLifeSpan + 8),
        size0: 0.05 + Math.random() * 0.07,
        size1: 0.16 + Math.random() * 0.16,
        r: stainColor.r,
        g: stainColor.g,
        b: stainColor.b,
        a0: Math.min(0.9, style.stainAlpha0 + 0.18),
        a1: 0,
      }));
    }
  }

  function spawnDeathGore(pool, wx, wy, dx, dy, amount, goreType, damageType, critical) {
    const style = pickGoreStyle(goreType);
    const d = Math.max(4, Number(amount) || 4);
    const crit = !!critical;
    const burstScale = crit ? 1.35 : 1.0;
    const sprayColor = tintForDamage(style.splatBase, damageType);
    const baseSpray = Math.min(54, 10 + ((d * 1.15) | 0) + (crit ? 6 : 0));
    for (let i = 0; i < baseSpray; i++) {
      const bias = 0.10 + Math.random() * 0.32;
      const side = (Math.random() - 0.5) * 0.22;
      const vx = dx * (bias * burstScale) + (-dy * side);
      const vy = (dy * (bias * 0.26 * burstScale)) + (dx * side * 0.18) + (Math.random() * 0.18);
      pool.spawn(new Particle({
        x: wx + 0.5 + (Math.random() - 0.5) * 0.22,
        y: wy + 0.5 + (Math.random() - 0.5) * 0.22,
        vx,
        vy,
        ay: 2.4 + Math.random() * 1.0,
        life: 0.10 + Math.random() * 0.16,
        size0: 0.09 + Math.random() * 0.08,
        size1: 0.01,
        r: Math.min(255, sprayColor.r + ((Math.random() * style.splatVar.r) | 0)),
        g: Math.min(255, sprayColor.g + ((Math.random() * style.splatVar.g) | 0)),
        b: Math.min(255, sprayColor.b + ((Math.random() * style.splatVar.b) | 0)),
        a0: 0.95,
        a1: 0,
      }));
    }

    const gutsColor = tintForDamage(style.gib, damageType);
    const gutsCount = Math.min(18, 4 + ((d * 0.55) | 0) + (crit ? 3 : 0));
    for (let i = 0; i < gutsCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.04 + Math.random() * 0.18;
      pool.spawn(new Particle({
        x: wx + 0.5 + (Math.random() - 0.5) * 0.16,
        y: wy + 0.5 + (Math.random() - 0.5) * 0.12,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd * 0.12 + (Math.random() * 0.06),
        ay: 1.8 + Math.random() * 0.8,
        life: 0.30 + Math.random() * 0.55,
        size0: 0.12 + Math.random() * 0.12,
        size1: 0.03 + Math.random() * 0.03,
        r: gutsColor.r,
        g: gutsColor.g,
        b: gutsColor.b,
        a0: 0.94,
        a1: 0.05,
        rotVel: (Math.random() - 0.5) * 4,
      }));
    }

    const poolColor = tintForDamage(style.stain, damageType);
    const puddles = Math.min(28, 10 + ((d * 0.8) | 0) + (crit ? 5 : 0));
    for (let i = 0; i < puddles; i++) {
      pool.spawn(new Particle({
        x: wx + 0.22 + Math.random() * 0.56,
        y: wy + 0.46 + Math.random() * 0.34,
        vx: 0,
        vy: 0,
        life: 18 + Math.random() * 24,
        size0: 0.05 + Math.random() * 0.08,
        size1: 0.18 + Math.random() * 0.18,
        r: poolColor.r,
        g: poolColor.g,
        b: poolColor.b,
        a0: Math.min(0.86, style.stainAlpha0 + 0.2),
        a1: 0,
      }));
    }
  }

  // Floating text hooks: damage (messages handled in messageWiring)
  world.on('damaged', ({ target, source, amount, rawAmount, type, cause, critical, crit, at, offhand, projectileDelay, impactVector, projectileKind, impactProfile, targetKind, goreType }) => {
    const t = Number(target || 0) || 0;
    const pos = (at && typeof at.x === 'number' && typeof at.y === 'number') ? at : getPosition(t);
    const hitIsPlayer = typeof isPlayer === 'function' ? !!isPlayer(t) : false;
    if (pos && canShowAt(pos.x, pos.y) && Number.isFinite(amount)) {
      const resisted = Number.isFinite(rawAmount) && rawAmount > amount;
      const col = hitIsPlayer ? '#ff6060' : (resisted ? '#b0a060' : '#ffd966');
      const delay = Number(projectileDelay) || (offhand ? 0.15 : 0);
      ftext.addDamage(pos.x, pos.y, amount, { dmg: amount, color: col, crit: !!(critical || crit), delay });
    }
    const resolvedGoreType = normalizedGoreType(goreType, targetKind);

    // Melee gore VFX — blood splatter, gibs, and pools (fleshy creatures only)
    const causeStr = String(cause || '');
    if (pos && fx?.pool && amount > 0
        && isGoreImpactCause(causeStr)
        && resolvedGoreType !== 'none') {
      const srcPos = getPosition(Number(source || 0));
      let dx = 0, dy = 0;
      if (srcPos) {
        dx = pos.x - srcPos.x; dy = pos.y - srcPos.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        dx /= len; dy /= len;
      } else {
        const a = Math.random() * Math.PI * 2;
        dx = Math.cos(a); dy = Math.sin(a);
      }
      const impact = impactVector && Number.isFinite(Number(impactVector.dx)) && Number.isFinite(Number(impactVector.dy))
        ? { dx: Number(impactVector.dx), dy: Number(impactVector.dy) }
        : null;
      if (impact) {
        const len = Math.hypot(impact.dx, impact.dy) || 1;
        dx = impact.dx / len;
        dy = impact.dy / len;
      }
      const critHit = !!(critical || crit);
      const lcCause = String(causeStr).toLowerCase();
      if (lcCause === 'ranged' && String(projectileKind || '').toLowerCase() === 'arrow') {
        spawnArrowImpactGore(fx.pool, pos.x, pos.y, dx, dy, amount, critHit, resolvedGoreType, type);
      } else if (lcCause === 'melee') {
        spawnMeleeImpactGore(fx.pool, pos.x, pos.y, dx, dy, amount, critHit, resolvedGoreType, type, impactProfile);
      } else {
        spawnGore(fx.pool, pos.x, pos.y, dx, dy, amount, critHit, resolvedGoreType, type);
      }
      lastImpactByTarget.set(t, {
        goreType: resolvedGoreType,
        damageType: String(type || 'physical'),
        amount: Math.max(1, Number(amount) || 1),
        critical: critHit,
        dx,
        dy,
      });
    } else if (t > 0) {
      lastImpactByTarget.delete(t);
    }
  });

  world.on('died', ({ id }) => {
    const deadId = Number(id || 0) | 0;
    if (!(deadId > 0) || !fx?.pool) return;
    const pos = getPosition(deadId);
    const rec = lastImpactByTarget.get(deadId);
    lastImpactByTarget.delete(deadId);
    if (!pos || !canShowAt(pos.x, pos.y) || !rec || rec.goreType === 'none') return;
    spawnDeathGore(
      fx.pool,
      pos.x,
      pos.y,
      rec.dx,
      rec.dy,
      rec.amount + 4,
      rec.goreType,
      rec.damageType,
      rec.critical,
    );
  });

  // Status floating text (messages handled in messageWiring)
  world.on('status', (payload) => {
    const { id, kind, effect, at, masked } = normalizeStatusEvent(payload);
    const pos = (at && typeof at.x === 'number' && typeof at.y === 'number') ? at : getPosition(Number(id || 0));
    if (!pos || !canShowAt(pos.x, pos.y)) return;
    const kindLower = (String(kind || '')).toLowerCase();
    const style = kindLower === 'miss' ? 'miss' : (kindLower === 'immune' ? 'immune' : 'status');
    const label = masked ? kindLower.toUpperCase() || 'STATUS' : resolveStatusLabel(kind, effect);
    const opts = { style };
    if (kindLower === 'taunt' || kindLower === 'alert') opts.color = '#ffdd00';
    try { ftext.addStatus(pos.x, pos.y, label, opts); } catch (e) { console.debug('[floatTextWiring] ftext failed:', e); }
  });

  world.on('monster:ability:windup', ({ actor, abilityName, at }) => {
    const pos = (at && Number.isFinite(at.x) && Number.isFinite(at.y))
      ? { x: Number(at.x), y: Number(at.y) }
      : getPosition(Number(actor || 0));
    if (!pos || !canShowAt(pos.x, pos.y)) return;
    const label = String(abilityName || 'ABILITY').trim().toUpperCase();
    try {
      ftext.addStatus(pos.x, pos.y - 0.35, `${label}!`, {
        color: '#ffb347',
        life: 0.9,
        scaleStart: 1.2,
        scaleEnd: 1.0,
      });
    } catch (e) { console.debug('[floatTextWiring] ability windup ftext failed:', e); }
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const speed = 0.22 + Math.random() * 0.25;
      try {
        fx.pool.spawn(new Particle({
          x: pos.x,
          y: pos.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.28 + Math.random() * 0.15,
          size0: 0.12,
          size1: 0.02,
          r: 255,
          g: 190,
          b: 90,
          a0: 0.85,
        }));
      } catch {}
    }
  });

  world.on('monster:ability:cast', ({ actor, abilityName }) => {
    const pos = getPosition(Number(actor || 0));
    if (!pos || !canShowAt(pos.x, pos.y)) return;
    const label = String(abilityName || 'ABILITY').trim().toUpperCase();
    try {
      ftext.addStatus(pos.x, pos.y - 0.45, `${label}`, {
        color: '#ff5f5f',
        life: 0.7,
        scaleStart: 1.1,
        scaleEnd: 0.95,
      });
    } catch (e) { console.debug('[floatTextWiring] ability cast ftext failed:', e); }
  });

  // Ranged combat floating text (messages handled in messageWiring)
  world.on('ranged:no-ammo', ({ attacker }) => {
    const pos = getPosition(Number(attacker || 0));
    if (pos && canShowAt(pos.x, pos.y)) try { ftext.addStatus(pos.x, pos.y, 'NO AMMO', { style: 'status' }); } catch (e) { console.debug('[floatTextWiring] ftext failed:', e); }
  });

  // Insufficient stamina floating flavor text (message handled in messageWiring)
  world.on('attack:insufficient-stamina', ({ attacker }) => {
    const pos = getPosition(Number(attacker || 0));
    if (pos && canShowAt(pos.x, pos.y)) {
      const line = _staminaLines[Math.floor(Math.random() * _staminaLines.length)];
      try { ftext.addStatus(pos.x, pos.y - 0.3, line, { color: '#ff8c00', life: 1.0 }); } catch (e) { console.debug('[floatTextWiring] ftext failed:', e); }
    }
  });

  // Rampage: bold red float text when berserk activates.
  world.on('spell:rampage', ({ actor }) => {
    const pos = getPosition(Number(actor || 0));
    if (pos && canShowAt(pos.x, pos.y)) {
      try {
        ftext.addStatus(pos.x, pos.y - 0.45, 'RAMPAGE!', {
          color: '#ff3a10',
          life: 1.4,
          scaleStart: 1.6,
          scaleEnd: 1.0,
        });
      } catch (e) { console.debug('[floatTextWiring] rampage ftext failed:', e); }
    }
  });

  // Scorch: "SCORCHED" float text at target.
  world.on('spell:scorch', ({ at, fizzle, missed }) => {
    if (fizzle || missed) return;
    if (!at || !canShowAt(at.x, at.y)) return;
    try {
      ftext.addStatus(at.x, at.y - 0.3, 'SCORCHED', {
        color: '#ff6600',
        life: 1.2,
        scaleStart: 1.2,
        scaleEnd: 0.9,
      });
    } catch (e) { console.debug('[floatTextWiring] scorch ftext failed:', e); }
  });

  // Earthshatter: "EARTHQUAKE!" float text at origin.
  world.on('spell:earthshatter', ({ origin, enhanced }) => {
    if (!origin || !canShowAt(origin.x, origin.y)) return;
    try {
      ftext.addStatus(origin.x, origin.y - 0.45, 'EARTHQUAKE!', {
        color: enhanced ? '#ff5500' : '#8b7355',
        life: 1.3,
        scaleStart: 1.5,
        scaleEnd: 1.0,
      });
    } catch (e) { console.debug('[floatTextWiring] earthshatter ftext failed:', e); }
  });

  // Gaze stun: strong psychic lock burst on the player.
  world.on('proc:gaze:stun', ({ target }) => {
    const pos = getPosition(Number(target || 0));
    if (!pos || !canShowAt(pos.x, pos.y)) return;
    try {
      ftext.addStatus(pos.x, pos.y - 0.45, 'MIND LOCK!', {
        color: '#ff5fd2',
        life: 1.35,
        scaleStart: 1.5,
        scaleEnd: 1.0,
      });
    } catch (e) {
      console.debug('[floatTextWiring] gaze stun ftext failed:', e);
    }
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.4 + Math.random() * 0.6;
      try {
        fx.pool.spawn(new Particle({
          x: pos.x,
          y: pos.y - 0.1,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.15,
          life: 0.25 + Math.random() * 0.2,
          size0: 0.12,
          size1: 0.03,
          r: 255,
          g: 95,
          b: 210,
          a0: 0.9,
        }));
      } catch (e) {
        console.debug('[floatTextWiring] gaze stun fx failed:', e);
      }
    }
  });

  // Mimic revealed: warning burst at mimic position.
  world.on('mimic:revealed', ({ at }) => {
    if (!at || !canShowAt(at.x, at.y)) return;
    try {
      ftext.addStatus(at.x, at.y - 0.45, 'MIMIC!', {
        color: '#ff8844',
        life: 1.4,
        scaleStart: 1.6,
        scaleEnd: 1.0,
      });
    } catch (e) { console.debug('[floatTextWiring] mimic reveal ftext failed:', e); }
  });

  // Scroll of Polymorph: burst at transformed enemy position.
  world.on('scroll:polymorph:vfx', ({ x, y }) => {
    if (!canShowAt(x, y)) return;
    try {
      ftext.addStatus(x, y - 0.45, 'POLYMORPH!', {
        color: '#dd77ff',
        life: 1.4,
        scaleStart: 1.5,
        scaleEnd: 1.0,
      });
    } catch (e) { console.debug('[floatTextWiring] polymorph ftext failed:', e); }
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.3 + Math.random() * 0.5;
      try {
        fx.pool.spawn(new Particle({
          x,
          y: y - 0.1,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.1,
          life: 0.3 + Math.random() * 0.2,
          size0: 0.10,
          size1: 0.02,
          r: 221,
          g: 119,
          b: 255,
          a0: 0.85,
        }));
      } catch (e) { console.debug('[floatTextWiring] polymorph fx failed:', e); }
    }
  });

  // Nymph stole item: float at player position.
  world.on('nymph:stole', ({ at }) => {
    if (!at || !canShowAt(at.x, at.y)) return;
    try {
      ftext.addStatus(at.x, at.y - 0.45, 'STOLEN!', {
        color: '#88ddaa',
        life: 1.3,
        scaleStart: 1.5,
        scaleEnd: 1.0,
      });
    } catch (e) { console.debug('[floatTextWiring] nymph stole ftext failed:', e); }
  });

  // Nymph blinked away: shimmer at landing.
  world.on('nymph:blinked', ({ to }) => {
    if (!to || !canShowAt(to.x, to.y)) return;
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.2 + Math.random() * 0.4;
      try {
        fx.pool.spawn(new Particle({
          x: to.x, y: to.y - 0.1,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.1,
          life: 0.3 + Math.random() * 0.2,
          size0: 0.1, size1: 0.02,
          r: 136, g: 221, b: 170,
          a0: 0.8, a1: 0.0,
        }));
      } catch (e) { console.debug('[floatTextWiring] nymph blink fx failed:', e); }
    }
  });

  // Rust monster corroded equipment: float at defender.
  world.on('proc:corroded', ({ target }) => {
    const pos = getPosition(Number(target || 0));
    if (!pos || !canShowAt(pos.x, pos.y)) return;
    try {
      ftext.addStatus(pos.x, pos.y - 0.45, 'CORRODED!', {
        color: '#cc7744',
        life: 1.2,
        scaleStart: 1.4,
        scaleEnd: 1.0,
      });
    } catch (e) { console.debug('[floatTextWiring] corroded ftext failed:', e); }
  });

  // Permanent trait gained from corpse eating
  world.on('corpse:trait-gained', ({ actor, name }) => {
    const pos = getPosition(Number(actor || 0));
    if (!pos || !canShowAt(pos.x, pos.y)) return;
    const label = String(name || 'TRAIT').toUpperCase();
    try {
      ftext.addStatus(pos.x, pos.y - 0.5, label + '!', {
        color: '#ffd966',
        life: 1.8,
        scaleStart: 1.6,
        scaleEnd: 1.0,
      });
    } catch (e) {
      console.debug('[floatTextWiring] trait gained ftext failed:', e);
    }
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.3 + Math.random() * 0.5;
      try {
        fx.pool.spawn(new Particle({
          x: pos.x,
          y: pos.y - 0.1,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.2,
          life: 0.3 + Math.random() * 0.25,
          size0: 0.1,
          size1: 0.02,
          r: 255,
          g: 217,
          b: 102,
          a0: 0.9,
        }));
      } catch (e) {
        console.debug('[floatTextWiring] trait gained fx failed:', e);
      }
    }
  });

  // Corpse buff gained float text
  world.on('corpse:buff-gained', ({ actor, effect }) => {
    const pos = getPosition(Number(actor || 0));
    if (!pos || !canShowAt(pos.x, pos.y)) return;
    const label = String(effect || 'BUFF').toUpperCase().replace(/_/g, ' ');
    try {
      ftext.addStatus(pos.x, pos.y - 0.4, label, {
        color: '#7bed9f',
        life: 1.2,
        scaleStart: 1.2,
        scaleEnd: 0.9,
      });
    } catch (e) { console.debug('[floatTextWiring] corpse buff ftext failed:', e); }
  });

  // Corpse debuff gained float text
  world.on('corpse:debuff-gained', ({ actor, effect }) => {
    const pos = getPosition(Number(actor || 0));
    if (!pos || !canShowAt(pos.x, pos.y)) return;
    const label = String(effect || 'DEBUFF').toUpperCase().replace(/_/g, ' ');
    try {
      ftext.addStatus(pos.x, pos.y - 0.4, label, {
        color: '#ff6b6b',
        life: 1.2,
        scaleStart: 1.2,
        scaleEnd: 0.9,
      });
    } catch (e) { console.debug('[floatTextWiring] corpse debuff ftext failed:', e); }
  });

  // Corpse progression float text
  world.on('corpse:progression', ({ actor, name, count, threshold }) => {
    const pos = getPosition(Number(actor || 0));
    if (!pos || !canShowAt(pos.x, pos.y)) return;
    try {
      ftext.addStatus(pos.x, pos.y - 0.4, `${count}/${threshold}`, {
        color: '#dfe6e9',
        life: 1.0,
        scaleStart: 1.0,
        scaleEnd: 0.8,
      });
    } catch (e) { console.debug('[floatTextWiring] corpse progression ftext failed:', e); }
  });

  // Monster corpse eating
  world.on('monster:corpse-eat', ({ monsterId, behavior, at }) => {
    if (!canShowAt(at?.x, at?.y)) return;
    const label = behavior === 'devour' ? 'DEVOUR!' : 'SCAVENGE';
    const color = behavior === 'devour' ? '#9370db' : '#8fbc8f';
    try {
      ftext.addStatus(at.x, at.y - 0.3, label, {
        color,
        life: behavior === 'devour' ? 1.2 : 0.8,
        scaleStart: behavior === 'devour' ? 1.4 : 1.0,
        scaleEnd: 0.9,
      });
    } catch (e) { console.debug('[floatTextWiring] monster corpse-eat ftext failed:', e); }
  });

  // Storm lightning strike
  world.on('weather:lightning', ({ x, y, hitCount }) => {
    if (!canShowAt(x, y)) return;
    try {
      ftext.addStatus(x, y - 0.45, (hitCount | 0) > 0 ? 'ZAP!' : 'CRACK!', {
        color: '#88ccff',
        life: 1.0,
        scaleStart: 1.6,
        scaleEnd: 0.9,
      });
    } catch (e) { console.debug('[floatTextWiring] lightning ftext failed:', e); }
  });

  // Town bell alarm
  world.on('bell:rung', ({ targetId }) => {
    const pos = getPosition(Number(targetId || 0));
    if (pos && canShowAt(pos.x, pos.y)) {
      try { ftext.addStatus(pos.x, pos.y - 0.3, 'ALARM!', { color: '#d4a017', life: 1.2 }); } catch (e) { console.debug('[floatTextWiring] bell ftext failed:', e); }
    }
  });

  // Flying: takeoff / land float text
  world.on('proc:fly:takeoff', ({ x, y }) => {
    if (!canShowAt(x, y)) return;
    try {
      ftext.addStatus(x, y - 0.45, 'TAKES FLIGHT!', {
        color: '#7bc8ff',
        life: 1.0,
        scaleStart: 1.2,
        scaleEnd: 0.9,
      });
    } catch (e) { console.debug('[floatTextWiring] fly takeoff ftext failed:', e); }
  });
  world.on('proc:fly:land', ({ x, y }) => {
    if (!canShowAt(x, y)) return;
    try {
      ftext.addStatus(x, y - 0.3, 'LANDS', {
        color: '#b08050',
        life: 0.7,
      });
    } catch (e) { console.debug('[floatTextWiring] fly land ftext failed:', e); }
  });

  world.on('trap:avoided', ({ victimId }) => {
    const pos = getPosition(Number(victimId || 0));
    if (!pos || !canShowAt(pos.x, pos.y)) return;
    try {
      ftext.addStatus(pos.x, pos.y - 0.4, 'DODGED!', {
        color: '#40e0d0',
        life: 0.9,
      });
    } catch (e) { console.debug('[floatTextWiring] trap avoided ftext failed:', e); }
  });
}
