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
import { Brain } from "../components/Brain.js";
import { Collider } from "../components/Collider.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { Physiology } from "../components/Physiology.js";
import { isWalkable } from "../environment/dungeon/tileMap.js";
import { buildBlocksVisionMap, blockedCallback } from "../utils/vision.js";
import { hasLOS } from "../../shared/math/gridLOS.js";
import { bresenhamLine } from "../../shared/math/bresenham.js";
import { dealDamage } from "../utils/dealDamage.js";
import { findNearestValidTileAround } from "../utils/queries.js";
import { combatSeed, mulberry32 } from "../utils/rng.js";
import { statusStrength } from "../utils/statusFacade.js";
import { upsertTimedEffect } from "../utils/effectSemantics.js";
import { areFactionsHostile } from "../utils/factionHostility.js";
import { buildSpellDamageSpec, createSpellDamageContext, emitSpellMiss, getSpellHitChancePct, getSpellIntelligenceBonus, rollSpellHit, scaleSpellDamage } from "../utils/spellDamage.js";
import { hasSpellLineOfSight } from "../utils/spellTargeting.js";
import { isVisible as isTileVisible } from "../environment/dungeon/exploredMap.js";
import { getPassiveBonuses } from "../utils/passiveBonuses.js";
import { spawnHazard } from "../utils/hazardSpawn.js";
import { createFrom } from "../../lib/ecs-js/archetype.js";
import { Monster } from "../archetypes/Creatures.js";
import { blind, getEffectiveVisionRange } from "../utils/blind.js";
import { Player } from "../components/Player.js";

const BLINK_DIRS = Object.freeze([
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],            [1, 0],
  [-1, 1],  [0, 1],   [1, 1],
]);

const FLASH_HEAL_TUNING = Object.freeze({
  healFraction: 0.22,
  minimumHeal: 1,
  splash: Object.freeze({
    // Reserved for future spell-rank gating; currently always active.
    unlockLevel: 1,
    radius: 1,
    damage: 2,
    type: 'physical',
  }),
});

/**
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @returns {number}
 */
function chebyshev(a, b) {
  return Math.max(Math.abs((a.x | 0) - (b.x | 0)), Math.abs((a.y | 0) - (b.y | 0)));
}

/**
 * Placeholder for upcoming spell-rank progression.
 * @param {World} world
 * @param {number} actor
 * @param {{ [k:string]: any }} spell
 * @param {{ [k:string]: any }} intent
 * @returns {number}
 */
function getFlashHealSpellLevel(world, actor, spell, intent) {
  void world; void actor; void spell; void intent;
  return 1;
}

/**
 * @param {string} value
 * @returns {number}
 */
function hashString32(value) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i) & 0xff;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Build a LOS blocker callback that accounts for terrain opacity and entities
 * with Collider.blocksSight (e.g. closed doors).
 *
 * @param {World} world
 * @returns {(x:number, y:number) => boolean}
 */
function createLOSBlocker(world) {
  return blockedCallback(buildBlocksVisionMap(world));
}

/**
 * @param {World} world
 * @param {number} actor
 * @param {{ radius?:number }} spell
 * @returns {number}
 */
function resolveSpellRadius(world, actor, spell) {
  const base = Math.max(0, Number(spell?.radius || 0) | 0);
  const passive = getPassiveBonuses(world, actor);
  const bonus = Math.max(0, Math.floor(Number(passive?.spellRadiusDerived || 0)));
  return Math.max(0, base + bonus);
}

/**
 * @param {World} world
 * @param {number} actor
 * @param {{ range?:number, id?:string }} spell
 * @param {{ x?:number, y?:number }} intent
 * @returns {{ ok:boolean, center?:{x:number,y:number}, reason?:string, range?:number }}
 */
function resolveStormCenter(world, actor, spell, intent) {
  const apos = /** @type any */ (world.get(actor, Position));
  if (!apos) return { ok: false, reason: "no_caster_pos" };
  const tx = Number(intent?.x);
  const ty = Number(intent?.y);
  const maxRange = Math.max(1, Number.isFinite(spell?.range) ? (Number(spell.range) | 0) : 10);
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) {
    return { ok: false, reason: "no_target", range: maxRange };
  }
  const center = { x: tx | 0, y: ty | 0 };
  const dist = chebyshev(apos, center);
  if (!(dist > 0) || dist > maxRange) {
    return { ok: false, reason: "out_of_range", range: maxRange };
  }
  const isBlocked = createLOSBlocker(world);
  if (!hasSpellLineOfSight(world, {
    sourceId: actor,
    sourcePos: apos,
    targetPos: center,
    range: maxRange,
    isBlocked,
    allowFlyingOccupantAtTarget: true,
  })) {
    return { ok: false, reason: "blocked_los", range: maxRange };
  }
  return { ok: true, center };
}

/**
 * @param {World} world
 * @param {number} actor
 * @param {{ id?:string, boltsPerTick?:number }} spell
 * @param {{ x?:number, y?:number }} intent
 * @param {{ type:'cold'|'fire', cause:string, eventName:string, burn?:boolean, frost?:boolean, baseDamage:number }} tuning
 */
