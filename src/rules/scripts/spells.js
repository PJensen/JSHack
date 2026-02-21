// rules/scripts/spells.js
// Minimal spell script registry and runner (pure rules; deterministic).
/** @typedef {import('../../lib/ecs-js/index.js').World} World */

/**
 * Register built-in spell scripts here. Handlers may mutate the world,
 * spawn projectiles, apply status, or emit semantic events.
 * Signature: (world, actor, spell, intent) => void
 */
const REGISTRY = Object.create(null);

import { Position } from "../components/Position.js";
import { DungeonState } from "../components/DungeonState.js";
import { Faction } from "../components/Faction.js";
import { Vitality } from "../components/Vitality.js";
import { Collider } from "../components/Collider.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { Physiology } from "../components/Physiology.js";
import { isWalkable, isOpaque } from "../environment/dungeon/tileMap.js";
import { hasLOS } from "../../shared/math/gridLOS.js";
import { dealDamage } from "../utils/dealDamage.js";
import { findNearestValidTileAround } from "../utils/queries.js";
import { combatSeed, mulberry32 } from "../utils/rng.js";
import { statusStrength } from "../utils/statusFacade.js";

const BLINK_DIRS = Object.freeze([
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],            [1, 0],
  [-1, 1],  [0, 1],   [1, 1],
]);

/**
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @returns {number}
 */
function chebyshev(a, b) {
  return Math.max(Math.abs((a.x | 0) - (b.x | 0)), Math.abs((a.y | 0) - (b.y | 0)));
}

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
    const fac = /** @type any */ (world.get(id, Faction));
    if (!fac || fac.key !== 'enemy') continue;
    const vit = /** @type any */ (world.get(id, Vitality));
    if (!vit || (vit.hp|0) <= 0) continue;
    // within max radius (LOS is checked per-hop, not globally)
    if (d2(apos.x, apos.y, p.x, p.y) <= MAX_R*MAX_R) {
      candidates.push({ id, x: p.x, y: p.y });
    }
  }

  // First target must be in LOS from the caster
  candidates.sort((a,b)=> d2(apos.x,apos.y,a.x,a.y) - d2(apos.x,apos.y,b.x,b.y));
  let first = null;
  for (const c of candidates) {
    if (hasLOS(apos.x|0, apos.y|0, c.x|0, c.y|0, isOpaque)) { first = c; break; }
  }
  if (!first) {
    // Nothing visible to hit; emit a short self-burst semantic
    try { world.emit && world.emit('spell:bolt', { actor, targetId: actor, spellId: spell.id, from: {x: apos.x, y: apos.y}, to: {x: apos.x, y: apos.y}, chainIndex: 0 }); } catch (e) { console.debug('[spells] emit spell:bolt failed:', e); }
    return;
  }

  const used = new Set();
  const chain = [];
  used.add(first.id);
  chain.push(first);

  // Chain to up to CHAIN_MAX-1 additional targets, nearest to current within CHAIN_RADIUS
  while (chain.length < CHAIN_MAX) {
    const last = chain[chain.length - 1];
    let best = null; let bestD2 = Infinity;
    for (const c of candidates) {
      if (used.has(c.id)) continue;
      const dist2 = d2(last.x, last.y, c.x, c.y);
      if (dist2 <= CHAIN_RADIUS*CHAIN_RADIUS && dist2 < bestD2
          && hasLOS(last.x|0, last.y|0, c.x|0, c.y|0, isOpaque)) { best = c; bestD2 = dist2; }
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
    try { world.emit && world.emit('spell:bolt', { actor, targetId, spellId: spell.id, from: segFrom, to: segTo, chainIndex: i }); } catch (e) { console.debug('[spells] emit spell:bolt failed:', e); }

    // Damage model: base 7 → attenuate per chain
    const base = 7;
    const dmg = Math.max(1, Math.round(base * Math.pow(0.7, i)));
    dealDamage(world, { target: targetId, amount: dmg, source: actor, type: 'electric', cause: 'spell:lightning', at: segTo });
  }
};

