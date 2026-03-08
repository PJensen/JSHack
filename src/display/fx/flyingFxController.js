const LISTENERS_INSTALLED = Symbol.for('jshack:display:flyingFx:installed');

const TAKEOFF_SECONDS = 0.34;
const LAND_SECONDS = 0.24;
const WAKE_SECONDS = 0.30;
const MAX_LIFT = 0.36;
const HOVER_BOB = 0.028;

/**
 * @param {number} n
 */
function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

/**
 * @param {number} n
 */
function easeOutCubic(n) {
  const t = clamp01(n);
  return 1 - Math.pow(1 - t, 3);
}

/**
 * @param {number} id
 */
function phaseFromId(id) {
  const h = (Math.imul((id | 0) ^ 0x9e3779b9, 1664525) + 1013904223) >>> 0;
  return (h / 0xffffffff) * Math.PI * 2;
}

/**
 * @param {{ id:number, x:number, y:number, progress:number, wake:number, wakeKind:string, fxTime:number, camScale:number, phase:number }} opts
 */
function computePresentation(opts) {
  const progress = clamp01(opts.progress);
  const lifted = easeOutCubic(progress);
  const hoverBob = lifted > 0.001
    ? Math.sin(opts.fxTime * (lifted > 0.96 ? 3.2 : 5.8) + opts.phase) * HOVER_BOB * lifted
    : 0;
  const lift = MAX_LIFT * lifted + hoverBob;
  const scalePulse = lifted > 0.96
    ? (0.5 + 0.5 * Math.sin(opts.fxTime * 2.7 + opts.phase * 0.7))
    : lifted;
  const glyphScale = 1 + lifted * 0.085 + scalePulse * lifted * 0.02;
  const camScale = Math.max(1, Number(opts.camScale) || 1);
  const pxWorld = 1 / camScale;
  const shadowSlideX = (-2.0 * pxWorld * lifted) - (lift * 0.12);
  const shadowSlideY = (-2.0 * pxWorld * lifted) - (lift * 0.08);
  const shadowX = opts.x + shadowSlideX;
  const shadowY = opts.y + 0.24 + shadowSlideY;
  const shadowRx = 0.30 - lifted * 0.04;
  const shadowRy = 0.11 - lifted * 0.015;
  const shadowAlpha = 0.26 - lifted * 0.06;
  return {
    id: opts.id,
    progress,
    lift,
    glyphX: opts.x,
    glyphY: opts.y - lift,
    glyphScale,
    shadowX,
    shadowY,
    shadowRx,
    shadowRy,
    shadowAlpha: Math.max(0.08, shadowAlpha),
    wake: clamp01(opts.wake),
    wakeKind: opts.wakeKind || '',
  };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ progress:number, shadowX:number, shadowY:number, shadowRx:number, shadowRy:number, shadowAlpha:number, wake:number, wakeKind:string }} presentation
 */