function runStormScript(world, actor, spell, intent, tuning) {
  const storm = resolveStormCenter(world, actor, spell, intent);
  if (!storm.ok || !storm.center) {
    try {
      world.emit && world.emit(`${String(tuning.eventName)}:failed`, {
        actor,
        spellId: spell.id,
        reason: storm.reason || "invalid_target",
        range: storm.range,
      });
    } catch (e) { console.debug("[spells] emit storm failed:", e); }
    return;
  }

  const radius = resolveSpellRadius(world, actor, spell);
  const center = storm.center;
  const tiles = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      tiles.push({ x: center.x + dx, y: center.y + dy });
    }
  }
  if (tiles.length <= 0) return;

  const boltCount = Math.max(1, Number(spell?.boltsPerTick || 3) | 0);
  const impactRadius = 1;
  const impactKeys = new Set();
  /** @type {Array<{x:number,y:number, radius:number}>} */
  const impacts = [];
  const centerSalt = ((((center.x & 0xffff) << 16) ^ (center.y & 0xffff)) ^ hashString32(String(spell?.id || ""))) >>> 0;
  const rng = mulberry32(combatSeed(world.seed, world.step, actor, boltCount, centerSalt));

  while (impacts.length < boltCount && impactKeys.size < tiles.length) {
    const idx = (rng() * tiles.length) | 0;
    const pick = tiles[idx];
    const key = `${pick.x},${pick.y}`;
    if (impactKeys.has(key)) continue;
    impactKeys.add(key);
    impacts.push({ x: pick.x, y: pick.y, radius: impactRadius });
  }

  for (let i = 0; i < impacts.length; i++) {
    const impact = impacts[i];
    for (const [id, pos] of world.query(Position)) {
      const vit = /** @type any */ (world.get(id, Vitality));
      if (!vit || (vit.hp | 0) <= 0) continue;
      const dist = Math.max(Math.abs((pos.x | 0) - impact.x), Math.abs((pos.y | 0) - impact.y));
      if (dist > impactRadius) continue;

      const result = dealDamage(world, buildSpellDamageSpec(world, actor, id, {
        spell,
        baseAmount: tuning.baseDamage,
        type: tuning.type,
        cause: tuning.cause,
        at: { x: impact.x, y: impact.y },
        salt: centerSalt ^ (id * 131) ^ (i + 1),
      }));

      if (result.applied && !result.killed && tuning.burn) {
        const ae = /** @type any */ (world.get(id, ActiveEffects));
        const effect = createSpellDotEffect(world, actor, spell, {
          key: "burn",
          turnsLeft: 3,
          potency: Math.max(1, scaleSpellDamage(world, actor, 1)),
          stacks: 1,
          cause: `${tuning.cause}:burn`,
          type: "fire",
        });
        if (ae && Array.isArray(ae.effects)) upsertTimedEffect(ae.effects, effect);
        else {
          try { world.add(id, ActiveEffects, { effects: [effect] }); } catch {}
        }
      }
      if (result.applied && !result.killed && tuning.frost) {
        let ae = /** @type any */ (world.get(id, ActiveEffects));
        if (!ae) {
          try { world.add(id, ActiveEffects, { effects: [] }); } catch {}
          ae = /** @type any */ (world.get(id, ActiveEffects));
        }
        if (ae && Array.isArray(ae.effects)) {
          const existing = ae.effects.find((effect) => effect?.key === "frost");
          if (existing) {
            existing.turnsLeft = Math.max(Number(existing.turnsLeft || 0), 2);
            existing.stacks = Math.min(3, Math.max(1, Number(existing.stacks || 1)) + 1);
          } else {
            ae.effects.push({
              key: "frost",
              turnsLeft: 2,
              potency: 1,
              stacks: 1,
              startedAtTurn: world.step,
              sourceId: actor,
            });
          }
        }
      }
    }

    if (tuning.burn) {
      try {
        spawnHazard(world, {
          x: impact.x,
          y: impact.y,
          kind: "fire",
          medium: "floor",
          turnsLeft: 3,
          radius: 0,
          tickDamage: 2,
          damageType: "fire",
          cause: "firestorm_fire",
          sourceId: actor,
          sourceKind: "firestorm",
          identity: "firestorm_fire",
          name: "Firestorm Fire",
          meta: { source: "firestorm", delivery: "storm_impact" },
        });
      } catch {}
    }
  }

  try {
    world.emit && world.emit(tuning.eventName, {
      actor,
      origin: center,
      radius,
      impacts,
      boltsPerTick: impacts.length,
    });
  } catch (e) { console.debug("[spells] emit storm event failed:", e); }
}

/**
 * Snapshot a spell-sourced DOT so future ticks do not depend on live caster stats.
 * This is shared by distinct effects like Agony and true fire burns from spells
 * such as Meteor or future Conflagurate-style effects.
 *
 * @param {World} world
 * @param {number} actor
 * @param {{ id?:string, [k:string]:any }} spell
 * @param {{
 *   key:string,
 *   turnsLeft:number,
 *   potency:number,
 *   stacks?:number,
 *   cause?:string,
 *   type?:string,
 * }} options
 */
function createSpellDotEffect(world, actor, spell, options) {
  const ctx = createSpellDamageContext(world, actor, spell, {
    cause: options?.cause,
    type: options?.type,
  });
  return {
    key: String(options?.key || "").toLowerCase(),
    turnsLeft: Math.max(0, Number(options?.turnsLeft || 0) | 0),
    potency: Math.max(1, Number(options?.potency || 1) | 0),
    stacks: Math.max(1, Number(options?.stacks || 1) | 0),
    startedAtTurn: world.step,
    sourceId: ctx.sourceId,
    spellId: ctx.spellId,
    meta: { spellDamage: ctx },
  };
}

