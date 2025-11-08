import { playerEntity } from "../../rules/utils/queries.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { Equipment } from "../../rules/components/Equipment.js";
import { Position } from "../../rules/components/Position.js";
import { Settings } from "../../rules/components/Settings.js";
import { Anatomy } from "../../rules/components/Anatomy.js";
import { BoundingCircle } from "../../rules/components/BoundingCircle.js";
import { getSpell } from "../../rules/data/spells.js";

function bracketizeName(str) {
  const s = String(str ?? "");
  if (s.startsWith("[") && s.endsWith("]")) return s;
  return `[${s}]`;
}

function createBoltFxManager(startShake, cam, theme = 'bolt') {
  /** @type {Array<{from:{x:number,y:number}, to:{x:number,y:number}, ttl:number, max:number, chainIndex:number}>} */
  const bolts = [];
  /** @type {Array<{x:number,y:number, ttl:number, max:number}>} */
  const lightPulses = [];

  function addBolt({ from, to, chainIndex = 0 }) {
    if (from && to) {
      bolts.push({
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y },
        ttl: 0.20,
        max: 0.20,
        chainIndex: Number(chainIndex || 0)
      });
      lightPulses.push({ x: to.x, y: to.y, ttl: 0.18, max: 0.18 });
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.hypot(dx, dy);
      const steps = Math.min(12, Math.max(2, Math.round(dist * 2.2)));
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const px = from.x + dx * t;
        const py = from.y + dy * t;
        const ttl = 0.10 + (0.06 * (1 - Math.abs(0.5 - t) * 1.6));
        lightPulses.push({ x: px, y: py, ttl, max: ttl });
      }
      startShake(cam, 5, 0.20);
    }
  }

  function update(dt) {
    if (bolts.length) {
      for (const eff of bolts) eff.ttl -= dt;
      for (let i = bolts.length - 1; i >= 0; i--) {
        if (bolts[i]?.ttl <= 0) bolts.splice(i, 1);
      }
    }
    if (lightPulses.length) {
      for (const pulse of lightPulses) pulse.ttl -= dt;
      for (let i = lightPulses.length - 1; i >= 0; i--) {
        if (lightPulses[i]?.ttl <= 0) lightPulses.splice(i, 1);
      }
    }
  }

  /** @param {CanvasRenderingContext2D} ctx */
  function draw(ctx) {
    if ((!bolts.length) && (!lightPulses.length)) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const pulse of lightPulses) {
      const a = Math.max(0, Math.min(1, pulse.ttl / (pulse.max || 0.18)));
      const colOuter = (theme === 'flame') ? `rgba(255,170,80,${0.22 * a})` : `rgba(180,240,255,${0.22 * a})`;
      const colInner = (theme === 'flame') ? `rgba(255,230,150,${0.12 * a})` : `rgba(255,255,220,${0.12 * a})`;
      ctx.fillStyle = colOuter;
      ctx.beginPath(); ctx.arc(pulse.x, pulse.y, 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = colInner;
      ctx.beginPath(); ctx.arc(pulse.x, pulse.y, 0.4, 0, Math.PI * 2); ctx.fill();
    }
    for (const bolt of bolts) {
      const alpha = Math.max(0, Math.min(1, bolt.ttl / bolt.max));
      const pts = jitterLine(bolt.from, bolt.to, 13, (theme === 'flame' ? 0.02 : 0.12) * alpha);
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      // Outer glow
      ctx.strokeStyle = (theme === 'flame') ? `rgba(255,160,60,${0.25 * alpha})` : `rgba(100,180,255,${0.20 * alpha})`;
      ctx.lineWidth = 0.28;
      pathPolyline(ctx, pts); ctx.stroke();

      // Mid glow
      ctx.strokeStyle = (theme === 'flame') ? `rgba(255,200,120,${0.50 * alpha})` : `rgba(160,220,255,${0.40 * alpha})`;
      ctx.lineWidth = 0.12;
      pathPolyline(ctx, pts); ctx.stroke();

      // Core
      const core = jitterLine(bolt.from, bolt.to, 15, (theme === 'flame' ? 0.01 : 0.06) * alpha);
      ctx.strokeStyle = (theme === 'flame') ? `rgba(255,240,200,${1.0 * alpha})` : `rgba(230,255,255,${1.0 * alpha})`;
      ctx.lineWidth = 0.05;
      pathPolyline(ctx, core); ctx.stroke();

      // Occasional branches
      if (alpha > 0.2 && theme !== 'flame') {
        const dx = bolt.to.x - bolt.from.x;
        const dy = bolt.to.y - bolt.from.y;
        const len = Math.hypot(dx, dy) || 1;
        const tx = dx / len, ty = dy / len;
        const nx = -ty, ny = tx;
        const branches = 1 + (Math.random() < 0.5 ? 1 : 0);
        for (let j = 0; j < branches; j++) {
          const t = 0.25 + Math.random() * 0.5;
          const bx = bolt.from.x + dx * t;
          const by = bolt.from.y + dy * t;
          const out = (0.25 + Math.random() * 0.25) * len * alpha;
          const side = Math.random() < 0.5 ? -1 : 1;
          const ex = bx + tx * (out * 0.6) + nx * (out * 0.4 * side);
          const ey = by + ty * (out * 0.6) + ny * (out * 0.4 * side);
          const bpts = jitterLine({ x: bx, y: by }, { x: ex, y: ey }, 7, 0.10 * alpha);
          ctx.strokeStyle = `rgba(170,230,255,${0.35 * alpha})`;
          ctx.lineWidth = 0.08;
          pathPolyline(ctx, bpts); ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  function getLightSources() {
    const arr = [];
    for (let i = 0; i < lightPulses.length; i++) {
      const p = lightPulses[i];
      const a = Math.max(0, Math.min(1, (p.ttl || 0) / (p.max || 0.18)));
      if (a <= 0) continue;
      arr.push({
        id: `bolt:${i}`,
        x: p.x,
        y: p.y,
        radius: 2.0 * a,
        intensity: 0.65 * a,
        color: (theme === 'flame' ? '#ffb36b' : '#aee9ff'),
        flicker: 0.0,
        style: (theme === 'flame' ? 'flame' : 'bolt'),
        emitter: null,
      });
    }
    return arr;
  }

  return { addBolt, update, draw, getLightSources };
}

// Expanding ring ripple FX (shockwave)
function createRippleFxManager(startShake, cam) {
  /** @type {Array<{x:number,y:number, age:number, life:number, maxR:number, color:string}>} */
  const ripples = [];

  function addRipple({ x, y, radius = 8, life = 0.6, color = '#ffa600' }) {
    ripples.push({ x, y, age: 0, life, maxR: radius, color });
    startShake(cam, 3, Math.min(0.2, life));
  }

  function update(dt) {
    for (const r of ripples) r.age += dt;
    for (let i = ripples.length - 1; i >= 0; i--) if (ripples[i].age >= ripples[i].life) ripples.splice(i, 1);
  }

  /** @param {CanvasRenderingContext2D} ctx */
  function draw(ctx) {
    if (!ripples.length) return;
    ctx.save();
    for (const r of ripples) {
      const t = Math.max(0, Math.min(1, r.age / (r.life || 0.0001)));
      const rad = r.maxR * t;
      const alpha = (1 - t) * 0.7;
      const steps = Math.max(24, Math.min(96, Math.round(rad * 16)));
      ctx.globalAlpha = alpha * 0.55;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 0.04;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const x = r.x + Math.cos(a) * rad;
        const y = r.y + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // subtle dots along ring
      const dots = Math.max(8, Math.min(48, Math.round(rad * 2)));
      ctx.globalAlpha = alpha * 0.35;
      ctx.fillStyle = r.color;
      for (let i = 0; i < dots; i++) {
        const a = (i / dots) * Math.PI * 2;
        const x = r.x + Math.cos(a) * rad;
        const y = r.y + Math.sin(a) * rad;
        ctx.beginPath(); ctx.arc(x, y, 0.05 + 0.03 * (1 - t), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  return { addRipple, update, draw };
}
// New: fast moving arrow/crossbow bolt VFX manager (separate from lightning)
function createArrowFxManager(startShake, cam) {
  /** @type {Array<{from:{x:number,y:number}, to:{x:number,y:number}, t:number, duration:number, style:string}>} */
  const arrows = [];
  /** @type {Array<{x:number,y:number, ttl:number, max:number, style:string}>} */
  const sparks = [];

  function addArrow({ from, to, style = 'plain' }) {
    if (!from || !to) return;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const speed = 22; // tiles per second
    const duration = Math.max(0.08, Math.min(0.35, dist / speed));
    arrows.push({ from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, t: 0, duration, style });
    startShake(cam, style === 'meteor' ? 4 : 2, style === 'meteor' ? 0.12 : 0.08);
  }

  function addSpark(x, y, style = 'plain') {
    sparks.push({ x, y, ttl: 0.14, max: 0.14, style });
  }

  function update(dt) {
    if (arrows.length) {
      for (const a of arrows) a.t += dt;
      for (let i = arrows.length - 1; i >= 0; i--) {
        if (arrows[i].t >= arrows[i].duration + 0.02) arrows.splice(i, 1);
      }
    }
    if (sparks.length) {
      for (const s of sparks) s.ttl -= dt;
      for (let i = sparks.length - 1; i >= 0; i--) {
        if (sparks[i].ttl <= 0) sparks.splice(i, 1);
      }
    }
  }

  /** @param {CanvasRenderingContext2D} ctx */
  function draw(ctx) {
    if (!arrows.length && !sparks.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const a of arrows) {
      const u = Math.max(0, Math.min(1, a.t / Math.max(1e-6, a.duration)));
      const dx = a.to.x - a.from.x;
      const dy = a.to.y - a.from.y;
      const hx = a.from.x + dx * u;
      const hy = a.from.y + dy * u;
      const ang = Math.atan2(dy, dx);
      const trailLen = a.style === 'meteor' ? Math.max(0.25, Math.min(0.9, (1 - u) * 1.25)) : Math.max(0.15, Math.min(0.5, (1 - u) * 0.75));
      const tx = hx - Math.cos(ang) * trailLen;
      const ty = hy - Math.sin(ang) * trailLen;

      // Colors per style
      let core = '#fff7cc', mid = '#ffc96b', outer = '#ff9a3e';
      if (a.style === 'poison') { core = '#e6ffcc'; mid = '#9cff66'; outer = '#57cc2b'; }
      if (a.style === 'magic') { core = '#e9e1ff'; mid = '#b69cff'; outer = '#7e5cff'; }
      if (a.style === 'meteor') { core = '#fff3c0'; mid = '#ffba5c'; outer = '#ff7f2a'; }

      const alpha = 1.0;
      // Trail (outer -> mid -> core)
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const wOuter = a.style === 'meteor' ? 0.55 : 0.22;
      const wMid = a.style === 'meteor' ? 0.32 : 0.12;
      const wCore = a.style === 'meteor' ? 0.14 : 0.05;
      ctx.strokeStyle = outer; ctx.globalAlpha = 0.28 * alpha; ctx.lineWidth = wOuter; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.strokeStyle = mid;   ctx.globalAlpha = 0.50 * alpha; ctx.lineWidth = wMid;   ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.strokeStyle = core;  ctx.globalAlpha = 1.00 * alpha; ctx.lineWidth = wCore;  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();

      // Head
      if (a.style === 'meteor') {
        const r = 0.32 + 0.36 * (0.5 + 0.5 * u); // bigger as it approaches
        ctx.save();
        ctx.globalAlpha = 1.0 * alpha;
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.75 * alpha;
        ctx.strokeStyle = mid; ctx.lineWidth = 0.10; ctx.beginPath(); ctx.arc(hx, hy, r * 1.25, 0, Math.PI * 2); ctx.stroke();
        // Embers around the head
        const embers = 6;
        for (let k = 0; k < embers; k++) {
          const ang0 = Math.random() * Math.PI * 2;
          const rr = r + Math.random() * 0.35;
          const ex = hx + Math.cos(ang0) * rr;
          const ey = hy + Math.sin(ang0) * rr;
          ctx.globalAlpha = 0.6 * alpha;
          ctx.fillStyle = outer; ctx.beginPath(); ctx.arc(ex, ey, 0.06 + Math.random() * 0.08, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      } else {
        // small wedge arrowhead
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(ang);
        ctx.globalAlpha = 0.95 * alpha;
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.moveTo(0.10, 0);
        ctx.lineTo(-0.08, 0.05);
        ctx.lineTo(-0.08, -0.05);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    // Impact sparks
    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i];
      const a = Math.max(0, Math.min(1, s.ttl / (s.max || 0.14)));
      const isMeteor = s.style === 'meteor';
      const r = (isMeteor ? 0.55 : 0.25) + (isMeteor ? 0.45 : 0.25) * a;
      let outer = `rgba(255,170,80,${0.35 * a})`;
      let inner = `rgba(255,240,200,${0.85 * a})`;
      if (s.style === 'poison') { outer = `rgba(87,204,43,${0.35 * a})`; inner = `rgba(233,255,204,${0.85 * a})`; }
      if (s.style === 'magic') { outer = `rgba(126,92,255,${0.35 * a})`; inner = `rgba(233,225,255,${0.85 * a})`; }
      if (isMeteor) { outer = `rgba(255,140,60,${0.45 * a})`; inner = `rgba(255,240,200,${0.95 * a})`; }
      ctx.fillStyle = outer;
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = inner; ctx.lineWidth = isMeteor ? 0.12 : 0.06;
      ctx.beginPath(); ctx.arc(s.x, s.y, r * (isMeteor ? 1.8 : 1.35), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function getLightSources() {
    const arr = [];
    for (let i = 0; i < arrows.length; i++) {
      const a = arrows[i];
      const u = Math.max(0, Math.min(1, a.t / Math.max(1e-6, a.duration)));
      const hx = a.from.x + (a.to.x - a.from.x) * u;
      const hy = a.from.y + (a.to.y - a.from.y) * u;
      let color = '#ffb36b';
      if (a.style === 'poison') color = '#9cff66';
      if (a.style === 'magic') color = '#b69cff';
      const emitter = (a.style === 'flame') ? 'arrowFlame' : (a.style === 'meteor' ? 'meteorFlame' : null);
      const radius = a.style === 'meteor' ? 2.5 + 1.2 * u : 1.4;
      const intensity = a.style === 'meteor' ? 0.7 + 0.5 * u : 0.55;
      arr.push({ id: `arrow:${i}`, x: hx, y: hy, radius, intensity, color, flicker: 0, style: a.style, emitter });
    }
    return arr;
  }

  return { addArrow, addSpark, update, draw, getLightSources };
}

/**
 * Register all world → UI/FX bridges and expose helpers for the render loop.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {{ cam: any, ftext: any, startShake: Function, activeSpells: { getActiveSpellId: Function, setActiveSpell: Function } }} deps
 */
export function setupWorldEventHandlers(world, deps) {
  const { cam, ftext, startShake, activeSpells } = deps;
  const { getActiveSpellId, setActiveSpell } = activeSpells;

  const boltFx = createBoltFxManager(startShake, cam, 'bolt');
  const rippleFx = createRippleFxManager(startShake, cam);
  const arrowFx = createArrowFxManager(startShake, cam);
  /** @type {string[]} */
  const messageLog = [];

  function log(msg) {
    messageLog.push(msg);
    if (messageLog.length > 50) messageLog.shift();
    try {
      window.dispatchEvent(new CustomEvent("ui:updateMessageTicker", { detail: { entries: messageLog } }));
    } catch {}
  }

  function nameOfEntity(id) {
    const pe = playerEntity(world);
    const playerId = pe?.id || 0;
    const n = Number(id || 0);
    if (playerId && n === playerId) return "You";
    const ni = world.get(n, NamedIdentity);
    const label = ni?.name;
    return label ? bracketizeName(label) : `Entity ${n}`;
  }

  function nameOfItem(id) {
    const n = Number(id || 0);
    const ni = world.get(n, NamedIdentity);
    const info = world.get(n, ItemInfo);
    const label = ni?.name || info?.description || info?.type;
    return label ? bracketizeName(label) : `item ${n}`;
  }

  world.on("drank", ({ actor, itemId, target }) => {
    const who = nameOfEntity(actor);
    const it = nameOfItem(itemId);
    const tgt = nameOfEntity(target || actor);
    if (tgt === "You" && who === "You") {
      log(`You drink ${it}.`);
    } else if (who === tgt) {
      log(`${who} drinks ${it}.`);
    } else {
      log(`${who} uses ${it} on ${tgt}.`);
    }
  });

  world.on("castSpell", ({ actor, spellId, targetId }) => {
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId || actor);
    const s = getSpell(String(spellId || getActiveSpellId() || ""));
    const label = s?.name ? bracketizeName(s.name) : "[Spell]";
    if (who === "You" && tgt === "You") log(`You cast ${label}.`);
    else if (who === "You") log(`You cast ${label} on ${tgt}.`);
    else if (tgt === "You") log(`${who} casts ${label} on you.`);
    else log(`${who} casts ${label} on ${tgt}.`);
  });

  world.on("spell:bolt", ({ from, to, chainIndex = 0 }) => {
    boltFx.addBolt({ from, to, chainIndex });
  });
  world.on("spell:blastwave", ({ origin, radius = 8, life = 0.6, color = '#ff9d1e' }) => {
    if (origin && typeof origin.x === 'number' && typeof origin.y === 'number') {
      rippleFx.addRipple({ x: origin.x, y: origin.y, radius, life, color });
    }
  });

  // Meteor: a flaming projectile from sky to target, then an impact spark and shake
  world.on("spell:meteor", ({ from, to }) => {
    if (from && to) {
      arrowFx.addArrow({ from, to, style: 'meteor' });
      // Schedule impact spark roughly when it hits
      const dx = to.x - from.x; const dy = to.y - from.y;
      const dist = Math.hypot(dx, dy) || 0;
      const speed = 22; // match arrowFx
      const duration = Math.max(0.08, Math.min(0.35, dist / speed));
      try {
        const w = typeof window !== 'undefined' ? window : null;
        if (w && typeof w.setTimeout === 'function') {
          w.setTimeout(() => {
            arrowFx.addSpark(to.x, to.y, 'meteor');
          }, Math.round(duration * 1000));
        }
      } catch {}
    }
  });

  // Ranged shots: fast crossbow/arrow tracer (separate handler)
  world.on("ranged:shot", ({ from, to, style }) => {
    const s = style || 'flame';
    arrowFx.addArrow({ from, to, style: s });
    // Schedule impact spark to align with travel time
    if (from && to) {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.hypot(dx, dy) || 0;
      const speed = 22; // tiles/sec (keep in sync with arrowFx)
      const duration = Math.max(0.08, Math.min(0.35, dist / speed));
      try {
        const w = typeof window !== 'undefined' ? window : null;
        if (w && typeof w.setTimeout === 'function') {
          w.setTimeout(() => { arrowFx.addSpark(to.x, to.y, s); }, Math.round(duration * 1000));
        }
      } catch {}
    }
  });

  world.on("ranged:impact", ({ at, style }) => {
    if (at && typeof at.x === 'number' && typeof at.y === 'number') arrowFx.addSpark(at.x, at.y, style || 'flame');
  });

  world.on("spell:not-known", ({ spellId }) => {
    log(`You don't know that spell${spellId ? ` [${spellId}]` : ""}.`);
  });

  world.on("spell:unknown", ({ spellId }) => {
    log(`Unknown spell${spellId ? ` [${spellId}]` : ""}.`);
  });

  world.on("spell:oom", ({ spellId, need, have }) => {
    log(`Not enough mana to cast [${String(spellId || "spell")}] (need ${need}, have ${have}).`);
  });

  world.on("damage", ({ id, amount, source, critical, crit }) => {
    const who = nameOfEntity(id);
    const atk = Number(source || 0) ? nameOfEntity(source) : null;
    const critTxt = (critical || crit) ? " (CRIT!)" : "";
    if (atk) log(`${atk} hits ${who} for ${amount}${critTxt}.`);
    else log(`${who} takes ${amount} damage${critTxt}.`);
  });

  world.on("healed", ({ id, amount }) => {
    const who = nameOfEntity(id);
    log(`${who} heals ${amount}.`);
    const pos = world.get(Number(id || 0), Position);
    if (pos && Number.isFinite(amount)) {
      try { ftext.addHeal(pos.x, pos.y, amount, { color: "#7BFF7B" }); } catch {}
    }
  });

  world.on("died", ({ id }) => {
    const who = nameOfEntity(id);
    log(`${who} dies.`);
  });

  world.on("damaged", ({ target, amount, critical, crit, source }) => {
    const t = Number(target || 0) || 0;
    const pos = /** @type any */ (world.get(t, Position));
    const pe = playerEntity(world);
    const isPlayer = !!pe && pe.id === t;
    if (pos && Number.isFinite(amount)) {
      const col = isPlayer ? "#ff6060" : "#ffd966";
      ftext.addDamage(pos.x, pos.y, amount, { dmg: amount, color: col, crit: !!(critical || crit) });
    }
    const defName = nameOfEntity(target);
    const atkName = nameOfEntity(source);
    const critTxt = (critical || crit) ? " (CRIT!)" : "";
    let weaponLabel = "";
    if (Number(source || 0)) {
      const eq = /** @type any */ (world.get(Number(source || 0), Equipment));
      const wid = Number(eq?.weapon || 0);
      if (wid) {
        const wname = /** @type any */ (world.get(wid, NamedIdentity))?.name;
        if (wname) weaponLabel = ` with ${bracketizeName(wname)}`;
      }
    }
    log(`${atkName} hits ${defName}${weaponLabel} for ${amount}${critTxt}.`);
  });

  world.on("status", ({ id, kind, at, text, source }) => {
    const pos = (at && typeof at.x === "number" && typeof at.y === "number") ? at : world.get(Number(id || 0), Position);
    if (!pos) return;
    const style = (String(kind || "").toLowerCase() === "miss") ? "miss"
      : ((String(kind || "").toLowerCase() === "immune") ? "immune" : "status");
    const label = String(text || kind || "").toUpperCase() || (style === "miss" ? "MISS" : (style === "immune" ? "IMMUNE" : "STATUS"));
    try { ftext.addStatus(pos.x, pos.y, label, { style }); } catch {}
    const tgt = nameOfEntity(id);
    const src = Number(source || 0) ? nameOfEntity(source) : null;
    if (style === "miss" && src) log(`${src} misses ${tgt}.`);
    if (style === "immune" && src) log(`${src} can't hurt ${tgt}.`);
  });

  world.on("item:pickup", ({ actor, itemId, count }) => {
    const info = world.get(itemId, ItemInfo);
    if (!info) return;
    const pos = world.get(actor, Position);
    if (!pos) return;

    // Currency: float text feedback
    if (info.type === "currency") {
      const n = Number.isFinite(count) ? Number(count) : Number(info.count || 1);
      if (n > 0) {
        ftext.addGold(pos.x, pos.y, n, { color: "#ffcd45" });
      }
      return;
    }

    // Player pickups: notify quick action bar of the recent item
    const pe = playerEntity(world);
    if (pe && pe.id === actor) {
      const name = world.get(itemId, NamedIdentity)?.name || info.description || info.type || "item";
      const payload = {
        id: itemId,
        type: info.type,
        slot: info.slot || "",
        name,
        count: info.count || 1,
        rarityName: info.rarityName || "common",
        bonuses: info.bonuses || {},
        affixes: Array.isArray(info.affixes) ? info.affixes.slice() : [],
        damageDice: info.damageDice || null,
      };
      try { window.dispatchEvent(new CustomEvent("ui:recentPickup", { detail: { item: payload } })); } catch {}
    }
  });

  world.on("item:pickup", ({ actor }) => {
    const pe = playerEntity(world);
    if (!pe || pe.id !== actor) return;
    try { window.dispatchEvent(new CustomEvent("ui:hideGroundItem")); } catch {}
  });

  world.on("item:used", ({ actor, itemId }) => {
    // Refresh inventory UI
    try { window.dispatchEvent(new CustomEvent("ui:requestInventoryData")); } catch {}
    // Notify quick-slot logic about the used item
    try {
      const info = world.get(itemId, ItemInfo);
      const removed = !info;
      const count = info?.count || 0;
      window.dispatchEvent(new CustomEvent("ui:itemUsed", { detail: { itemId, removed, count } }));
    } catch {}
  });

  world.on("spell:learned", ({ spellId }) => {
    const s = getSpell(String(spellId || ""));
    const label = s?.name ? `[${s.name}]` : `[${String(spellId || "spell")}]`;
    log(`You learn ${label}.`);
    try { window.dispatchEvent(new CustomEvent("ui:requestInventoryData")); } catch {}
    if (!getActiveSpellId()) {
      setActiveSpell(String(spellId));
    }
    const sid = String(spellId || "");
    if (sid === "lightning" || sid === "meteor") {
      try {
        window.dispatchEvent(new CustomEvent("ui:showSpellGestureHint", {
          detail: { id: sid, mode: "learn" }
        }));
      } catch {}
    }
  });

  world.on("spell:already-known", ({ spellId }) => {
    const s = getSpell(String(spellId || ""));
    const label = s?.name ? `[${s.name}]` : `[${String(spellId || "spell")}]`;
    log(`You already know ${label}.`);
  });

  world.on("spell:learn-denied", ({ reason, need, have, spellId }) => {
    const s = getSpell(String(spellId || ""));
    const label = s?.name ? `[${s.name}]` : (spellId ? `[${String(spellId)}]` : "that spell");
    let msg = `You can't learn ${label}.`;
    if (reason === "intelligence") msg = `You need more intelligence to learn ${label} (need ${need}, have ${have}).`;
    if (reason === "unknown-spell") msg = "This tome is inscrutable.";
    log(msg);
  });

  world.on("interaction", ({ action, result }) => {
    if (action === "toggleDoor") {
      log(`The door ${result === "opened" ? "opens" : (result === "closed" ? "closes" : "is locked")}.`);
    }
  });

  world.on("item:equipped", ({ itemId, slot, name }) => {
    const label = name ? bracketizeName(name) : `item ${itemId}`;
    log(`You equip ${label}${slot ? " (" + slot + ")" : ""}.`);
    try { window.dispatchEvent(new CustomEvent("ui:requestInventoryData")); } catch {}
    try { window.dispatchEvent(new CustomEvent("ui:itemEquipped", { detail: { itemId, slot } })); } catch {}
  });

  world.on("moved", ({ id, to }) => {
    const pe = playerEntity(world);
    if (!pe || pe.id !== id) return;

    const playerSettings = world.get(id, Settings);
    const anatomy = world.get(id, Anatomy);
    const reach = Math.max(0, anatomy?.reachDistance ?? 1);
    const radius = Math.max(0, world.get(id, BoundingCircle)?.radius ?? 0.5);
    const extraRange = Math.max(0, Number(playerSettings?.pickupRange ?? 0));
    const maxReach = reach + radius + extraRange;

    /** @type {Array<{ id:number, info:any, name:any, distance:number }>} */
    const nearby = [];
    for (const [eid, pos, info] of world.query(Position, ItemInfo)) {
      if (!pos) continue;
      if (!info || info.type === "currency") continue;
      const itemRadius = Math.max(0, world.get(eid, BoundingCircle)?.radius ?? 0);
      const dist = Math.max(0, Math.hypot(pos.x - to.x, pos.y - to.y) - itemRadius);
      if (dist > maxReach) continue;
      nearby.push({ id: eid, info, name: world.get(eid, NamedIdentity), distance: dist });
    }

    if (!nearby.length) {
      try { window.dispatchEvent(new CustomEvent("ui:hideGroundItem")); } catch {}
      return;
    }

    nearby.sort((a, b) => a.distance - b.distance);

    if (nearby.length > 1) {
      const items = nearby.map(({ id: eid, info, name }) => ({
        id: eid,
        type: info?.type || "item",
        name: name?.name || info?.type || "item",
        count: info?.count || 1,
      }));
      try {
        window.dispatchEvent(new CustomEvent("ui:showGroundItem", { detail: { mode: "multi", count: items.length, items } }));
      } catch {}
      return;
    }

    const { id: itemId, info, name } = nearby[0];
    const affixes = Array.isArray(info?.affixes) ? info.affixes.slice() : [];
    const bonuses = info?.bonuses && typeof info.bonuses === "object" ? { ...info.bonuses } : {};
    const payload = {
      mode: "single",
      item: {
        id: itemId,
        name: name?.name || info?.description || info?.type || "item",
        rarityName: info?.rarityName || "common",
        description: info?.description || "",
        count: info?.count || 1,
        bonuses,
        affixes,
        damageDice: info?.damageDice || null,
      },
      pickupRange: maxReach,
    };
    try { window.dispatchEvent(new CustomEvent("ui:showGroundItem", { detail: payload })); } catch {}
  });

  function getMessageLogEntries() {
    return messageLog.slice();
  }

  return {
    log,
    getMessageLogEntries,
    updateBoltFx: boltFx.update,
    drawBoltEffects: boltFx.draw,
    getBoltLightSources: () => boltFx.getLightSources(),
    updateRippleFx: rippleFx.update,
    drawRippleEffects: rippleFx.draw,
    updateArrowFx: arrowFx.update,
    drawArrowEffects: arrowFx.draw,
    getArrowLightSources: () => arrowFx.getLightSources(),
  };
}

function pathPolyline(ctx, pts) {
  if (!pts.length) return;
  const first = pts[0];
  if (!first) return;
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (!p) continue;
    ctx.lineTo(p.x, p.y);
  }
}

function jitterLine(a, b, segments = 9, amp = 0.08) {
  const out = [];
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const j = (i === 0 || i === segments) ? 0 : (Math.random() * 2 - 1) * amp;
    out.push({ x: a.x + dx * t + nx * j, y: a.y + dy * t + ny * j });
  }
  return out;
}