// Blastwave — AoE knockback centered on caster. Pushes entities away; damage attenuated by distance.
REGISTRY['blastwave'] = function blastwaveScript(world, actor, spell, intent) {
  const apos = /** @type any */ (world.get(actor, Position));
  if (!apos) return;

  const RADIUS = 2;
  const BASE_DMG = 6;

  // Build entity-based blocking set (solid colliders like doors)
  // Terrain walls are handled by tileMap.isWalkable()
  const blocking = new Set();
  for (const [id, pos] of world.query(Position)) {
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
      if (!isWalkable(nx, ny) || blocking.has(`${nx},${ny}`)) break;
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
    dealDamage(world, { target: t.id, amount: dmg, source: actor, type: 'physical', cause: 'spell:blastwave' });
  }

  try { world.emit && world.emit('spell:blastwave', { actor, origin: { x: apos.x, y: apos.y }, knockbacks, radius: RADIUS }); } catch (e) { console.debug('[spells] emit spell:blastwave failed:', e); }
};

// Blink — targeted teleport up to 10 tiles.
// Confused/hallucinating casters blink in a deterministic random direction.
REGISTRY['blink'] = function blinkScript(world, actor, spell, intent) {
  const apos = /** @type any */ (world.get(actor, Position));
  if (!apos) return;

  const from = { x: apos.x | 0, y: apos.y | 0 };
  const maxRange = Math.max(1, Number.isFinite(spell?.range) ? (Number(spell.range) | 0) : 10);
  const confusedPower = statusStrength(world, actor, "confused");
  const hallucinPower = (
    statusStrength(world, actor, "hallucinating")
    + statusStrength(world, actor, "hallucination")
    + statusStrength(world, actor, "hallucinated")
    + statusStrength(world, actor, "mindwiped")
  );
  const randomized = confusedPower > 0 || hallucinPower > 0;

  let requested = null;
  if (randomized) {
    const posSalt = (((from.x & 0xffff) << 16) ^ (from.y & 0xffff)) >>> 0;
    const r = mulberry32(combatSeed(world.seed, world.step, actor, posSalt, 0xB11E7));
    const [dx, dy] = BLINK_DIRS[(r() * BLINK_DIRS.length) | 0];
    const dist = 1 + ((r() * maxRange) | 0);
    requested = { x: from.x + dx * dist, y: from.y + dy * dist };
  } else {
    const tx = Number(intent?.x);
    const ty = Number(intent?.y);
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) {
      try { world.emit && world.emit('spell:blink:failed', { actor, spellId: spell.id, reason: 'no_target', range: maxRange }); } catch (e) { console.debug('[spells] emit spell:blink:failed failed:', e); }
      return;
    }
    requested = { x: tx | 0, y: ty | 0 };
  }

  const requestedDist = chebyshev(from, requested);
  if (requestedDist <= 0 || requestedDist > maxRange) {
    try { world.emit && world.emit('spell:blink:failed', { actor, spellId: spell.id, reason: 'out_of_range', requested, range: maxRange }); } catch (e) { console.debug('[spells] emit spell:blink:failed failed:', e); }
    return;
  }

  const landing = findNearestValidTileAround(world, requested, {
    maxDistance: 1,
    exclude: [from],
  });
  if (!landing) {
    try { world.emit && world.emit('spell:blink:failed', { actor, spellId: spell.id, reason: 'no_safe_landing', requested, range: maxRange }); } catch (e) { console.debug('[spells] emit spell:blink:failed failed:', e); }
    return;
  }

  const landingDist = chebyshev(from, landing);
  if (landingDist <= 0 || landingDist > maxRange) {
    try { world.emit && world.emit('spell:blink:failed', { actor, spellId: spell.id, reason: 'landing_out_of_range', requested, range: maxRange }); } catch (e) { console.debug('[spells] emit spell:blink:failed failed:', e); }
    return;
  }

  world.set(actor, Position, { x: landing.x | 0, y: landing.y | 0 });
  try { world.emit && world.emit('moved', { id: actor, from, to: { x: landing.x | 0, y: landing.y | 0 } }); } catch (e) { console.debug('[spells] emit moved failed:', e); }
  try {
    world.emit && world.emit('spell:blink', {
      actor,
      spellId: spell.id,
      from,
      to: { x: landing.x | 0, y: landing.y | 0 },
      requested,
      randomized,
      randomReason: randomized ? (confusedPower > 0 ? "confused" : "hallucinating") : null,
      range: maxRange,
    });
  } catch (e) { console.debug('[spells] emit spell:blink failed:', e); }
};