// Example: Lightning — auto-target nearest enemy and chain to up to 3 foes.
/** @param {World} world @param {number} actor @param {{id:string,name:string,manaCost:number,[k:string]:any}} spell @param {{[k:string]:any}} intent */
REGISTRY['lightning'] = function lightningScript(world, actor, spell, intent) {
  // Find actor position
  /** @type {{x:number,y:number}|null} */
  const apos = /** @type any */ (world.get(actor, Position));
  if (!apos) return;
  const actorFaction = String(world.get(actor, Faction)?.key || 'player');
  const isBlocked = createLOSBlocker(world);

  const MAX_R = 12; // tiles
  const CHAIN_MAX = 3;
  const CHAIN_RADIUS = 8;

  // Helper: distance squared
  const d2 = (x0, y0, x1, y1) => { const dx = x1 - x0, dy = y1 - y0; return dx*dx + dy*dy; };

  // Collect candidate targets (hostiles only)
  /** @type {Array<{id:number,x:number,y:number}>} */
  const candidates = [];
  for (const [id, p] of world.query(Position)) {
    if (id === actor) continue;
    const fac = /** @type any */ (world.get(id, Faction));
    if (!fac || !areFactionsHostile(actorFaction, fac.key)) continue;
    const vit = /** @type any */ (world.get(id, Vitality));
    if (!vit || (vit.hp|0) <= 0) continue;
    if (actorFaction === 'player' && !isTileVisible(p.x | 0, p.y | 0)) continue;
    // within max radius (LOS is checked per-hop, not globally)
    if (d2(apos.x, apos.y, p.x, p.y) <= MAX_R*MAX_R) {
      candidates.push({ id, x: p.x, y: p.y });
    }
  }

  // First target must be in LOS from the caster
  candidates.sort((a,b)=> d2(apos.x,apos.y,a.x,a.y) - d2(apos.x,apos.y,b.x,b.y));
  let first = null;
  for (const c of candidates) {
    if (hasSpellLineOfSight(world, {
      sourceId: actor,
      targetId: c.id,
      sourcePos: apos,
      targetPos: c,
      range: MAX_R,
      isBlocked,
    })) { first = c; break; }
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
          && hasSpellLineOfSight(world, {
            sourceId: last.id,
            targetId: c.id,
            sourcePos: last,
            targetPos: c,
            range: CHAIN_RADIUS,
            isBlocked,
          })) { best = c; bestD2 = dist2; }
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
    const base = Math.max(1, Math.round(7 * Math.pow(0.7, i)));
    dealDamage(world, buildSpellDamageSpec(world, actor, targetId, {
      spell,
      baseAmount: base,
      type: 'electric',
      cause: 'spell:lightning',
      at: segTo,
      salt: i + 1,
    }));
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
    dealDamage(world, buildSpellDamageSpec(world, actor, t.id, {
      spell,
      baseAmount: dmg,
      type: 'physical',
      cause: 'spell:blastwave',
      salt: t.id,
    }));
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

// Phase Strike — offensive blink that damages and stuns enemies along the teleport path.
REGISTRY['phase_strike'] = function phaseStrikeScript(world, actor, spell, intent) {
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
      try { world.emit && world.emit('spell:phase_strike:failed', { actor, spellId: spell.id, reason: 'no_target', range: maxRange }); } catch (e) { console.debug('[spells] emit spell:phase_strike:failed failed:', e); }
      return;
    }
    requested = { x: tx | 0, y: ty | 0 };
  }

  const requestedDist = chebyshev(from, requested);
  if (requestedDist <= 0 || requestedDist > maxRange) {
    try { world.emit && world.emit('spell:phase_strike:failed', { actor, spellId: spell.id, reason: 'out_of_range', requested, range: maxRange }); } catch (e) { console.debug('[spells] emit spell:phase_strike:failed failed:', e); }
    return;
  }

  const landing = findNearestValidTileAround(world, requested, {
    maxDistance: 1,
    exclude: [from],
  });
  if (!landing) {
    try { world.emit && world.emit('spell:phase_strike:failed', { actor, spellId: spell.id, reason: 'no_safe_landing', requested, range: maxRange }); } catch (e) { console.debug('[spells] emit spell:phase_strike:failed failed:', e); }
    return;
  }

  const landingDist = chebyshev(from, landing);
  if (landingDist <= 0 || landingDist > maxRange) {
    try { world.emit && world.emit('spell:phase_strike:failed', { actor, spellId: spell.id, reason: 'landing_out_of_range', requested, range: maxRange }); } catch (e) { console.debug('[spells] emit spell:phase_strike:failed failed:', e); }
    return;
  }

  // Build a spatial lookup of living enemies on this floor
  /** @type {Map<string, Array<{id:number, x:number, y:number}>>} */
  const enemyByTile = new Map();
  for (const [id, p] of world.query(Position)) {
    if (id === actor) continue;
    const fac = /** @type any */ (world.get(id, Faction));
    if (!fac || fac.key !== 'enemy') continue;
    const vit = /** @type any */ (world.get(id, Vitality));
    if (!vit || (vit.hp | 0) <= 0) continue;
    const key = (p.x | 0) + ',' + (p.y | 0);
    let list = enemyByTile.get(key);
    if (!list) { list = []; enemyByTile.set(key, list); }
    list.push({ id, x: p.x | 0, y: p.y | 0 });
  }

  // Walk the Bresenham line and collect hit enemies (no duplicates)
  const STRIKE_DMG = 6;
  const STUN_TURNS = 3;
  /** @type {Array<{id:number, x:number, y:number}>} */
  const hits = [];
  const hitIds = new Set();
  for (const [bx, by] of bresenhamLine(from.x, from.y, landing.x | 0, landing.y | 0)) {
    const list = enemyByTile.get(bx + ',' + by);
    if (!list) continue;
    for (const ent of list) {
      if (hitIds.has(ent.id)) continue;
      hitIds.add(ent.id);
      hits.push(ent);
    }
  }

  // Teleport the actor
  world.set(actor, Position, { x: landing.x | 0, y: landing.y | 0 });
  try { world.emit && world.emit('moved', { id: actor, from, to: { x: landing.x | 0, y: landing.y | 0 } }); } catch (e) { console.debug('[spells] emit moved failed:', e); }

  // Apply damage and stun to each hit enemy
  for (const h of hits) {
    dealDamage(world, buildSpellDamageSpec(world, actor, h.id, {
      spell,
      baseAmount: STRIKE_DMG,
      type: 'physical',
      cause: 'spell:phase_strike',
      at: { x: h.x, y: h.y },
      salt: h.id,
    }));
    // Apply stun via ActiveEffects
    let ae = /** @type any */ (world.get(h.id, ActiveEffects));
    if (!ae) {
      try { world.add(h.id, ActiveEffects, { effects: [] }); } catch {}
      ae = /** @type any */ (world.get(h.id, ActiveEffects));
    }
    if (ae && Array.isArray(ae.effects)) {
      const existing = ae.effects.find(/** @param {any} e */ (e) => e.key === 'stun');
      if (existing) {
        existing.turnsLeft = Math.max(existing.turnsLeft, STUN_TURNS);
      } else {
        ae.effects.push({ key: 'stun', turnsLeft: STUN_TURNS, potency: 1, stacks: 1, startedAtTurn: world.step, sourceId: actor });
      }
    }
  }

  try {
    world.emit && world.emit('spell:phase_strike', {
      actor,
      spellId: spell.id,
      from,
      to: { x: landing.x | 0, y: landing.y | 0 },
      requested,
      hits: hits.map(h => ({ id: h.id, x: h.x, y: h.y })),
      randomized,
      randomReason: randomized ? (confusedPower > 0 ? "confused" : "hallucinating") : null,
      range: maxRange,
    });
  } catch (e) { console.debug('[spells] emit spell:phase_strike failed:', e); }
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

