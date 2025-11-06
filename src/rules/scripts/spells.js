// rules/scripts/spells.js
// Minimal spell script registry and runner (pure rules; deterministic).
/** @typedef {import('../../lib/ecs-js').World} World */

import { registerScript, runScript, ScriptVerb } from "../scripting.js";
import { Position } from "../components/Position.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Vitality } from "../components/Vitality.js";

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
