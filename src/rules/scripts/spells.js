// rules/scripts/spells.js
// Minimal spell script registry and runner (pure rules; deterministic).
/** @typedef {import('../../lib/ecs-js').World} World */

/**
 * Register built-in spell scripts here. Handlers may mutate the world,
 * spawn projectiles, apply status, or emit semantic events.
 * Signature: (world, actor, spell, intent) => void
 */
const REGISTRY = Object.create(null);

import { Position } from "../components/Position.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Vitality } from "../components/Vitality.js";
import { Terrain } from "../components/Terrain.js";
import { Collider } from "../components/Collider.js";

// Example: Lightning — auto-target nearest enemy and chain to up to 3 foes.
/** @param {World} world @param {number} actor @param {{id:string,name:string,manaCost:number,[k:string]:any}} spell @param {{[k:string]:any}} intent */
REGISTRY['lightning'] = function lightningScript(world, actor, spell, intent) {
  // Find actor position
  /** @type {{x:number,y:number}|null} */
  const apos = /** @type any */ (world.get(actor, Position));
  if (!apos) return;

  const MAX_R = 12; // tiles
  const CHAIN_MAX = 3;
  const CHAIN_RADIUS = 8;

  // Helper: distance squared
  const d2 = (x0, y0, x1, y1) => { const dx = x1 - x0, dy = y1 - y0; return dx*dx + dy*dy; };

  // Collect candidate targets (monsters only for now)
  /** @type {Array<{id:number,x:number,y:number}>} */
  const candidates = [];
  for (const [id, p] of world.query(Position)) {
    if (id === actor) continue;
    const ni = /** @type any */ (world.get(id, NamedIdentity));
    if (!ni || ni.identity !== 'monster') continue;
    const vit = /** @type any */ (world.get(id, Vitality));
    if (!vit || (vit.hp|0) <= 0) continue;
    // within max radius
    if (d2(apos.x, apos.y, p.x, p.y) <= MAX_R*MAX_R) {
      candidates.push({ id, x: p.x, y: p.y });
    }
  }
  if (!candidates.length) {
    // Nothing to hit; emit a short self-burst semantic
    try { world.emit && world.emit('spell:bolt', { actor, targetId: actor, spellId: spell.id, from: {x: apos.x, y: apos.y}, to: {x: apos.x, y: apos.y}, chainIndex: 0 }); } catch {}
    return;
  }

  // Choose nearest from actor
  candidates.sort((a,b)=> d2(apos.x,apos.y,a.x,a.y) - d2(apos.x,apos.y,b.x,b.y));
  const used = new Set();
  const chain = [];
  let cur = candidates[0];
  used.add(cur.id);
  chain.push(cur);

  // Chain to up to CHAIN_MAX-1 additional targets, nearest to current within CHAIN_RADIUS
  while (chain.length < CHAIN_MAX) {
    const last = chain[chain.length - 1];
    let best = null; let bestD2 = Infinity;
    for (const c of candidates) {
      if (used.has(c.id)) continue;
      const dist2 = d2(last.x, last.y, c.x, c.y);
      if (dist2 <= CHAIN_RADIUS*CHAIN_RADIUS && dist2 < bestD2) { best = c; bestD2 = dist2; }
    }
    if (!best) break;
    used.add(best.id);
    chain.push(best);
  }

  // Apply damage along the chain and emit semantic bolt events for display
  for (let i=0; i<chain.length; i++) {
    const segFrom = (i === 0) ? { x: apos.x, y: apos.y } : { x: chain[i-1].x, y: chain[i-1].y };
    const segTo = { x: chain[i].x, y: chain[i].y };
    const targetId = chain[i].id;
    try { world.emit && world.emit('spell:bolt', { actor, targetId, spellId: spell.id, from: segFrom, to: segTo, chainIndex: i }); } catch {}

    // Damage model: base 7 → attenuate per chain
    const base = 7;
    const dmg = Math.max(1, Math.round(base * Math.pow(0.7, i)));
    const vit = /** @type any */ (world.get(targetId, Vitality));
    if (vit) {
      vit.hp = Math.max(0, (vit.hp|0) - dmg);
      try { world.emit && world.emit('damage', { id: targetId, amount: dmg, at: segTo }); } catch {}
      if ((vit.hp|0) <= 0) {
        try { world.emit && world.emit('died', { id: targetId, at: segTo }); } catch {}
      }
    }
  }
};