// Hearthstone — 10-turn channeled version of homecoming.
REGISTRY['hearthstone'] = function hearthstoneScript(world, actor, _spell, _intent) {
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
      source: 'hearthstone',
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
  const isBlocked = createLOSBlocker(world);

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
        if (!hasLOS(apos.x | 0, apos.y | 0, tx, ty, isBlocked)) continue;
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
    if (!hasSpellLineOfSight(world, {
      sourceId: actor,
      sourcePos: apos,
      targetPos: { x: ox, y: oy },
      range: MAX_R,
      isBlocked,
      allowFlyingOccupantAtTarget: true,
    })) {
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
      if (d2 < bestD2 && hasSpellLineOfSight(world, {
        sourceId: actor,
        targetId: id,
        sourcePos: apos,
        targetPos: pos,
        range: MAX_R,
        isBlocked,
      })) { bestId = id; bestD2 = d2; }
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
    const ddx = (pos.x | 0) - ox, ddy = (pos.y | 0) - oy;
    const dist = Math.sqrt(ddx * ddx + ddy * ddy);
    if (dist > RADIUS) continue;
    const dmg = dist <= 1.5 ? BASE_DMG : Math.max(1, Math.floor(BASE_DMG / 2));
    const result = dealDamage(world, buildSpellDamageSpec(world, actor, id, {
      spell,
      baseAmount: dmg,
      type: 'fire',
      cause: 'spell:meteor',
      salt: ((ox & 0xffff) << 16) ^ (oy & 0xffff) ^ dist ^ id,
    }));
    // Apply burning to survivors
    if (result.applied && !result.killed) {
      const ae = /** @type any */ (world.get(id, ActiveEffects));
      const effect = createSpellDotEffect(world, actor, spell, {
        key: 'burn',
        turnsLeft: 4,
        potency: scaleSpellDamage(world, actor, 3),
        stacks: 1,
        cause: 'spell:meteor:burn',
        type: 'fire',
      });
      if (ae && Array.isArray(ae.effects)) {
        upsertTimedEffect(ae.effects, effect);
      } else {
        try { world.add(id, ActiveEffects, { effects: [effect] }); } catch {} // ECS: may already exist
      }
      try { world.emit && world.emit('proc:burning', { actor, target: id }); } catch (e) { console.debug('[spells] emit proc:burning failed:', e); }
    }
  }

  for (let dy = -RADIUS; dy <= RADIUS; dy++) {
    for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > RADIUS) continue;
      try {
        spawnHazard(world, {
          x: ox + dx,
          y: oy + dy,
          kind: "fire",
          medium: "floor",
          turnsLeft: dist <= 1 ? 3 : 2,
          radius: 0,
          tickDamage: dist <= 1 ? 2 : 1,
          damageType: "fire",
          cause: "meteor_fire",
          sourceId: actor,
          sourceKind: "meteor",
          identity: "meteor_fire",
          name: "Meteor Fire",
          meta: { source: "meteor", delivery: "impact" },
        });
      } catch {}
    }
  }

  try {
    world.emit && world.emit('spell:meteor', {
      actor,
      from: { x: apos.x, y: apos.y },
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
  const actorFaction = String(world.get(actor, Faction)?.key || 'player');
  const isBlocked = createLOSBlocker(world);

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
    if (actorFaction === 'player' && !isTileVisible(p.x | 0, p.y | 0)) continue;
    const dist2 = d2(apos.x, apos.y, p.x, p.y);
    if (dist2 <= MAX_R * MAX_R) {
      candidates.push({ id, x: p.x, y: p.y, dist2 });
    }
  }

  // Pick nearest with LOS
  candidates.sort((a, b) => a.dist2 - b.dist2);
  let target = null;
  for (const c of candidates) {
    if (hasSpellLineOfSight(world, {
      sourceId: actor,
      targetId: c.id,
      sourcePos: apos,
      targetPos: c,
      range: MAX_R,
      isBlocked,
    })) { target = c; break; }
  }
  if (!target) {
    // No valid target; emit a fizzle pulse at caster
    try { world.emit && world.emit('spell:frost', { actor, targetId: actor, at: { x: apos.x, y: apos.y }, from: { x: apos.x, y: apos.y }, duration: 0, mass: 0, projectileDelay: 0, fizzle: true }); } catch (e) { console.debug('[spells] emit spell:frost failed:', e); }
    return;
  }

  // Projectile travel duration (must match display-layer frostbolt: speed 8, min 0.1, max 0.6)
  const _frostDist = Math.hypot(target.x - apos.x, target.y - apos.y) || 1;
  const _frostDelay = Math.max(0.1, Math.min(0.6, _frostDist / 8));

  // Apply cold damage
  const frostResult = dealDamage(world, buildSpellDamageSpec(world, actor, target.id, {
    spell,
    baseAmount: BASE_DMG,
    type: 'cold',
    cause: 'spell:frost',
    at: { x: target.x, y: target.y },
    projectileDelay: _frostDelay,
  }));

  // Compute frost duration from target mass: lighter = longer slow
  // Base 5 turns, -1 per 30kg above 40kg, min 2 turns
  const phys = /** @type any */ (world.get(target.id, Physiology));
  const massKg = (phys && typeof phys.massKg === 'number') ? phys.massKg : 80;
  const baseDuration = 5;
  const massPenalty = Math.floor(Math.max(0, massKg - 40) / 30);
  const duration = Math.max(2, baseDuration - massPenalty);

  if (frostResult.applied) {
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
  }

  // Emit semantic event for display VFX
  try {
    world.emit && world.emit('spell:frost', {
      actor,
      targetId: target.id,
      from: { x: apos.x, y: apos.y },
      at: { x: target.x, y: target.y },
      duration: frostResult.applied ? duration : 0,
      mass: massKg,
      projectileDelay: _frostDelay,
      missed: frostResult.reason === 'missed',
    });
  } catch (e) { console.debug('[spells] emit spell:frost failed:', e); }
};

REGISTRY["blizzard"] = function blizzardScript(world, actor, spell, intent) {
  runStormScript(world, actor, spell, intent, {
    type: "cold",
    cause: "spell:blizzard",
    eventName: "spell:blizzard",
    frost: true,
    baseDamage: 2,
  });
};

REGISTRY["firestorm"] = function firestormScript(world, actor, spell, intent) {
  runStormScript(world, actor, spell, intent, {
    type: "fire",
    cause: "spell:firestorm",
    eventName: "spell:firestorm",
    burn: true,
    baseDamage: 2,
  });
};

// Heal — restore HP to self or target. Range 6 tiles, heals 20-35 HP based on caster intelligence.
REGISTRY['heal'] = function healScript(world, actor, spell, intent) {
  const apos = /** @type any */ (world.get(actor, Position));
  if (!apos) return;

  // Determine target: intent position or self
  let targetId = actor;
  let targetPos = { x: apos.x, y: apos.y };

  const tx = Number(intent?.x);
  const ty = Number(intent?.y);
  if (Number.isFinite(tx) && Number.isFinite(ty)) {
    const maxRange = Math.max(1, Number.isFinite(spell?.range) ? (Number(spell.range) | 0) : 6);
    const dist = chebyshev(apos, { x: tx | 0, y: ty | 0 });
    if (dist <= maxRange) {
      // Find entity at target position
      for (const [id, p] of world.query(Position)) {
        if (p.x === (tx | 0) && p.y === (ty | 0)) {
          const fac = /** @type any */ (world.get(id, Faction));
          // Can heal allies or self, not enemies
          if (!fac || fac.key === 'ally' || id === actor) {
            targetId = id;
            targetPos = { x: p.x, y: p.y };
            break;
          }
        }
      }
    }
  }

  // Check if target needs healing
  const vit = /** @type any */ (world.get(targetId, Vitality));
  if (!vit || (vit.hp | 0) >= (vit.maxHp | 0)) {
    // No healing needed
    try { world.emit && world.emit('spell:heal', { actor, targetId, at: targetPos, amount: 0, reason: 'full_health' }); } catch (e) { console.debug('[spells] emit spell:heal failed:', e); }
    return;
  }

  // Calculate heal amount: 20-35 based on intelligence (if available)
  const brain = /** @type any */ (world.get(actor, Brain));
  const intBonus = brain?.intelligence ? Math.floor((brain.intelligence - 10) / 2) : 0;
  const healSalt = (((apos.x | 0) & 0xffff) << 16) ^ ((apos.y | 0) & 0xffff);
  const r = mulberry32(combatSeed(world.seed, world.step, actor, targetId, healSalt));
  const baseHeal = 20 + (r() * 16) | 0; // 20-35
  const amount = Math.max(1, baseHeal + intBonus);

  // Apply healing
  const oldHp = vit.hp | 0;
  vit.hp = Math.min(vit.maxHp | 0, oldHp + amount);
  const actualHeal = vit.hp - oldHp;

  // Emit events
  try { world.emit && world.emit('healed', { id: targetId, amount: actualHeal }); } catch (e) { console.debug('[spells] emit healed failed:', e); }
  try { world.emit && world.emit('spell:heal', { actor, targetId, at: targetPos, amount: actualHeal }); } catch (e) { console.debug('[spells] emit spell:heal failed:', e); }
};

// Flash Heal — high-cost, self-only instant heal.
REGISTRY['flash_heal'] = function flashHealScript(world, actor, spell, intent) {
  const apos = /** @type any */ (world.get(actor, Position));
  if (!apos) return;

  const vit = /** @type any */ (world.get(actor, Vitality));
  if (!vit || (vit.hp | 0) >= (vit.maxHp | 0)) {
    try { world.emit && world.emit('spell:flash_heal', { actor, targetId: actor, at: { x: apos.x, y: apos.y }, amount: 0, reason: 'full_health' }); } catch (e) { console.debug('[spells] emit spell:flash_heal failed:', e); }
    return;
  }

  const maxHp = vit.maxHp | 0;
  const spellLevel = getFlashHealSpellLevel(world, actor, spell, intent);
  const amount = Math.max(FLASH_HEAL_TUNING.minimumHeal, Math.floor(maxHp * FLASH_HEAL_TUNING.healFraction));

  const oldHp = vit.hp | 0;
  vit.hp = Math.min(maxHp, oldHp + amount);
  const actualHeal = vit.hp - oldHp;

  /** @type {Array<{id:number, amount:number, at:{x:number,y:number}}>} */
  const splashHits = [];
  const splash = FLASH_HEAL_TUNING.splash;
  if (spellLevel >= splash.unlockLevel && splash.radius > 0 && splash.damage > 0) {
    const actorFaction = /** @type any */ (world.get(actor, Faction))?.key || '';
    for (const [id, pos] of world.query(Position)) {
      if (id === actor) continue;
      const targetVit = /** @type any */ (world.get(id, Vitality));
      if (!targetVit || (targetVit.hp | 0) <= 0) continue;
      const dist = Math.max(Math.abs((pos.x | 0) - (apos.x | 0)), Math.abs((pos.y | 0) - (apos.y | 0)));
      if (dist < 1 || dist > (splash.radius | 0)) continue;
      const targetFaction = /** @type any */ (world.get(id, Faction))?.key || '';
      if (!areFactionsHostile(actorFaction, targetFaction)) continue;
      const result = dealDamage(world, buildSpellDamageSpec(world, actor, id, {
        spell,
        baseAmount: splash.damage | 0,
        type: splash.type,
        cause: 'spell:flash_heal',
        at: { x: pos.x | 0, y: pos.y | 0 },
        salt: id,
      }));
      if (result.applied && result.amount > 0) {
        splashHits.push({ id, amount: result.amount, at: { x: pos.x | 0, y: pos.y | 0 } });
      }
    }
  }

  try { world.emit && world.emit('healed', { id: actor, amount: actualHeal }); } catch (e) { console.debug('[spells] emit healed failed:', e); }
  try {
    world.emit && world.emit('spell:flash_heal', {
      actor,
      targetId: actor,
      at: { x: apos.x, y: apos.y },
      amount: actualHeal,
      spellLevel,
      splashHits,
    });
  } catch (e) { console.debug('[spells] emit spell:flash_heal failed:', e); }
};

// Smite — holy bolt against a hostile target in line of sight.
REGISTRY['smite'] = function smiteScript(world, actor, spell, intent) {
  const apos = /** @type any */ (world.get(actor, Position));
  if (!apos) return;
  const isBlocked = createLOSBlocker(world);

  const maxRange = Math.max(1, Number(spell?.range || 8));
  const d2 = (x0, y0, x1, y1) => { const dx = x1 - x0, dy = y1 - y0; return dx * dx + dy * dy; };

  let preferredTargetId = Number(intent?.targetId || 0) | 0;
  if (!(preferredTargetId > 0)) {
    const tx = Number(intent?.x);
    const ty = Number(intent?.y);
    if (Number.isFinite(tx) && Number.isFinite(ty)) {
      for (const [id, p] of world.query(Position)) {
        if ((p.x | 0) === (tx | 0) && (p.y | 0) === (ty | 0)) {
          preferredTargetId = id | 0;
          break;
        }
      }
    }
  }

  /** @type {Array<{id:number,x:number,y:number,dist2:number}>} */
  const candidates = [];
  for (const [id, p] of world.query(Position)) {
    if (id === actor) continue;
    const fac = /** @type any */ (world.get(id, Faction));
    if (!fac) continue;
    const actorFaction = /** @type any */ (world.get(actor, Faction))?.key || 'player';
    if (!areFactionsHostile(actorFaction, fac.key)) continue;
    const vit = /** @type any */ (world.get(id, Vitality));
    if (!vit || (vit.hp | 0) <= 0) continue;
    const dist2 = d2(apos.x, apos.y, p.x, p.y);
    if (dist2 <= maxRange * maxRange) {
      candidates.push({ id, x: p.x | 0, y: p.y | 0, dist2 });
    }
  }

  candidates.sort((a, b) => {
    if (a.id === preferredTargetId && b.id !== preferredTargetId) return -1;
    if (b.id === preferredTargetId && a.id !== preferredTargetId) return 1;
    return a.dist2 - b.dist2;
  });

  let target = null;
  for (const c of candidates) {
    if (hasSpellLineOfSight(world, {
      sourceId: actor,
      targetId: c.id,
      sourcePos: apos,
      targetPos: c,
      range: maxRange,
      isBlocked,
    })) {
      target = c;
      break;
    }
  }

  if (!target) {
    try { world.emit && world.emit('spell:smite', { actor, targetId: actor, at: { x: apos.x, y: apos.y }, fizzle: true }); } catch (e) { console.debug('[spells] emit spell:smite fizzle failed:', e); }
    return;
  }

  const result = dealDamage(world, buildSpellDamageSpec(world, actor, target.id, {
    spell,
    baseAmount: 6,
    type: 'holy',
    cause: 'spell:smite',
    at: { x: target.x, y: target.y },
    salt: target.id,
  }));

  try {
    world.emit && world.emit('spell:smite', {
      actor,
      targetId: target.id,
      at: { x: target.x, y: target.y },
      amount: result.amount || 0,
      missed: result.reason === 'missed',
    });
  } catch (e) { console.debug('[spells] emit spell:smite failed:', e); }

  // Dazzle: anyone with LOS to the impact gets a brief vision reduction (the flash).
  {
    const SCAN = 12;
    let playerDazzled = false;
    for (const [eid, epos] of world.query(Position)) {
      if (!world.get(eid, Brain)) continue;
      const dx = (epos.x | 0) - (target.x | 0);
      const dy = (epos.y | 0) - (target.y | 0);
      if (Math.abs(dx) > SCAN || Math.abs(dy) > SCAN) continue;
      if (!hasLOS(epos.x | 0, epos.y | 0, target.x | 0, target.y | 0, isBlocked)) continue;
      const curVision = getEffectiveVisionRange(world, eid);
      const rampOut = (world.rand() < 0.5) ? 2 : 3;
      blind(world, eid, Math.max(1, curVision - 2), 0, 0, rampOut);
      if (world.has(eid, Player)) playerDazzled = true;
    }
    if (playerDazzled) {
      try { world.emit && world.emit('spell:smite:dazzle'); } catch (e) { console.debug('[spells] smite:dazzle failed:', e); }
    }
  }
};

// Summon Skeleton — spawn a friendly skeleton near the caster.
REGISTRY['summon_skeleton'] = function summonSkeletonScript(world, actor, spell, intent) {
  const apos = /** @type any */ (world.get(actor, Position));
  if (!apos) return;
  const actorFaction = String(world.get(actor, Faction)?.key || "").trim().toLowerCase();
  const summonFaction = (actorFaction === "player" || actorFaction === "pet" || actorFaction === "summoned")
    ? "summoned"
    : (actorFaction || "summoned");

  // Find a walkable tile near the caster
  const spawnTile = findNearestValidTileAround(world, apos, {
    maxDistance: 2,
    exclude: [{ x: apos.x, y: apos.y }],
  });
  if (!spawnTile) {
    try { world.emit && world.emit('spell:summon_skeleton:failed', { actor, spellId: spell.id, reason: 'no_space' }); } catch (e) { console.debug('[spells] emit spell:summon_skeleton:failed failed:', e); }
    return;
  }

  // Create a friendly skeleton entity
  const skeletonId = createFrom(world, Monster, {
    x: spawnTile.x,
    y: spawnTile.y,
    name: 'Summoned Skeleton',
    identity: 'skeleton',
    faction: summonFaction,
    maxHp: 12,
    accuracyDerived: 2,
    damagePowerDerived: 2,
    evadeDerived: 2,
    naturalDamageDice: '1d6',
    sizeClass: 'M',
    massKg: 25,
    speed: 2,
    resistances: {
      kinetic: { DR: 4, bluntMult: 1.5, pierceMult: 0.5, slashMult: 0.7 },
      chemical: { toxMult: 0 },
    },
  });

  try {
    world.emit && world.emit('spell:summon_skeleton', {
      actor,
      skeletonId,
      faction: summonFaction,
      at: { x: spawnTile.x, y: spawnTile.y },
    });
  } catch (e) { console.debug('[spells] emit spell:summon_skeleton failed:', e); }
};

// Shadow Bolt — high-damage shadow projectile, no status effect.
REGISTRY['shadow_bolt'] = function shadowBoltScript(world, actor, spell, intent) {
  const apos = /** @type any */ (world.get(actor, Position));
  if (!apos) return;
  const actorFaction = String(world.get(actor, Faction)?.key || 'player');
  const isBlocked = createLOSBlocker(world);

  const MAX_R = Number(spell.range || 10);
  const BASE_DMG = 8;

  const d2 = (x0, y0, x1, y1) => { const dx = x1 - x0, dy = y1 - y0; return dx * dx + dy * dy; };

  // Collect living hostile candidates in range
  /** @type {Array<{id:number,x:number,y:number,dist2:number}>} */
  const candidates = [];
  for (const [id, p] of world.query(Position)) {
    if (id === actor) continue;
    const fac = /** @type any */ (world.get(id, Faction));
    if (!fac || !areFactionsHostile(actorFaction, fac.key)) continue;
    const vit = /** @type any */ (world.get(id, Vitality));
    if (!vit || (vit.hp | 0) <= 0) continue;
    if (actorFaction === 'player' && !isTileVisible(p.x | 0, p.y | 0)) continue;
    const dist2 = d2(apos.x, apos.y, p.x, p.y);
    if (dist2 <= MAX_R * MAX_R) {
      candidates.push({ id, x: p.x, y: p.y, dist2 });
    }
  }

  // Pick nearest with LOS
  candidates.sort((a, b) => a.dist2 - b.dist2);
  let target = null;
  for (const c of candidates) {
    if (hasSpellLineOfSight(world, {
      sourceId: actor,
      targetId: c.id,
      sourcePos: apos,
      targetPos: c,
      range: MAX_R,
      isBlocked,
    })) { target = c; break; }
  }
  if (!target) {
    try { world.emit && world.emit('spell:shadow_bolt', { actor, targetId: actor, from: { x: apos.x, y: apos.y }, to: { x: apos.x, y: apos.y }, fizzle: true }); } catch (e) { console.debug('[spells] emit spell:shadow_bolt fizzle failed:', e); }
    return;
  }

  // Projectile travel duration (must match display-layer shadow_bolt: speed 10, min 0.08, max 0.7)
  const _sbDist = Math.hypot(target.x - apos.x, target.y - apos.y) || 1;
  const _sbDelay = Math.max(0.08, Math.min(0.7, _sbDist / 10));

  // Apply shadow damage — no status effect
  const result = dealDamage(world, buildSpellDamageSpec(world, actor, target.id, {
    spell,
    baseAmount: BASE_DMG,
    type: 'shadow',
    cause: 'spell:shadow_bolt',
    at: { x: target.x, y: target.y },
    projectileDelay: _sbDelay,
  }));

  // Emit VFX event
  try {
    world.emit && world.emit('spell:shadow_bolt', {
      actor,
      targetId: target.id,
      from: { x: apos.x, y: apos.y },
      to: { x: target.x, y: target.y },
      missed: result.reason === 'missed',
    });
  } catch (e) { console.debug('[spells] emit spell:shadow_bolt failed:', e); }
};

// Agony — shadow DOT curse, intelligence-scaled potency and duration.
REGISTRY['agony'] = function agonyScript(world, actor, spell, intent) {
  const apos = /** @type any */ (world.get(actor, Position));
  if (!apos) return;
  const actorFaction = String(world.get(actor, Faction)?.key || 'player');

  const MAX_R = Math.max(1, Number(spell.range || 8));
  const isBlocked = createLOSBlocker(world);
  const d2 = (x0, y0, x1, y1) => { const dx = x1 - x0, dy = y1 - y0; return dx * dx + dy * dy; };

  // Resolve target: prefer intent.targetId, fallback to auto-target nearest hostile
  let targetId = intent?.targetId || 0;
  let tpos = targetId ? /** @type any */ (world.get(targetId, Position)) : null;

  if (!targetId || !tpos) {
    // Auto-target fallback (confused casts, AI casters)
    /** @type {Array<{id:number,x:number,y:number,dist2:number}>} */
    const candidates = [];
    for (const [id, p] of world.query(Position)) {
      if (id === actor) continue;
      const fac = /** @type any */ (world.get(id, Faction));
      if (!fac || !areFactionsHostile(actorFaction, fac.key)) continue;
      const vit = /** @type any */ (world.get(id, Vitality));
      if (!vit || (vit.hp | 0) <= 0) continue;
      const dist2v = d2(apos.x, apos.y, p.x, p.y);
      if (dist2v <= MAX_R * MAX_R) candidates.push({ id, x: p.x, y: p.y, dist2: dist2v });
    }
    candidates.sort((a, b) => a.dist2 - b.dist2);
    let found = null;
    for (const c of candidates) {
      if (hasSpellLineOfSight(world, {
        sourceId: actor,
        targetId: c.id,
        sourcePos: apos,
        targetPos: c,
        range: MAX_R,
        isBlocked,
      })) { found = c; break; }
    }
    if (!found) {
      try { world.emit && world.emit('spell:agony', { actor, targetId: actor, fizzle: true }); } catch (e) { console.debug('[spells] emit spell:agony fizzle failed:', e); }
      return;
    }
    targetId = found.id;
    tpos = { x: found.x, y: found.y };
  }

  // Validate target alive
  const vit = /** @type any */ (world.get(targetId, Vitality));
  if (!vit || (vit.hp | 0) <= 0) {
    try { world.emit && world.emit('spell:agony', { actor, targetId, fizzle: true }); } catch (e) { console.debug('[spells] emit spell:agony fizzle failed:', e); }
    return;
  }

  // LOS check
  if (!hasSpellLineOfSight(world, {
    sourceId: actor,
    targetId,
    sourcePos: apos,
    targetPos: tpos,
    range: MAX_R,
    isBlocked,
  })) {
    try { world.emit && world.emit('spell:agony', { actor, targetId, fizzle: true, reason: 'no_los' }); } catch (e) { console.debug('[spells] emit spell:agony fizzle failed:', e); }
    return;
  }

  // Range check
  const dist = chebyshev(apos, tpos);
  if (dist > MAX_R) {
    try { world.emit && world.emit('spell:agony', { actor, targetId, fizzle: true, reason: 'out_of_range' }); } catch (e) { console.debug('[spells] emit spell:agony fizzle failed:', e); }
    return;
  }

  const hitChancePct = getSpellHitChancePct(world, actor, targetId);
  if (!rollSpellHit(world, actor, targetId, spell)) {
    emitSpellMiss(world, actor, targetId, spell, {
      cause: 'spell:agony',
      hitChancePct,
      at: { x: tpos.x, y: tpos.y },
    });
    try {
      world.emit && world.emit('spell:agony', {
        actor,
        targetId,
        from: { x: apos.x, y: apos.y },
        at: { x: tpos.x, y: tpos.y },
        missed: true,
        hitChancePct,
      });
    } catch (e) { console.debug('[spells] emit spell:agony miss failed:', e); }
    return;
  }

  // Intelligence scaling
  const intBonus = getSpellIntelligenceBonus(world, actor);
  const basePotency = 1 + Math.floor(intBonus / 8);
  const baseDuration = Math.min(10, 6 + Math.floor(intBonus / 4));

  // Apply agony DOT via ActiveEffects
  const agonyEffect = createSpellDotEffect(world, actor, spell, {
    key: 'agony',
    turnsLeft: baseDuration,
    potency: basePotency,
    stacks: 1,
    cause: 'spell:agony',
    type: 'shadow',
  });
  const ae = /** @type any */ (world.get(targetId, ActiveEffects));
  if (ae && Array.isArray(ae.effects)) {
    upsertTimedEffect(ae.effects, agonyEffect);
  } else {
    try { world.add(targetId, ActiveEffects, { effects: [agonyEffect] }); } catch {}
  }

  // Emit VFX event
  try {
    world.emit && world.emit('spell:agony', {
      actor,
      targetId,
      from: { x: apos.x, y: apos.y },
      at: { x: tpos.x, y: tpos.y },
      potency: basePotency,
      duration: baseDuration,
    });
  } catch (e) { console.debug('[spells] emit spell:agony failed:', e); }
};

REGISTRY['rampage'] = function rampageScript(world, actor, _spell, _intent) {
  const pos = world.get(actor, Position);
  if (!pos) return;

  let ae = world.get(actor, ActiveEffects);
  if (!ae) {
    world.add(actor, ActiveEffects, { effects: [] });
    ae = world.get(actor, ActiveEffects);
  }
  ae.effects.push({
    key: 'berserk',
    turnsLeft: 101,
    potency: 1,
    stacks: 1,
    sourceId: actor,
  });

  world.emit('spell:rampage', { actor, at: { x: pos.x, y: pos.y } });
};

REGISTRY['blind'] = function blindScript(world, actor, spell, intent) {
  const apos = /** @type any */ (world.get(actor, Position));
  if (!apos) return;

  const actorFaction = String(world.get(actor, Faction)?.key || 'player');
  const MAX_R = Math.max(1, Number(spell.range || 8));
  const isBlocked = createLOSBlocker(world);
  const d2 = (x0, y0, x1, y1) => { const dx = x1 - x0, dy = y1 - y0; return dx * dx + dy * dy; };

  // Resolve target from intent or auto-target nearest hostile
  let targetId = intent?.targetId || 0;
  let tpos = targetId ? /** @type any */ (world.get(targetId, Position)) : null;

  if (!targetId || !tpos) {
    /** @type {Array<{id:number,x:number,y:number,dist2:number}>} */
    const candidates = [];
    for (const [id, p] of world.query(Position)) {
      if (id === actor) continue;
      const fac = /** @type any */ (world.get(id, Faction));
      if (!fac || !areFactionsHostile(actorFaction, fac.key)) continue;
      const vit = /** @type any */ (world.get(id, Vitality));
      if (!vit || (vit.hp | 0) <= 0) continue;
      const dist2v = d2(apos.x, apos.y, p.x, p.y);
      if (dist2v <= MAX_R * MAX_R) candidates.push({ id, x: p.x, y: p.y, dist2: dist2v });
    }
    candidates.sort((a, b) => a.dist2 - b.dist2);
    let found = null;
    for (const c of candidates) {
      if (hasSpellLineOfSight(world, {
        sourceId: actor,
        targetId: c.id,
        sourcePos: apos,
        targetPos: c,
        range: MAX_R,
        isBlocked,
      })) { found = c; break; }
    }
    if (!found) {
      try { world.emit && world.emit('spell:blind', { actor, targetId: actor, fizzle: true, from: { x: apos.x, y: apos.y }, at: { x: apos.x, y: apos.y } }); } catch (e) { console.debug('[spells] emit spell:blind fizzle failed:', e); }
      return;
    }
    targetId = found.id;
    tpos = { x: found.x, y: found.y };
  }

  // Validate target alive
  const vit = /** @type any */ (world.get(targetId, Vitality));
  if (!vit || (vit.hp | 0) <= 0) {
    try { world.emit && world.emit('spell:blind', { actor, targetId, fizzle: true, from: { x: apos.x, y: apos.y }, at: { x: tpos.x, y: tpos.y } }); } catch (e) { console.debug('[spells] emit spell:blind fizzle failed:', e); }
    return;
  }

  // LOS check
  if (!hasSpellLineOfSight(world, {
    sourceId: actor, targetId,
    sourcePos: apos, targetPos: tpos, range: MAX_R, isBlocked,
  })) {
    try { world.emit && world.emit('spell:blind', { actor, targetId, fizzle: true, reason: 'no_los', from: { x: apos.x, y: apos.y }, at: { x: tpos.x, y: tpos.y } }); } catch (e) { console.debug('[spells] emit spell:blind fizzle failed:', e); }
    return;
  }

  // Range check
  const dist = chebyshev(apos, tpos);
  if (dist > MAX_R) {
    try { world.emit && world.emit('spell:blind', { actor, targetId, fizzle: true, reason: 'out_of_range', from: { x: apos.x, y: apos.y }, at: { x: tpos.x, y: tpos.y } }); } catch (e) { console.debug('[spells] emit spell:blind fizzle failed:', e); }
    return;
  }

  // Apply the vision envelope: ramp-in 4, hold 12, ramp-out 4, recover to original
  // toValue is 20% of current effective vision (significant impairment, not total blackout)
  const currentVision = getEffectiveVisionRange(world, targetId);
  const toValue = Math.max(1, Math.round(currentVision * 0.2));
  blind(world, targetId, toValue, 2, 16, 4);

  try {
    world.emit && world.emit('spell:blind', {
      actor,
      targetId,
      from: { x: apos.x, y: apos.y },
      at: { x: tpos.x, y: tpos.y },
    });
  } catch (e) { console.debug('[spells] emit spell:blind failed:', e); }
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
