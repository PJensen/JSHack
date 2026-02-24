// src/main/fx/boltFxController.js
// Spell bolt and deity wrath lightning FX.

import { Position } from "../../rules/components/Position.js";
import { startShake } from "../../display/camera/shake.js";
import { clamp01, rgba, pathPolyline, jitterLine } from "./fxGeom.js";
import { Particle } from "../../display/passes/vfx/particles/particlePool.js";
import { LineFx, PulseFx, DeityBoltFx, ScreenFlashFx, ScreenBoltFx } from "./fxEntries.js";

const DEITY_WRATH_VFX = Object.freeze({
  default: Object.freeze({
    behavior: 'lightning_bolt',
    outer: Object.freeze([95, 165, 255]),
    mid: Object.freeze([170, 220, 255]),
    core: Object.freeze([235, 250, 255]),
    pulse: Object.freeze([210, 245, 255]),
    spark: Object.freeze([130, 210, 255]),
    baseShake: 5,
  }),
  molkhar: Object.freeze({
    behavior: 'lightning_bolt',
    outer: Object.freeze([255, 85, 40]),
    mid: Object.freeze([255, 170, 95]),
    core: Object.freeze([255, 240, 220]),
    pulse: Object.freeze([255, 205, 150]),
    spark: Object.freeze([255, 155, 90]),
    baseShake: 6,
  }),
  seraphine: Object.freeze({
    behavior: 'lightning_bolt',
    outer: Object.freeze([110, 180, 255]),
    mid: Object.freeze([185, 225, 255]),
    core: Object.freeze([245, 255, 255]),
    pulse: Object.freeze([225, 250, 255]),
    spark: Object.freeze([165, 220, 255]),
    baseShake: 5,
  }),
  loki: Object.freeze({
    behavior: 'lightning_bolt',
    outer: Object.freeze([145, 105, 255]),
    mid: Object.freeze([205, 165, 255]),
    core: Object.freeze([250, 240, 255]),
    pulse: Object.freeze([230, 205, 255]),
    spark: Object.freeze([195, 145, 255]),
    baseShake: 6,
  }),
  gaia: Object.freeze({
    behavior: 'lightning_bolt',
    outer: Object.freeze([95, 185, 140]),
    mid: Object.freeze([165, 225, 185]),
    core: Object.freeze([240, 255, 245]),
    pulse: Object.freeze([205, 245, 220]),
    spark: Object.freeze([140, 210, 165]),
    baseShake: 5,
  }),
});

function getWrathVfxProfile(deityId) {
  const key = String(deityId || '').toLowerCase();
  return DEITY_WRATH_VFX[key] || DEITY_WRATH_VFX.default;
}

/**
 * @param {{ world: import('../../lib/ecs-js/index.js').World, cam: object, fx: { pool?: { spawn(p:object):void } } }} deps
 */