// Blastwave — AoE knockback centered on caster. Pushes entities away; damage attenuated by distance.
REGISTRY['blastwave'] = function blastwaveScript(world, actor, spell, intent) {
  const apos = /** @type any */ (world.get(actor, Position));
  if (!apos) return;

  const RADIUS = 2;
  const BASE_DMG = 6;

  // Build walkability blocking set (non-walkable terrain + solid colliders)
  const blocking = new Set();
  for (const [id, pos] of world.query(Position)) {
    const ter = /** @type any */ (world.get(id, Terrain));
    if (ter && !ter.walkable) { blocking.add(`${pos.x},${pos.y}`); continue; }
    const col = /** @type any */ (world.get(id, Collider));
    if (col && col.solid) blocking.add(`${pos.x},${pos.y}`);
  }

  // Find targets within Chebyshev RADIUS, excluding caster, with hp > 0
  /** @type {Array<{id:number, dist:number, dx:number, dy:number}>} */
  const targets = [];
  for (const [id, pos] of world.query(Position)) {
    if (id === actor) continue;
    const vit = /** @type any */ (world.get(id, Vitality));
    if (!vit || (vit.hp | 0) <= 0) continue;
    const dx = (pos.x | 0) - (apos.x | 0);
    const dy = (pos.y | 0) - (apos.y | 0);
    const dist = Math.max(Math.abs(dx), Math.abs(dy));
    if (dist >= 1 && dist <= RADIUS) {
      targets.push({ id, dist, dx: Math.sign(dx), dy: Math.sign(dy) });
    }
  }

  const knockbacks = [];
  for (const t of targets) {
    const pos = /** @type any */ (world.get(t.id, Position));
    const pushDist = Math.max(1, RADIUS - t.dist + 1); // dist 1 → push 2, dist 2 → push 1

    // Walk push path, stop at blocking tiles
    let cx = pos.x | 0, cy = pos.y | 0;
    for (let step = 0; step < pushDist; step++) {
      const nx = cx + t.dx;
      const ny = cy + t.dy;
      if (blocking.has(`${nx},${ny}`)) break;
      cx = nx;
      cy = ny;
    }
    if (cx !== (pos.x | 0) || cy !== (pos.y | 0)) {
      pos.x = cx;
      pos.y = cy;
    }
    knockbacks.push({ id: t.id, x: cx, y: cy });

    // Damage attenuated by distance
    const dmg = Math.max(1, Math.round(BASE_DMG / t.dist));
    const vit = /** @type any */ (world.get(t.id, Vitality));
    if (vit) {
      vit.hp = Math.max(0, (vit.hp | 0) - dmg);
      try { world.emit && world.emit('damaged', { target: t.id, amount: dmg, source: actor }); } catch {}
      if ((vit.hp | 0) <= 0) {
        try { world.emit && world.emit('died', { id: t.id, killer: actor }); } catch {}
      }
    }
  }

  try { world.emit && world.emit('spell:blastwave', { actor, origin: { x: apos.x, y: apos.y }, knockbacks, radius: RADIUS }); } catch {}
};

// Meteor — AoE damage at target position. Full damage at radius 1, half at radius 2.
REGISTRY['meteor'] = function meteorScript(world, actor, spell, intent) {
  const apos = /** @type any */ (world.get(actor, Position));
  if (!apos) return;

  const RADIUS = 2;
  const BASE_DMG = 10;

  // Determine impact center: prefer intent x/y, else auto-target nearest enemy
  let ox, oy;
  if (intent && intent.x != null && intent.y != null) {
    ox = intent.x | 0;
    oy = intent.y | 0;
  } else {
    // Auto-target nearest enemy with hp > 0
    let bestId = 0, bestD2 = Infinity;
    for (const [id, pos] of world.query(Position)) {
      if (id === actor) continue;
      const vit = /** @type any */ (world.get(id, Vitality));
      if (!vit || (vit.hp | 0) <= 0) continue;
      const dx = (pos.x | 0) - (apos.x | 0);
      const dy = (pos.y | 0) - (apos.y | 0);
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { bestId = id; bestD2 = d2; }
    }
    if (!bestId) return;
    const tp = /** @type any */ (world.get(bestId, Position));
    ox = tp.x | 0;
    oy = tp.y | 0;
  }

  // Apply AoE damage
  for (const [id, pos] of world.query(Position)) {
    if (id === actor) continue; // caster immune (optional: remove if self-damage desired)
    const vit = /** @type any */ (world.get(id, Vitality));
    if (!vit || (vit.hp | 0) <= 0) continue;
    const dist = Math.max(Math.abs((pos.x | 0) - ox), Math.abs((pos.y | 0) - oy));
    if (dist > RADIUS) continue;
    const dmg = dist <= 1 ? BASE_DMG : Math.max(1, Math.floor(BASE_DMG / 2));
    vit.hp = Math.max(0, (vit.hp | 0) - dmg);
    try { world.emit && world.emit('damaged', { target: id, amount: dmg, source: actor }); } catch {}
    if ((vit.hp | 0) <= 0) {
      try { world.emit && world.emit('died', { id, killer: actor }); } catch {}
    }
  }

  try { world.emit && world.emit('spell:meteor', { actor, origin: { x: ox, y: oy }, radius: RADIUS }); } catch {}
};

/**
 * Execute a spell script if present.
 * @param {World} world
 * @param {number} actor
 * @param {{ id:string, name:string, manaCost:number, [k:string]:any }} spell
 * @param {{ [k:string]: any }} intent
 */
export function runSpellScript(world, actor, spell, intent) {
  const key = String(spell?.script || '') || '';
  const fn = key ? REGISTRY[key] : null;
  if (typeof fn === 'function') {
    try { fn(world, actor, spell, intent || {}); } catch {}
  }
}

/** @param {string} key @param {(world:World, actor:number, spell:any, intent:any)=>void} fn */
export function registerSpellScript(key, fn) {
  if (!key || typeof fn !== 'function') return;
  REGISTRY[String(key)] = fn;
}
