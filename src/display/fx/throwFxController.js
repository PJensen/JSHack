// src/display/fx/throwFxController.js
// Thrown-item arc animation, hiding, and input lock.

import { drawKind } from "../passes/glyphs/atlas.js";
import { setInputLock } from "../input/inputLock.js";

const THROW_FX_SPEED_TILES_PER_SEC = 26;
const THROW_FX_MIN_DURATION = 0.09;
const THROW_FX_MAX_DURATION = 0.32;
const THROW_FX_ARC_HEIGHT = 0.38;

/**
 * @param {{ world: import('../../lib/ecs-js/index.js').World, resolveItemMeta: (itemId:number) => {identity:string, isPotion:boolean} }} deps
 */
export function createThrowFxController({ world, resolveItemMeta }) {
  /** @type {Array<{ itemId:number, from:{x:number,y:number}, to:{x:number,y:number}, t:number, duration:number, kind:string, isPotion:boolean }>} */
  const _fx = [];
  const _hidden = new Set();

  function isBlocking() { return _fx.length > 0; }

  function isItemHidden(id) { return _hidden.has(id); }

  function syncInputLock() {
    try { setInputLock('throwFx', isBlocking()); } catch (e) { console.debug('[throwFx] input lock sync failed:', e); }
  }

  function computeThrowRange(weight) {
    const w = Number.isFinite(weight) && weight > 0 ? weight : 1;
    const range = Math.round(6 - Math.log2(w + 1));
    return Math.max(1, Math.min(8, range | 0));
  }

  function _duration(distance) {
    const d = Number.isFinite(distance) ? Math.max(0, Number(distance)) : 0;
    if (d <= 0) return THROW_FX_MIN_DURATION;
    const raw = d / THROW_FX_SPEED_TILES_PER_SEC;
    return Math.max(THROW_FX_MIN_DURATION, Math.min(THROW_FX_MAX_DURATION, raw));
  }

  function _remapArc(t01) {
    const t = Math.max(0, Math.min(1, Number(t01) || 0));
    const k = 0.74;
    return t + (k / (2 * Math.PI)) * Math.sin(2 * Math.PI * t);
  }

  function resolveThrownKind(itemId, fallback = "") {
    const meta = resolveItemMeta ? resolveItemMeta(itemId) : null;
    const identity = String(meta?.identity || "");
    if (identity) return identity;
    if (meta?.isPotion) return "potion";
    return fallback || "default";
  }

  function isThrownPotion(itemId) {
    return !!(resolveItemMeta ? resolveItemMeta(itemId)?.isPotion : false);
  }

  function drawPotionThrowGlow(ctx, kind, x, y, pulse) {
    const look = (kind && typeof kind === "string" ? null : null);
    void look;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 0.92px monospace';
    ctx.shadowColor = '#6bc7ff';
    ctx.shadowBlur = 8 + 4 * pulse;
    ctx.fillStyle = 'rgba(107,199,255,0.18)';
    ctx.fillText('!', x, y);
    ctx.shadowBlur = 3 + 2 * pulse;
    ctx.fillStyle = 'rgba(180,230,255,0.42)';
    ctx.fillText('!', x, y);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(180,230,255,0.28)';
    ctx.beginPath();
    ctx.arc(x, y + 0.23, 0.10 + 0.02 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function installListeners() {
    world.on('item:thrown', ({ itemId, from, to }) => {
      const id = Number(itemId || 0) | 0;
      if (!(id > 0)) return;
      if (!from || !to) return;
      const fx0 = Number(from.x);
      const fy0 = Number(from.y);
      const fx1 = Number(to.x);
      const fy1 = Number(to.y);
      if (!Number.isFinite(fx0) || !Number.isFinite(fy0) || !Number.isFinite(fx1) || !Number.isFinite(fy1)) return;
      const dx = fx1 - fx0;
      const dy = fy1 - fy0;
      const dist = Math.hypot(dx, dy);
      if (!(dist > 0)) return;

      for (let i = _fx.length - 1; i >= 0; i--) {
        if ((_fx[i].itemId | 0) !== id) continue;
        _fx.splice(i, 1);
      }

      _hidden.add(id);
      _fx.push({
        itemId: id,
        from: { x: fx0, y: fy0 },
        to: { x: fx1, y: fy1 },
        t: 0,
        duration: _duration(dist),
        kind: resolveThrownKind(id, ""),
        isPotion: isThrownPotion(id),
      });
      syncInputLock();
    });
  }

  function tick(dt) {
    let changed = false;
    for (let i = _fx.length - 1; i >= 0; i--) {
      const rec = _fx[i];
      rec.t += dt;
      const done = rec.t >= rec.duration;
      const gone = !world.isAlive(rec.itemId);
      if (!done && !gone) continue;
      _hidden.delete(rec.itemId);
      _fx.splice(i, 1);
      changed = true;
    }
    if (changed) syncInputLock();
  }

  function draw(ctx, worldView, glyphAtlas) {
    if (!_fx.length) return;

    const kindById = new Map();
    for (let i = 0; i < worldView.entities.length; i++) {
      const e = worldView.entities[i];
      if (!_hidden.has(e.id)) continue;
      kindById.set(e.id, typeof e.kind === "string" ? e.kind : "default");
    }

    for (let i = 0; i < _fx.length; i++) {
      const rec = _fx[i];
      if (!rec.kind) rec.kind = resolveThrownKind(rec.itemId, kindById.get(rec.itemId) || "default");
      const t01 = Math.max(0, Math.min(1, rec.t / Math.max(0.0001, rec.duration)));
      const u = _remapArc(t01);
      const x = rec.from.x + (rec.to.x - rec.from.x) * u;
      const yGround = rec.from.y + (rec.to.y - rec.from.y) * u;
      const h = Math.sin(Math.PI * u);
      const y = yGround - h * THROW_FX_ARC_HEIGHT;
      const kind = glyphAtlas.has(rec.kind) ? rec.kind : (rec.isPotion ? "potion" : "default");

      // Ground shadow to sell "item is airborne".
      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${(0.20 - h * 0.08).toFixed(3)})`;
      if (typeof ctx.ellipse === "function") {
        ctx.beginPath();
        ctx.ellipse(x, yGround + 0.08, 0.22 + h * 0.08, 0.12 + h * 0.03, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x, yGround + 0.08, 0.16 + h * 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      drawKind(glyphAtlas, ctx, kind, x, y);
      if (rec.isPotion) {
        drawPotionThrowGlow(ctx, kind, x, y, h);
      }
    }
  }

  syncInputLock();

  return {
    isBlocking,
    isItemHidden,
    syncInputLock,
    computeThrowRange,
    tick,
    draw,
    installListeners,
  };
}