export function createBoltFxController({ world, cam, fx }) {
  /** @type {LineFx[]} */
  const _boltFx = [];
  /** @type {PulseFx[]} */
  const _lightPulses = [];
  /** @type {DeityBoltFx[]} */
  const _deityBolts = [];
  /** @type {PulseFx[]} */
  const _deityPulses = [];
  /** @type {ScreenFlashFx[]} */
  const _screenFlash = [];
  /** @type {ScreenBoltFx[]} */
  const _screenBolts = [];

  function _spawnDeityWrath(payload) {
    const playerId = Number(payload?.playerId || 0) | 0;
    if (!(playerId > 0)) return;
    const pos = world.get(playerId, Position);
    if (!pos) return;

    const x = Number(pos.x);
    const yTarget = Number(pos.y);
    if (!Number.isFinite(x) || !Number.isFinite(yTarget)) return;

    const profile = getWrathVfxProfile(payload?.deityId || '');
    if (profile.behavior !== 'lightning_bolt') return;

    const intensity = clamp01(Number(payload?.intensity || 0));
    const severityScale = Math.max(1, Number(payload?.severityScale || 1));
    const wrathDebt = Math.max(0, Number(payload?.wrathDebt || 0));

    const ttlMain = 0.28
      + Math.min(0.14, intensity * 0.10)
      + Math.min(0.14, (severityScale - 1) * 0.08);
    const mainAmp = 0.08 + Math.min(0.18, (severityScale - 1) * 0.08 + wrathDebt * 0.03);

    _deityBolts.push(new DeityBoltFx({
      from: { x, y: 0 },
      to: { x, y: yTarget },
      ttl: ttlMain, amp: mainAmp, branch: false,
      outer: profile.outer, mid: profile.mid, core: profile.core,
    }));
    _deityPulses.push(new PulseFx({ x, y: yTarget, ttl: 0.32, color: profile.pulse }));
    _screenBolts.push(new ScreenBoltFx({
      x, y: yTarget,
      ttl: ttlMain + 0.12,
      amp: 6 + Math.min(10, (severityScale - 1) * 5 + wrathDebt * 2.5),
      color: profile.core,
    }));

    const branchCount = Math.max(2, 2 + Math.floor((severityScale - 1) * 3 + Math.min(3, wrathDebt * 2)));
    for (let i = 0; i < branchCount; i++) {
      const tStart = 0.12 + Math.random() * 0.68;
      const yStart = yTarget * tStart;
      const xStart = x + (Math.random() - 0.5) * 0.26;
      const yEnd = Math.min(yTarget + 1.6, yStart + 0.9 + Math.random() * (2.4 + severityScale));
      const xEnd = xStart + (Math.random() - 0.5) * (0.8 + severityScale * 0.35);
      const ttl = ttlMain * (0.65 + Math.random() * 0.25);
      _deityBolts.push(new DeityBoltFx({
        from: { x: xStart, y: yStart }, to: { x: xEnd, y: yEnd },
        ttl, amp: mainAmp * 0.75, branch: true,
        outer: profile.outer, mid: profile.mid, core: profile.core,
      }));
      _deityPulses.push(new PulseFx({
        x: xEnd, y: yEnd,
        ttl: 0.16 + Math.random() * 0.12, max: 0.26,
        color: profile.pulse,
      }));
    }

    if (fx?.pool) {
      const lineLength = Math.max(1, Math.abs(yTarget));
      const sparkCount = Math.max(14, Math.round(lineLength * (0.7 + Math.min(2.2, severityScale))));
      for (let i = 0; i < sparkCount; i++) {
        const t = Math.random();
        fx.pool.spawn(new Particle({
          x: x + (Math.random() - 0.5) * 0.34,
          y: yTarget * t + (Math.random() - 0.5) * 0.08,
          vx: (Math.random() - 0.5) * 0.35,
          vy: 0.8 + Math.random() * (2.1 + severityScale),
          ay: 0.9,
          life: 0.14 + Math.random() * 0.26,
          size0: 0.06 + Math.random() * 0.05, size1: 0.01,
          r: profile.spark[0], g: profile.spark[1], b: profile.spark[2],
          a0: 0.82,
          rotVel: (Math.random() - 0.5) * 2.4,
        }));
      }
    }

    const shakePower = Math.min(
      12,
      Math.round(profile.baseShake + intensity * 3 + (severityScale - 1) * 4 + Math.min(2.5, wrathDebt * 1.5))
    );
    const shakeDur = 0.14 + Math.min(0.18, intensity * 0.07 + (severityScale - 1) * 0.05);
    startShake(cam, shakePower, shakeDur);

    const flashDuration = 0.12 + Math.min(0.12, intensity * 0.06 + (severityScale - 1) * 0.04);
    _screenFlash.push(new ScreenFlashFx({ ttl: flashDuration, color: profile.pulse }));
  }

  function installListeners() {
    world.on('spell:bolt', ({ actor, targetId, spellId, from, to, chainIndex = 0 }) => {
      if (from && to) {
        _boltFx.push(new LineFx({ from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, ttl: 0.14, chainIndex: Number(chainIndex || 0) }));
        _lightPulses.push(new PulseFx({ x: to.x, y: to.y, ttl: 0.12 }));
        startShake(cam, 4, 0.18);
      }
    });
    world.on('deity:wrath', ({ playerId, deityId, intensity, severityScale, wrathDebt }) => {
      _spawnDeityWrath({
        playerId: Number(playerId || 0),
        deityId: String(deityId || ''),
        intensity: Number(intensity || 0),
        severityScale: Number(severityScale || 1),
        wrathDebt: Number(wrathDebt || 0),
      });
    });
  }

  function tick(dt) {
    // Spell bolts
    if (_boltFx.length) {
      for (const eff of _boltFx) eff.tick(dt);
      for (let i = _boltFx.length - 1; i >= 0; i--) {
        if (_boltFx[i].expired) _boltFx.splice(i, 1);
      }
    }
    if (_lightPulses.length) {
      for (const f of _lightPulses) f.tick(dt);
      for (let i = _lightPulses.length - 1; i >= 0; i--) {
        if (_lightPulses[i].expired) _lightPulses.splice(i, 1);
      }
    }
    // Deity wrath
    if (_deityBolts.length) {
      for (let i = _deityBolts.length - 1; i >= 0; i--) {
        _deityBolts[i].tick(dt);
        if (_deityBolts[i].expired) _deityBolts.splice(i, 1);
      }
    }
    if (_deityPulses.length) {
      for (let i = _deityPulses.length - 1; i >= 0; i--) {
        _deityPulses[i].tick(dt);
        if (_deityPulses[i].expired) _deityPulses.splice(i, 1);
      }
    }
    if (_screenFlash.length) {
      for (let i = _screenFlash.length - 1; i >= 0; i--) {
        _screenFlash[i].tick(dt);
        if (_screenFlash[i].expired) _screenFlash.splice(i, 1);
      }
    }
    if (_screenBolts.length) {
      for (let i = _screenBolts.length - 1; i >= 0; i--) {
        _screenBolts[i].tick(dt);
        if (_screenBolts[i].expired) _screenBolts.splice(i, 1);
      }
    }
  }

  function drawBolts(ctx) {
    if (!_boltFx.length && !_lightPulses.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of _lightPulses) {
      const a = p.alpha;
      ctx.fillStyle = `rgba(180,240,255,${0.18 * a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,255,220,${0.10 * a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 0.35, 0, Math.PI * 2); ctx.fill();
    }
    for (const eff of _boltFx) {
      const alpha = eff.alpha;
      const pts = jitterLine(eff.from, eff.to, 11, 0.10 * alpha);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(120,200,255,${0.18 * alpha})`;
      ctx.lineWidth = 0.22;
      pathPolyline(ctx, pts); ctx.stroke();
      ctx.strokeStyle = `rgba(160,220,255,${0.35 * alpha})`;
      ctx.lineWidth = 0.10;
      pathPolyline(ctx, pts); ctx.stroke();
      const core = jitterLine(eff.from, eff.to, 13, 0.05 * alpha);
      ctx.strokeStyle = `rgba(230,255,255,${0.9 * alpha})`;
      ctx.lineWidth = 0.045;
      pathPolyline(ctx, core); ctx.stroke();
    }
    ctx.restore();
  }

  function drawDeityWrath(ctx) {
    if (!_deityBolts.length && !_deityPulses.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (let i = 0; i < _deityPulses.length; i++) {
      const pulse = _deityPulses[i];
      const a = pulse.alpha;
      const outerR = 0.24 + pulse.progress * 0.7;
      const innerR = 0.08 + pulse.progress * 0.26;
      ctx.fillStyle = rgba(pulse.color, 0.16 * a);
      ctx.beginPath(); ctx.arc(pulse.x, pulse.y, outerR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,255,245,${(0.12 * a).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(pulse.x, pulse.y, innerR, 0, Math.PI * 2); ctx.fill();
    }

    for (let i = 0; i < _deityBolts.length; i++) {
      const seg = _deityBolts[i];
      const alpha = seg.alpha;
      const len = Math.max(1, Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y));
      const points = Math.max(8, Math.min(24, Math.floor(len * (seg.branch ? 1.3 : 1.6))));
      const pts = jitterLine(seg.from, seg.to, points, seg.amp * alpha);
      const widthScale = seg.branch ? 0.72 : 1.0;
      ctx.strokeStyle = rgba(seg.outer, 0.22 * alpha);
      ctx.lineWidth = 0.24 * widthScale;
      pathPolyline(ctx, pts); ctx.stroke();
      ctx.strokeStyle = rgba(seg.mid, 0.42 * alpha);
      ctx.lineWidth = 0.11 * widthScale;
      pathPolyline(ctx, pts); ctx.stroke();
      const core = jitterLine(seg.from, seg.to, points + 2, seg.amp * 0.45 * alpha);
      ctx.strokeStyle = rgba(seg.core, 0.95 * alpha);
      ctx.lineWidth = 0.05 * widthScale;
      pathPolyline(ctx, core); ctx.stroke();
    }

    ctx.restore();
  }

  function drawScreenFlash(ctx, width, height) {
    let strongest = null;
    for (let i = 0; i < _screenFlash.length; i++) {
      const flash = _screenFlash[i];
      if (!strongest || flash.ttl > strongest.ttl) strongest = flash;
    }
    if (!strongest) return;
    const a = strongest.alpha;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(strongest.color, 0.18 * a);
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = `rgba(255,255,255,${(0.05 * a).toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  function drawScreenBolts(ctx, width, height) {
    if (!_screenBolts.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const halfW = width * 0.5;
    const halfH = height * 0.5;
    const scale = Number(cam.scale || 1);

    for (let i = 0; i < _screenBolts.length; i++) {
      const bolt = _screenBolts[i];
      const alpha = bolt.alpha;
      const sx = (bolt.x - cam.x) * scale + halfW;
      const sy = (bolt.y - cam.y) * scale + halfH;
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue;
      if (sx < -80 || sx > width + 80 || sy < -120) continue;
      const endY = Math.max(0, Math.min(height + 120, sy));
      const start = { x: sx, y: 0 };
      const end = { x: sx + (Math.random() - 0.5) * 8, y: endY };
      const segments = Math.max(10, Math.min(26, Math.floor((endY / 34) + 10)));
      const pts = jitterLine(start, end, segments, bolt.amp * alpha);
      ctx.strokeStyle = rgba(bolt.color, 0.25 * alpha);
      ctx.lineWidth = 7.5;
      pathPolyline(ctx, pts); ctx.stroke();
      ctx.strokeStyle = rgba(bolt.color, 0.78 * alpha);
      ctx.lineWidth = 3.2;
      pathPolyline(ctx, pts); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${(0.95 * alpha).toFixed(3)})`;
      ctx.lineWidth = 1.4;
      pathPolyline(ctx, jitterLine(start, end, segments + 2, (bolt.amp * 0.42) * alpha)); ctx.stroke();
    }
    ctx.restore();
  }

  function hasScreenEffects() {
    return _screenFlash.length > 0 || _screenBolts.length > 0;
  }

  return {
    tick,
    drawBolts,
    drawDeityWrath,
    drawScreenFlash,
    drawScreenBolts,
    hasScreenEffects,
    installListeners,
  };
}
