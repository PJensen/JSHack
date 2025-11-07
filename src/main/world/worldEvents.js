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

function createBoltFxManager(startShake, cam) {
  /** @type {Array<{from:{x:number,y:number}, to:{x:number,y:number}, ttl:number, max:number, chainIndex:number}>} */
  const bolts = [];
  /** @type {Array<{x:number,y:number, ttl:number}>} */
  const lightPulses = [];

  function addBolt({ from, to, chainIndex = 0 }) {
    if (from && to) {
      bolts.push({
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y },
        ttl: 0.14,
        max: 0.14,
        chainIndex: Number(chainIndex || 0)
      });
      lightPulses.push({ x: to.x, y: to.y, ttl: 0.12 });
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.hypot(dx, dy);
      const steps = Math.min(9, Math.max(2, Math.round(dist * 1.8)));
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const px = from.x + dx * t;
        const py = from.y + dy * t;
        const ttl = 0.08 + (0.05 * (1 - Math.abs(0.5 - t) * 1.6));
        lightPulses.push({ x: px, y: py, ttl });
      }
      startShake(cam, 4, 0.18);
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
      const a = Math.max(0, Math.min(1, pulse.ttl / 0.12));
      ctx.fillStyle = `rgba(180,240,255,${0.18 * a})`;
      ctx.beginPath(); ctx.arc(pulse.x, pulse.y, 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,255,220,${0.10 * a})`;
      ctx.beginPath(); ctx.arc(pulse.x, pulse.y, 0.35, 0, Math.PI * 2); ctx.fill();
    }
    for (const bolt of bolts) {
      const alpha = Math.max(0, Math.min(1, bolt.ttl / bolt.max));
      const pts = jitterLine(bolt.from, bolt.to, 11, 0.10 * alpha);
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.strokeStyle = `rgba(120,200,255,${0.18 * alpha})`;
      ctx.lineWidth = 0.22;
      pathPolyline(ctx, pts); ctx.stroke();

      ctx.strokeStyle = `rgba(160,220,255,${0.35 * alpha})`;
      ctx.lineWidth = 0.10;
      pathPolyline(ctx, pts); ctx.stroke();

      const core = jitterLine(bolt.from, bolt.to, 13, 0.05 * alpha);
      ctx.strokeStyle = `rgba(230,255,255,${0.9 * alpha})`;
      ctx.lineWidth = 0.045;
      pathPolyline(ctx, core); ctx.stroke();
    }
    ctx.restore();
  }

  return { addBolt, update, draw };
}

/**
 * Register all world → UI/FX bridges and expose helpers for the render loop.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {{ cam: any, ftext: any, startShake: Function, activeSpells: { getActiveSpellId: Function, setActiveSpell: Function } }} deps
 */
export function setupWorldEventHandlers(world, deps) {
  const { cam, ftext, startShake, activeSpells } = deps;
  const { getActiveSpellId, setActiveSpell } = activeSpells;

  const boltFx = createBoltFxManager(startShake, cam);
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
    if (!info || info.type !== "currency") return;
    const pos = world.get(actor, Position);
    if (!pos) return;
    const n = Number.isFinite(count) ? Number(count) : Number(info.count || 1);
    if (n > 0) {
      ftext.addGold(pos.x, pos.y, n, { color: "#ffcd45" });
    }
  });

  world.on("item:pickup", ({ actor }) => {
    const pe = playerEntity(world);
    if (!pe || pe.id !== actor) return;
    try { window.dispatchEvent(new CustomEvent("ui:hideGroundItem")); } catch {}
  });

  world.on("item:used", () => {
    try { window.dispatchEvent(new CustomEvent("ui:requestInventoryData")); } catch {}
  });

  world.on("spell:learned", ({ spellId }) => {
    const s = getSpell(String(spellId || ""));
    const label = s?.name ? `[${s.name}]` : `[${String(spellId || "spell")}]`;
    log(`You learn ${label}.`);
    try { window.dispatchEvent(new CustomEvent("ui:requestInventoryData")); } catch {}
    if (!getActiveSpellId()) {
      setActiveSpell(String(spellId));
    }
    if (String(spellId || "") === "lightning") {
      try {
        window.dispatchEvent(new CustomEvent("ui:showSpellGestureHint", {
          detail: { id: "lightning", mode: "learn" }
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
