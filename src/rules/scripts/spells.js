// rules/scripts/spells.js
// Minimal spell script registry and runner (pure rules; deterministic).
/** @typedef {import('../../lib/ecs-js').World} World */

import { registerScript, runScript, ScriptVerb } from "../scripting.js";
import { Position } from "../components/Position.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Vitality } from "../components/Vitality.js";
import { Brain } from "../components/Brain.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { BoundingCircle } from "../components/BoundingCircle.js";
import { getGeometryKernel } from "../environment/worldGeometry.js";

const LIGHTNING_KEY = "lightning";

registerScript(LIGHTNING_KEY, {
  [ScriptVerb.SpellCast]: (world, ctx) => {
    const actor = ctx?.actor | 0;
    const spell = ctx?.spell;
    if (!(actor > 0) || !spell) return;

    /** @type {{x:number,y:number}|null} */
    const apos = /** @type any */ (world.get(actor, Position));
    if (!apos) return;

    const MAX_R = 12;
    const CHAIN_MAX = 3;
    const CHAIN_RADIUS = 8;
    const d2 = (x0, y0, x1, y1) => { const dx = x1 - x0, dy = y1 - y0; return dx * dx + dy * dy; };

    /** @type {Array<{id:number,x:number,y:number}>} */
    const candidates = [];
    for (const [id, p] of world.query(Position)) {
      if (id === actor) continue;
      const ni = /** @type any */ (world.get(id, NamedIdentity));
      if (!ni || ni.identity !== "monster") continue;
      const vit = /** @type any */ (world.get(id, Vitality));
      if (!vit || (vit.hp | 0) <= 0) continue;
      if (d2(apos.x, apos.y, p.x, p.y) <= MAX_R * MAX_R) {
        candidates.push({ id, x: p.x, y: p.y });
      }
    }
    if (!candidates.length) {
      try { world.emit && world.emit("spell:bolt", { actor, targetId: actor, spellId: spell.id, from: { x: apos.x, y: apos.y }, to: { x: apos.x, y: apos.y }, chainIndex: 0 }); } catch {}
      return;
    }

    candidates.sort((a, b) => d2(apos.x, apos.y, a.x, a.y) - d2(apos.x, apos.y, b.x, b.y));
    const used = new Set();
    const chain = [];
    let cur = candidates[0];
    used.add(cur.id);
    chain.push(cur);

    while (chain.length < CHAIN_MAX) {
      const last = chain[chain.length - 1];
      let best = null; let bestD2 = Infinity;
      for (const c of candidates) {
        if (used.has(c.id)) continue;
        const dist2 = d2(last.x, last.y, c.x, c.y);
        if (dist2 <= CHAIN_RADIUS * CHAIN_RADIUS && dist2 < bestD2) { best = c; bestD2 = dist2; }
      }
      if (!best) break;
      used.add(best.id);
      chain.push(best);
    }

    for (let i = 0; i < chain.length; i++) {
      const segFrom = (i === 0) ? { x: apos.x, y: apos.y } : { x: chain[i - 1].x, y: chain[i - 1].y };
      const segTo = { x: chain[i].x, y: chain[i].y };
      const targetId = chain[i].id;
      try { world.emit && world.emit("spell:bolt", { actor, targetId, spellId: spell.id, from: segFrom, to: segTo, chainIndex: i }); } catch {}

      const base = 7;
      const dmg = Math.max(1, Math.round(base * Math.pow(0.7, i)));
      const vit = /** @type any */ (world.get(targetId, Vitality));
      if (vit) {
        vit.hp = Math.max(0, (vit.hp | 0) - dmg);
        try { world.emit && world.emit("damage", { id: targetId, amount: dmg, at: segTo }); } catch {}
        if ((vit.hp | 0) <= 0) {
          try { world.emit && world.emit("died", { id: targetId, at: segTo }); } catch {}
        }
      }
    }
  },
});

// === Meteor spell ===
const METEOR_KEY = "meteor";