// Homecoming — queues an app-level teleport request back to dungeon depth 0.
REGISTRY['homecoming'] = function homecomingScript(world, actor, spell, intent) {
  const apos = /** @type any */ (world.get(actor, Position));
  if (!apos) return;

  let fromDepth = 0;
  for (const [, ds] of world.query(DungeonState)) {
    fromDepth = Number(ds?.currentDepth || 0) | 0;
    break;
  }

  try {
    world.emit && world.emit('dungeon:teleport-depth', {
      actor,
      source: 'scroll_homecoming',
      targetDepth: 0,
      returnTicket: {
        depth: fromDepth,
        x: apos.x | 0,
        y: apos.y | 0,
      },
    });
  } catch (e) { console.debug('[spells] emit dungeon:teleport-depth failed:', e); }
};

// Meteor — AoE damage at target position. Full damage at radius 1, half at radius 2.
REGISTRY['meteor'] = function meteorScript(world, actor, spell, intent) {
  const apos = /** @type any */ (world.get(actor, Position));
  if (!apos) return;

  const RADIUS = 2;
  const BASE_DMG = 10;
  const MAX_R = Math.max(1, Number.isFinite(spell?.range) ? (Number(spell.range) | 0) : 12);
  const confusedPower = statusStrength(world, actor, "confused");
  const hallucinPower = (
    statusStrength(world, actor, "hallucinating")
    + statusStrength(world, actor, "hallucination")
    + statusStrength(world, actor, "hallucinated")
    + statusStrength(world, actor, "mindwiped")
  );
  const randomized = confusedPower > 0 || hallucinPower > 0;

  // Determine impact center:
  // - disoriented cast: deterministic random target from caster LOS cone
  // - directed cast: use intent x/y and validate LOS/range
  // - fallback: nearest enemy in LOS (kept for non-targeting callers)
  let ox, oy;
  if (randomized) {
    /** @type {Array<{x:number,y:number}>} */
    const candidates = [];
    for (let dy = -MAX_R; dy <= MAX_R; dy++) {
      for (let dx = -MAX_R; dx <= MAX_R; dx++) {
        if (dx === 0 && dy === 0) continue;
        const tx = (apos.x | 0) + dx;
        const ty = (apos.y | 0) + dy;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        if (dist > MAX_R) continue;
        if (!hasLOS(apos.x | 0, apos.y | 0, tx, ty, isOpaque)) continue;
        candidates.push({ x: tx, y: ty });
      }
    }
    if (candidates.length <= 0) {
      try { world.emit && world.emit('spell:meteor:failed', { actor, spellId: spell.id, reason: 'no_los_target', range: MAX_R }); } catch (e) { console.debug('[spells] emit spell:meteor:failed failed:', e); }
      return;
    }
    const posSalt = (((apos.x | 0) & 0xffff) << 16) ^ ((apos.y | 0) & 0xffff);
    const r = mulberry32(combatSeed(world.seed, world.step, actor, candidates.length, 0x0CE7E0A));
    const pick = candidates[(r() * candidates.length) | 0];
    ox = pick.x | 0;
    oy = pick.y | 0;
  } else if (intent && intent.x != null && intent.y != null) {
    ox = intent.x | 0;
    oy = intent.y | 0;
    const dist = Math.max(Math.abs((ox | 0) - (apos.x | 0)), Math.abs((oy | 0) - (apos.y | 0)));
    if (!(dist > 0) || dist > MAX_R) {
      try { world.emit && world.emit('spell:meteor:failed', { actor, spellId: spell.id, reason: 'out_of_range', range: MAX_R, requested: { x: ox, y: oy } }); } catch (e) { console.debug('[spells] emit spell:meteor:failed failed:', e); }
      return;
    }
    if (!hasLOS(apos.x | 0, apos.y | 0, ox | 0, oy | 0, isOpaque)) {
      try { world.emit && world.emit('spell:meteor:failed', { actor, spellId: spell.id, reason: 'blocked_los', range: MAX_R, requested: { x: ox, y: oy } }); } catch (e) { console.debug('[spells] emit spell:meteor:failed failed:', e); }
      return;
    }
  } else {
    // Auto-target nearest visible enemy with hp > 0 (fallback path)
    let bestId = 0, bestD2 = Infinity;
    for (const [id, pos] of world.query(Position)) {
      if (id === actor) continue;
      const fac = /** @type any */ (world.get(id, Faction));
      if (!fac || fac.key !== 'enemy') continue;
      const vit = /** @type any */ (world.get(id, Vitality));
      if (!vit || (vit.hp | 0) <= 0) continue;
      const dx = (pos.x | 0) - (apos.x | 0);
      const dy = (pos.y | 0) - (apos.y | 0);
      const d2 = dx * dx + dy * dy;
      if (d2 > (MAX_R * MAX_R)) continue;
      if (d2 < bestD2 && hasLOS(apos.x | 0, apos.y | 0, pos.x | 0, pos.y | 0, isOpaque)) { bestId = id; bestD2 = d2; }
    }
    if (!bestId) {
      try { world.emit && world.emit('spell:meteor:failed', { actor, spellId: spell.id, reason: 'no_target', range: MAX_R }); } catch (e) { console.debug('[spells] emit spell:meteor:failed failed:', e); }
      return;
    }
    const tp = /** @type any */ (world.get(bestId, Position));
    ox = tp.x | 0;
    oy = tp.y | 0;
  }

  // Apply AoE damage + burning
  for (const [id, pos] of world.query(Position)) {
    const vit = /** @type any */ (world.get(id, Vitality));
    if (!vit || (vit.hp | 0) <= 0) continue;
    const dist = Math.max(Math.abs((pos.x | 0) - ox), Math.abs((pos.y | 0) - oy));
    if (dist > RADIUS) continue;
    const dmg = dist <= 1 ? BASE_DMG : Math.max(1, Math.floor(BASE_DMG / 2));
    const result = dealDamage(world, { target: id, amount: dmg, source: actor, type: 'fire', cause: 'spell:meteor' });
    // Apply burning to survivors
    if (result.applied && !result.killed) {
      const ae = /** @type any */ (world.get(id, ActiveEffects));
      const effect = { key: 'burn', turnsLeft: 4, potency: 3, stacks: 1 };
      if (ae && Array.isArray(ae.effects)) {
        const existing = ae.effects.find(e => e.key === 'burn');
        if (existing) {
          existing.stacks = (existing.stacks || 1) + 1;
          existing.turnsLeft = Math.max(existing.turnsLeft, 4);
        } else {
          ae.effects.push(effect);
        }
      } else {
        try { world.add(id, ActiveEffects, { effects: [effect] }); } catch {} // ECS: may already exist
      }
      try { world.emit && world.emit('proc:burning', { actor, target: id }); } catch (e) { console.debug('[spells] emit proc:burning failed:', e); }
    }
  }

  try {
    world.emit && world.emit('spell:meteor', {
      actor,
      origin: { x: ox, y: oy },
      radius: RADIUS,
      randomized,
      randomReason: randomized ? (confusedPower > 0 ? "confused" : "hallucinating") : null,
    });
  } catch (e) { console.debug('[spells] emit spell:meteor failed:', e); }
};