export function drawFlyingShadow(ctx, presentation) {
  if (!presentation || presentation.progress <= 0.001) return;

  const { shadowX, shadowY, shadowRx, shadowRy, shadowAlpha, wake, wakeKind, progress } = presentation;

  ctx.save();

  ctx.fillStyle = `rgba(0,0,0,${(shadowAlpha * 0.45).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(shadowX, shadowY, shadowRx * 1.55, shadowRy * 1.9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(6,8,14,${shadowAlpha.toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(shadowX, shadowY, shadowRx, shadowRy, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(0,0,0,${Math.max(0.08, shadowAlpha * 0.42).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(shadowX, shadowY, shadowRx * 0.72, shadowRy * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();

  if (wake > 0.001) {
    const u = 1 - wake;
    const ringRx = shadowRx + 0.08 + u * 0.24;
    const ringRy = shadowRy + 0.04 + u * 0.10;
    const ringAlpha = wake * (wakeKind === 'land' ? 0.24 : 0.20) * progress;
    ctx.lineWidth = 0.028 + wake * 0.014;
    ctx.strokeStyle = wakeKind === 'land'
      ? `rgba(255,188,120,${ringAlpha.toFixed(3)})`
      : `rgba(120,205,255,${ringAlpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowY, ringRx, ringRy, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * @param {{ world: import('../../lib/ecs-js/index.js').World }} deps
 */
export function createFlyingFxController({ world }) {
  /** @type {Map<number, { progress:number, targetAirborne:boolean, wake:number, wakeKind:string, phase:number }>} */
  const states = new Map();

  /**
   * @param {number} id
   * @param {{ progress?:number, targetAirborne?:boolean, wake?:number, wakeKind?:string }} [seed]
   */
  function ensureState(id, seed = {}) {
    let rec = states.get(id);
    if (!rec) {
      rec = {
        progress: clamp01(seed.progress ?? 0),
        targetAirborne: !!seed.targetAirborne,
        wake: clamp01(seed.wake ?? 0),
        wakeKind: seed.wakeKind || '',
        phase: phaseFromId(id),
      };
      states.set(id, rec);
    }
    return rec;
  }

  function installListeners() {
    if (world[LISTENERS_INSTALLED]) return;
    world[LISTENERS_INSTALLED] = true;

    world.on('proc:fly:takeoff', ({ id }) => {
      const entityId = Number(id || 0);
      if (!entityId) return;
      const rec = ensureState(entityId, { progress: 0, targetAirborne: true });
      rec.targetAirborne = true;
      rec.progress = Math.max(rec.progress, 0.12);
      rec.wake = 1;
      rec.wakeKind = 'takeoff';
    });

    world.on('proc:fly:land', ({ id }) => {
      const entityId = Number(id || 0);
      if (!entityId) return;
      const rec = ensureState(entityId, { progress: 1, targetAirborne: false });
      rec.targetAirborne = false;
      rec.progress = Math.max(rec.progress, 0.18);
      rec.wake = 1;
      rec.wakeKind = 'land';
    });
  }

  /**
   * Keeps presentation state aligned with the latest view without hard-depending on
   * rules events for entities that enter view already airborne.
   * @param {{ entities?: Array<{ id:number, tags?:string[] }> }} worldView
   */
  function syncWorldView(worldView) {
    const entities = Array.isArray(worldView?.entities) ? worldView.entities : [];
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      const flying = Array.isArray(e.tags) && e.tags.includes('flying');
      const rec = states.get(e.id);
      if (!flying) {
        if (rec) rec.targetAirborne = false;
        continue;
      }
      if (!rec) {
        states.set(e.id, {
          progress: 1,
          targetAirborne: true,
          wake: 0,
          wakeKind: '',
          phase: phaseFromId(e.id),
        });
        continue;
      }
      rec.targetAirborne = true;
      if (rec.progress <= 0.001) rec.progress = 1;
    }
  }

  /**
   * @param {number} dt
   */
  function tick(dt) {
    for (const [id, rec] of states) {
      if (rec.targetAirborne) {
        rec.progress = Math.min(1, rec.progress + (dt / TAKEOFF_SECONDS));
      } else {
        rec.progress = Math.max(0, rec.progress - (dt / LAND_SECONDS));
      }
      rec.wake = Math.max(0, rec.wake - (dt / WAKE_SECONDS));
      if (!rec.targetAirborne && rec.progress <= 0.001) {
        states.delete(id);
        continue;
      }
      if (rec.targetAirborne && typeof world.isAlive === 'function' && !world.isAlive(id) && rec.progress >= 0.999) {
        states.delete(id);
      }
    }
  }

  /**
   * @param {{ id:number, pos:{x:number,y:number}, tags?:string[] }} entity
   * @param {number} fxTime
   * @param {number} camScale
   */
  function getPresentation(entity, fxTime, camScale) {
    const flyingTag = Array.isArray(entity?.tags) && entity.tags.includes('flying');
    const rec = states.get(entity.id);
    if (!rec && !flyingTag) {
      return computePresentation({
        id: entity.id,
        x: entity.pos.x,
        y: entity.pos.y,
        progress: 0,
        wake: 0,
        wakeKind: '',
        fxTime,
        camScale,
        phase: phaseFromId(entity.id),
      });
    }
    if (!rec && flyingTag) {
      return computePresentation({
        id: entity.id,
        x: entity.pos.x,
        y: entity.pos.y,
        progress: 1,
        wake: 0,
        wakeKind: '',
        fxTime,
        camScale,
        phase: phaseFromId(entity.id),
      });
    }
    return computePresentation({
      id: entity.id,
      x: entity.pos.x,
      y: entity.pos.y,
      progress: rec?.progress ?? 0,
      wake: rec?.wake ?? 0,
      wakeKind: rec?.wakeKind || '',
      fxTime,
      camScale,
      phase: rec?.phase ?? phaseFromId(entity.id),
    });
  }

  return {
    installListeners,
    syncWorldView,
    tick,
    getPresentation,
  };
}