registerScript(METEOR_KEY, {
  [ScriptVerb.SpellCast]: (world, ctx) => {
    const actor = ctx?.actor | 0;
    const spell = ctx?.spell;
    const intent = ctx?.intent || {};
    if (!(actor > 0) || !spell) return;

    const apos = /** @type any */ (world.get(actor, Position));
    if (!apos) return;

    // Target coordinates required
    const tx = Number(intent?.x ?? intent?.toX ?? null);
    const ty = Number(intent?.y ?? intent?.toY ?? null);
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;

    // Vector for visual approach (optional)
    const vx = Number(intent?.vx ?? 0);
    const vy = Number(intent?.vy ?? 0);

    // Scale radius and base damage by intelligence
    /** @type {{intelligence?:number}|null} */
    const brain = /** @type any */ (world.get(actor, Brain));
    const intel = Math.max(0, Number(brain?.intelligence || 0));
    const radius = Math.max(1, Math.min(4, 1 + Math.floor(intel / 8))); // 1..4 tiles
    const baseDmg = Math.max(4, Math.round(8 + intel * 0.5));

    // Emit meteor visual with an approach vector
    // Choose a decent "from" point based on dir, defaulting to top if missing.
    let dirx = 0, diry = -1;
    if (Number.isFinite(vx) && Number.isFinite(vy) && (Math.hypot(vx, vy) > 1e-3)) {
      const len = Math.hypot(vx, vy) || 1;
      dirx = vx / len; diry = vy / len;
    }
    const from = { x: tx - dirx * 8, y: ty - diry * 8 };
    const to = { x: tx, y: ty };
    try { world.emit && world.emit("spell:meteor", { actor, spellId: spell.id, from, to, radius }); } catch {}

    // Deal AoE damage with mild radial falloff; apply burning DoT to survivors
    const r2 = radius * radius;
    for (const [id, p, vit] of world.query(Position, Vitality)) {
      if (!p || !vit) continue;
      const dist2 = (p.x - tx) * (p.x - tx) + (p.y - ty) * (p.y - ty);
      if (dist2 > r2) continue;
      // self-damage allowed
      // Distance falloff: 100% at center -> 60% at edge
      const d = Math.sqrt(dist2);
      const falloff = 0.6 + 0.4 * Math.max(0, 1 - (d / Math.max(1e-3, radius)));
      const dmg = Math.max(1, Math.round(baseDmg * falloff));
      vit.hp = Math.max(0, (vit.hp | 0) - dmg);
      try { world.emit && world.emit("damage", { id, amount: dmg, at: { x: p.x, y: p.y }, source: actor }); } catch {}
      if ((vit.hp | 0) <= 0) {
        try { world.emit && world.emit("died", { id, at: { x: p.x, y: p.y } }); } catch {}
        continue;
      }
      // Apply burning DoT (2-4 turns, 1-2 potency scaled lightly by int)
      const burnTurns = 2 + Math.min(2, Math.floor(intel / 12));
      const burnPotency = 1 + (intel >= 16 ? 1 : 0);
      const ae = /** @type any */ (world.get(id, ActiveEffects));
      const eff = { key: 'burning', turnsLeft: burnTurns, potency: burnPotency, sourceId: actor };
      if (ae && Array.isArray(ae.effects)) ae.effects.push(eff);
      else try { world.add(id, ActiveEffects, { effects: [eff] }); } catch {}
    }
  },
});

// === Blast Wave spell ===
const BLASTWAVE_KEY = "blastwave";