// Frost — auto-target nearest enemy in LOS; apply cold damage + slow effect scaled by mass.
// Heavier creatures shrug off frost faster; lighter ones freeze longer.
REGISTRY['frost'] = function frostScript(world, actor, spell, intent) {
  const apos = /** @type any */ (world.get(actor, Position));
  if (!apos) return;

  const MAX_R = 10;
  const BASE_DMG = 4;

  const d2 = (x0, y0, x1, y1) => { const dx = x1 - x0, dy = y1 - y0; return dx * dx + dy * dy; };

  // Collect living enemy candidates in range
  /** @type {Array<{id:number,x:number,y:number,dist2:number}>} */
  const candidates = [];
  for (const [id, p] of world.query(Position)) {
    if (id === actor) continue;
    const fac = /** @type any */ (world.get(id, Faction));
    if (!fac || fac.key !== 'enemy') continue;
    const vit = /** @type any */ (world.get(id, Vitality));
    if (!vit || (vit.hp | 0) <= 0) continue;
    const dist2 = d2(apos.x, apos.y, p.x, p.y);
    if (dist2 <= MAX_R * MAX_R) {
      candidates.push({ id, x: p.x, y: p.y, dist2 });
    }
  }

  // Pick nearest with LOS
  candidates.sort((a, b) => a.dist2 - b.dist2);
  let target = null;
  for (const c of candidates) {
    if (hasLOS(apos.x | 0, apos.y | 0, c.x | 0, c.y | 0, isOpaque)) { target = c; break; }
  }
  if (!target) {
    // No valid target; emit a fizzle pulse at caster
    try { world.emit && world.emit('spell:frost', { actor, targetId: actor, at: { x: apos.x, y: apos.y }, from: { x: apos.x, y: apos.y }, duration: 0, mass: 0, fizzle: true }); } catch (e) { console.debug('[spells] emit spell:frost failed:', e); }
    return;
  }

  // Apply cold damage
  dealDamage(world, { target: target.id, amount: BASE_DMG, source: actor, type: 'cold', cause: 'spell:frost', at: { x: target.x, y: target.y } });

  // Compute frost duration from target mass: lighter = longer slow
  // Base 5 turns, -1 per 30kg above 40kg, min 2 turns
  const phys = /** @type any */ (world.get(target.id, Physiology));
  const massKg = (phys && typeof phys.massKg === 'number') ? phys.massKg : 80;
  const baseDuration = 5;
  const massPenalty = Math.floor(Math.max(0, massKg - 40) / 30);
  const duration = Math.max(2, baseDuration - massPenalty);

  // Apply frost effect via ActiveEffects (ECS-compliant: read-then-mutate)
  let ae = /** @type any */ (world.get(target.id, ActiveEffects));
  if (!ae) {
    try { world.add(target.id, ActiveEffects, { effects: [] }); } catch {} // ECS: may already exist
    ae = /** @type any */ (world.get(target.id, ActiveEffects));
  }
  if (ae && Array.isArray(ae.effects)) {
    const existing = ae.effects.find(/** @param {any} e */ (e) => e.key === 'frost');
    if (existing) {
      existing.turnsLeft = Math.max(existing.turnsLeft, duration);
      existing.stacks = Math.min((existing.stacks || 1) + 1, 3);
    } else {
      ae.effects.push({ key: 'frost', turnsLeft: duration, potency: 1, stacks: 1, startedAtTurn: world.step, sourceId: actor });
    }
  }

  // Emit semantic event for display VFX
  try { world.emit && world.emit('spell:frost', { actor, targetId: target.id, from: { x: apos.x, y: apos.y }, at: { x: target.x, y: target.y }, duration, mass: massKg }); } catch (e) { console.debug('[spells] emit spell:frost failed:', e); }
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
    try { fn(world, actor, spell, intent || {}); } catch (e) { console.error('[spells] script "' + key + '" failed:', e); }
  }
}

/** @param {string} key @param {(world:World, actor:number, spell:any, intent:any)=>void} fn */
export function registerSpellScript(key, fn) {
  if (!key || typeof fn !== 'function') return;
  REGISTRY[String(key)] = fn;
}