registerScript(BLASTWAVE_KEY, {
  [ScriptVerb.SpellCast]: (world, ctx) => {
    const actor = ctx?.actor | 0;
    const spell = ctx?.spell;
    if (!(actor > 0) || !spell) return;

    /** @type {{x:number,y:number}|null} */
    const apos = /** @type any */ (world.get(actor, Position));
    if (!apos) return;

    // Parameters
    const MAX_R = 9;            // effect radius (tiles)
    const BASE_DMG = 5;         // flat damage per target inside LOS
    const KNOCK_TILES = 2.5;    // target knockback distance (tiles)
    const STUN_CHANCE = 0.3;    // 30% chance
    const STUN_TURNS = 1;       // 1 turn

    // Visual: notify display layer to spawn a ripple ring
    try {
      world.emit && world.emit("spell:blastwave", {
        actor,
        spellId: spell.id,
        origin: { x: apos.x, y: apos.y },
        radius: MAX_R,
        life: 0.7,
        color: "#ff9d1e"
      });
    } catch {}

    // Gather monster candidates within radius and line-of-sight if possible
    const d2 = (x0, y0, x1, y1) => { const dx = x1 - x0, dy = y1 - y0; return dx * dx + dy * dy; };
    const r2 = MAX_R * MAX_R;

    /** @type {Array<{ id:number, x:number, y:number }>} */
    const targets = [];
    for (const [id, p, ni, vit] of world.query(Position, NamedIdentity, Vitality)) {
      if (!p || !ni || !vit) continue;
      if (id === actor) continue;
      if (ni.identity !== "monster") continue;
      if ((vit.hp | 0) <= 0) continue;
      if (d2(apos.x, apos.y, p.x, p.y) > r2) continue;
      // LOS check via geometry kernel occlusion raycast (best-effort)
      let inLos = true;
      try {
        // Bridge emits dungeon geometry to display; rules may or may not have a kernel.
        const kernel = getGeometryKernel?.(world) || null;
        if (kernel && typeof kernel.raycastOccl === 'function') {
          const dx = p.x - apos.x, dy = p.y - apos.y;
          const len = Math.hypot(dx, dy) || 1;
          const hit = kernel.raycastOccl({ x: apos.x, y: apos.y }, { x: dx / len, y: dy / len }, len);
          if (hit?.hit) inLos = false;
        }
      } catch {}
      if (inLos) targets.push({ id, x: p.x, y: p.y });
    }

    // Apply damage/knockback as the ring reaches each target (expand over life)
    const LIFE_SEC = 0.7;
    const schedule = (fn, ms) => {
      try { const w = /** @type any */ (typeof window !== 'undefined' ? window : null); if (w && typeof w.setTimeout === 'function') { w.setTimeout(fn, ms); return; } } catch {}
      // Fallback: run immediately if no timer available
      try { fn(); } catch {}
    };

    for (const t of targets) {
      const dist = Math.max(0, Math.hypot(t.x - apos.x, t.y - apos.y));
      const delay = Math.round((dist / Math.max(1e-6, MAX_R)) * LIFE_SEC * 1000);
      schedule(() => {
        const vit = /** @type any */ (world.get(t.id, Vitality));
        if (!vit) return;

        const curPos = /** @type any */ (world.get(t.id, Position));
        const tx = Number.isFinite(curPos?.x) ? curPos.x : t.x;
        const ty = Number.isFinite(curPos?.y) ? curPos.y : t.y;

        const before = vit.hp | 0;
        vit.hp = Math.max(0, before - BASE_DMG);
        try { world.emit && world.emit("damage", { id: t.id, amount: BASE_DMG, at: { x: tx, y: ty }, source: actor }); } catch {}

        // Knockback using geometry kernel sweep if available; otherwise naive set
        try {
          const kernel = getGeometryKernel?.(world) || null;
          if (curPos) {
            const dirx = curPos.x - apos.x; const diry = curPos.y - apos.y;
            const len = Math.hypot(dirx, diry) || 1;
            const ux = dirx / len, uy = diry / len;
            const desired = { x: curPos.x + ux * KNOCK_TILES, y: curPos.y + uy * KNOCK_TILES };
            let dest = desired;
            if (kernel && typeof kernel.sweepCapsule === 'function') {
              const radius = Math.max(0, /** @type any */ (world.get(t.id, BoundingCircle))?.radius ?? 0.45);
              const sweep = kernel.sweepCapsule({ x: curPos.x, y: curPos.y }, desired, radius, { epsilon: 0.05 });
              dest = { ...sweep.point };
            }
            if (Number.isFinite(dest.x) && Number.isFinite(dest.y)) {
              world.set(t.id, Position, { x: dest.x, y: dest.y });
              try { world.emit && world.emit("moved", { id: t.id, from: { x: curPos.x, y: curPos.y }, to: { x: dest.x, y: dest.y } }); } catch {}
            }
          }
        } catch {}

        // Chance to stun survivors
        if ((vit.hp | 0) > 0) {
          if (Math.random() < STUN_CHANCE) {
            const ae = /** @type any */ (world.get(t.id, ActiveEffects));
            const eff = { key: 'stunned', turnsLeft: STUN_TURNS, potency: 1, sourceId: actor };
            if (ae && Array.isArray(ae.effects)) ae.effects.push(eff);
            else try { world.add(t.id, ActiveEffects, { effects: [eff] }); } catch {}
          }
        } else {
          try { world.emit && world.emit("died", { id: t.id, at: { x: tx, y: ty } }); } catch {}
        }
      }, delay);
    }
  },
});

/**
 * Execute a spell script if present.
 * @param {World} world
 * @param {number} actor
 * @param {{ id:string, name:string, manaCost:number, [k:string]:any }} spell
 * @param {{ [k:string]: any }} intent
 */
export function runSpellScript(world, actor, spell, intent) {
  const key = String(spell?.script || "") || "";
  if (!key) return;
  runScript(key, ScriptVerb.SpellCast, world, { actor, spell, intent: intent || {} });
}

/** @param {string} key @param {(world:World, ctx:any)=>void | Record<string,(world:World,ctx:any)=>void>} fn */
export function registerSpellScript(key, fn) {
  if (!key) return;
  if (typeof fn === "function") {
    registerScript(key, { [ScriptVerb.SpellCast]: fn });
  } else if (typeof fn === "object" && fn) {
    registerScript(key, fn);
  }
}
