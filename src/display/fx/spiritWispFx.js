// src/display/fx/spiritWispFx.js
// Spirit wisp — deity conduit that lives in VFX time between turns.
//
// Visual behaviors driven by deity mood + world state:
//   Mood telegraph  — orbit radius/speed/jitter respond to mood dimensions
//   Danger sense    — wisp darts nervously toward hidden traps & ambush monsters
//   Miracle delivery — wisp flies to intervention target, flares, returns
//   Betrayal        — at low standing the wisp drifts away and dims

import { Particle } from "../passes/vfx/particles/particlePool.js";
import { Position } from "../../rules/components/Position.js";
import { Trap } from "../../rules/components/Trap.js";

// ── Orbit geometry ──────────────────────────────────────────────────
const BASE_ORBIT_RADIUS = 1.2;
const BASE_ORBIT_SPEED = 1.4;      // rad/s
const COMBAT_ORBIT_SPEED = 4.0;
const BOB_AMP = 0.12;
const BOB_FREQ = 2.2;

// ── Mood → orbit modifiers ─────────────────────────────────────────
const WRATH_RADIUS_SHRINK = 0.5;   // orbit tightens with wrath
const SERENITY_RADIUS_GROW = 0.4;  // orbit widens with serenity
const CHAOS_JITTER_AMP = 0.25;     // positional jitter from chaos
const SORROW_SPEED_DRAG = 0.6;     // orbit slows with sorrow
const AMUSEMENT_SPEED_BOOST = 1.2; // orbit quickens with amusement

// ── Anchor / easing ────────────────────────────────────────────────
const ANCHOR_EASE = 2.5;

// ── Particles ──────────────────────────────────────────────────────
const TRAIL_RATE = 18;
const TRAIL_LIFE = 0.35;

// ── Light ──────────────────────────────────────────────────────────
const LIGHT_RADIUS = 3.0;
const LIGHT_PULSE_AMP = 0.4;
const LIGHT_PULSE_FREQ = 1.8;

// ── Combat agitation ───────────────────────────────────────────────
const COMBAT_DECAY = 2.0;

// ── Color ──────────────────────────────────────────────────────────
const COLOR_EASE_SPEED = 1.5;
const MOOD_RGB = {
  wrath:     [200, 30, 10],
  serenity:  [180, 220, 255],
  hunger:    [160, 120, 40],
  amusement: [255, 230, 100],
  sorrow:    [60, 50, 120],
  chaos:     [200, 180, 255],
};
const MOOD_KEYS = Object.keys(MOOD_RGB);
const NEUTRAL_COLOR = [140, 210, 255];

// ── Danger sense ───────────────────────────────────────────────────
const DANGER_SENSE_RADIUS = 4;     // tiles to scan for hidden traps / ambushers
const DANGER_PULL_STRENGTH = 0.35; // how far wisp drifts toward danger (tiles)
const DANGER_SCAN_INTERVAL = 0.5;  // seconds between scans (perf)

// ── Miracle flight ─────────────────────────────────────────────────
const MIRACLE_FLY_SPEED = 12;      // tiles/sec
const MIRACLE_FLARE_TIME = 0.4;    // seconds at target before returning
const MIRACLE_RETURN_SPEED = 8;

// ── Betrayal ───────────────────────────────────────────────────────
const BETRAYAL_STANDING_THRESHOLD = -0.3; // below this → betrayal mode
const BETRAYAL_ORBIT_OFFSET = 2.5;       // drift further from player
const BETRAYAL_DIM = 0.35;               // alpha multiplier

/**
 * @param {{
 *   world: import('../../lib/ecs-js/index.js').World,
 *   fx: { pool: { spawn(o:object):void } },
 *   getPosition: (id:number) => ({x:number,y:number}|null),
 *   getPlayerEntity: () => ({id:number, pos:{x:number,y:number}}|null),
 *   sampleMood: () => ({wrath:number,serenity:number,hunger:number,amusement:number,sorrow:number,chaos:number}|null),
 * }} deps
 */
export function createSpiritWispFxController({ world, fx, getPosition, getPlayerEntity, sampleMood }) {
  let _active = false;
  let _phase = Math.random() * Math.PI * 2;
  let _fxTime = 0;

  // Smoothed anchor
  let _anchorX = 0, _anchorY = 0, _anchored = false;

  // World position
  let _x = 0, _y = 0;

  // Combat agitation
  let _agitation = 0;

  // Particles
  let _trailAccum = 0;

  // Depth
  let _lastDepth = -1;

  // Smoothed color
  let _r = NEUTRAL_COLOR[0], _g = NEUTRAL_COLOR[1], _b = NEUTRAL_COLOR[2];

  // Cached mood values (updated each frame from sampler)
  let _wrath = 0, _serenity = 0, _chaos = 0, _sorrow = 0, _amusement = 0;

  // Danger sense state
  let _dangerDx = 0, _dangerDy = 0; // normalized pull direction
  let _dangerIntensity = 0;          // 0 = no danger, 1 = max
  let _dangerScanTimer = 0;

  // Miracle flight state
  const FLIGHT_IDLE = 0, FLIGHT_TO = 1, FLIGHT_FLARE = 2, FLIGHT_BACK = 3;
  let _flightState = FLIGHT_IDLE;
  let _flightTargetX = 0, _flightTargetY = 0;
  let _flightTimer = 0;
  let _flightSavedX = 0, _flightSavedY = 0; // where wisp was before flying

  // Prayer spiral — wisp spirals inward, absorbs, then expands back
  let _prayerTimer = 0;
  const PRAYER_SPIRAL_DURATION = 1.2;

  // Death vigil — wisp descends onto player tile, holds still
  let _deathVigil = false;
  let _deathLandT = 0;          // 0→1 eases wisp to player tile
  const DEATH_LAND_DURATION = 1.5; // seconds to settle

  // Betrayal
  let _standing = 0;
  let _betrayed = false;

  // ── Helpers ────────────────────────────────────────────────────────

  function _orbitSpeed() {
    let speed = BASE_ORBIT_SPEED;
    speed -= _sorrow * SORROW_SPEED_DRAG;
    speed += _amusement * AMUSEMENT_SPEED_BOOST;
    const combatT = Math.min(1, _agitation / COMBAT_DECAY);
    speed += (COMBAT_ORBIT_SPEED - BASE_ORBIT_SPEED) * combatT;
    return Math.max(0.3, speed);
  }

  function _orbitRadius() {
    let r = BASE_ORBIT_RADIUS;
    r -= _wrath * WRATH_RADIUS_SHRINK;
    r += _serenity * SERENITY_RADIUS_GROW;
    if (_betrayed) r += BETRAYAL_ORBIT_OFFSET;
    return Math.max(0.3, r);
  }

  function _updateMood(dtSec) {
    // Sample raw mood
    let tr = NEUTRAL_COLOR[0], tg = NEUTRAL_COLOR[1], tb = NEUTRAL_COLOR[2];
    if (typeof sampleMood === 'function') {
      const mood = sampleMood();
      if (mood) {
        _wrath = Number(mood.wrath || 0);
        _serenity = Number(mood.serenity || 0);
        _chaos = Number(mood.chaos || 0);
        _sorrow = Number(mood.sorrow || 0);
        _amusement = Number(mood.amusement || 0);

        // Blend color proportionally
        tr = 0; tg = 0; tb = 0;
        for (let i = 0; i < MOOD_KEYS.length; i++) {
          const k = MOOD_KEYS[i];
          const w = Number(mood[k] || 0);
          const c = MOOD_RGB[k];
          tr += c[0] * w; tg += c[1] * w; tb += c[2] * w;
        }

        // Compute standing for betrayal check
        _standing = (_serenity * 1.7) - (_wrath * 2.2) - (Number(mood.hunger || 0) * 0.25) - (_sorrow * 0.1);
        _betrayed = _standing < BETRAYAL_STANDING_THRESHOLD;
      }
    }
    const t = Math.min(1, COLOR_EASE_SPEED * dtSec);
    _r += (tr - _r) * t;
    _g += (tg - _g) * t;
    _b += (tb - _b) * t;
  }

  function _scanDangers(px, py) {
    // Only warn when in good standing
    if (_betrayed) { _dangerIntensity = 0; return; }

    let closestDist = Infinity;
    let dx = 0, dy = 0;
    let found = false;

    for (const [id, pos, trap] of world.query(Position, Trap)) {
      if (trap.revealed || !trap.armed) continue;
      const dist = Math.max(Math.abs(pos.x - px), Math.abs(pos.y - py));
      if (dist > DANGER_SENSE_RADIUS || dist < 1) continue;
      if (dist < closestDist) {
        closestDist = dist;
        dx = pos.x - px; dy = pos.y - py;
        found = true;
      }
    }

    if (found) {
      const len = Math.hypot(dx, dy) || 1;
      _dangerDx = dx / len;
      _dangerDy = dy / len;
      _dangerIntensity = Math.min(1, 1 - (closestDist - 1) / DANGER_SENSE_RADIUS);
    } else {
      _dangerIntensity = Math.max(0, _dangerIntensity - 0.05);
    }
  }

  // ── Miracle flight ────────────────────────────────────────────────

  function _startMiracleFlight(targetX, targetY) {
    if (_flightState !== FLIGHT_IDLE) return;
    _flightSavedX = _x;
    _flightSavedY = _y;
    _flightTargetX = targetX;
    _flightTargetY = targetY;
    _flightState = FLIGHT_TO;
    _flightTimer = 0;
  }

  function _tickFlight(dtSec) {
    if (_flightState === FLIGHT_IDLE) return false;

    _flightTimer += dtSec;

    if (_flightState === FLIGHT_TO) {
      const dx = _flightTargetX - _x;
      const dy = _flightTargetY - _y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.15) {
        _x = _flightTargetX; _y = _flightTargetY;
        _flightState = FLIGHT_FLARE;
        _flightTimer = 0;
      } else {
        const step = Math.min(dist, MIRACLE_FLY_SPEED * dtSec);
        _x += (dx / dist) * step;
        _y += (dy / dist) * step;
      }
      return true;
    }

    if (_flightState === FLIGHT_FLARE) {
      _x = _flightTargetX; _y = _flightTargetY;
      if (_flightTimer >= MIRACLE_FLARE_TIME) {
        _flightState = FLIGHT_BACK;
        _flightTimer = 0;
      }
      return true;
    }

    if (_flightState === FLIGHT_BACK) {
      // Return to anchor (which keeps moving with player)
      const dx = _anchorX - _x;
      const dy = _anchorY - _y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.3) {
        _flightState = FLIGHT_IDLE;
      } else {
        const step = Math.min(dist, MIRACLE_RETURN_SPEED * dtSec);
        _x += (dx / dist) * step;
        _y += (dy / dist) * step;
      }
      return true;
    }

    return false;
  }

  // ── Main tick ─────────────────────────────────────────────────────

  function tick(dtSec) {
    if (dtSec <= 0) return;
    _fxTime += dtSec;

    const pe = getPlayerEntity();
    if (!pe) { _active = false; return; }

    const ppos = getPosition(pe.id);
    if (!ppos) { _active = false; return; }

    if (_lastDepth === 0) { _active = false; return; }

    if (!_active || !_anchored) {
      _anchorX = ppos.x; _anchorY = ppos.y;
      _anchored = true; _active = true;
    }

    // Ease anchor
    const ease = Math.min(1, ANCHOR_EASE * dtSec);
    _anchorX += (ppos.x - _anchorX) * ease;
    _anchorY += (ppos.y - _anchorY) * ease;

    // Death vigil — wisp gently descends onto the player's tile and holds
    if (_deathVigil) {
      _deathLandT = Math.min(1, _deathLandT + dtSec / DEATH_LAND_DURATION);
      // Smooth ease-out (decelerate into landing)
      const t = 1 - (1 - _deathLandT) * (1 - _deathLandT);
      _x = _x + (_anchorX - _x) * t;
      _y = _y + (_anchorY - _y) * t;
      // Gentle fade of trail particles
      if (_deathLandT < 1) _spawnTrail(dtSec * (1 - _deathLandT));
      return;
    }

    _agitation = Math.max(0, _agitation - dtSec);
    _updateMood(dtSec);

    // Danger scan (throttled)
    _dangerScanTimer -= dtSec;
    if (_dangerScanTimer <= 0) {
      _dangerScanTimer = DANGER_SCAN_INTERVAL;
      _scanDangers(ppos.x | 0, ppos.y | 0);
    }

    // Miracle flight overrides orbit
    if (_tickFlight(dtSec)) {
      _spawnTrail(dtSec);
      return;
    }

    // Decay prayer spiral
    _prayerTimer = Math.max(0, _prayerTimer - dtSec);

    // Advance orbit (speed up during prayer spiral)
    const prayerT = _prayerTimer / PRAYER_SPIRAL_DURATION; // 1→0 over duration
    _phase += _orbitSpeed() * dtSec * (1 + prayerT * 3); // spin faster during spiral

    // Compute position — prayer shrinks orbit to zero (spiral inward)
    const orbitR = _orbitRadius() * (1 - prayerT * 0.9);
    const bob = Math.sin(_fxTime * BOB_FREQ * Math.PI * 2) * BOB_AMP * (1 - prayerT);
    _x = _anchorX + Math.cos(_phase) * orbitR;
    _y = _anchorY + Math.sin(_phase) * orbitR * 0.6 + bob;

    // Chaos jitter
    if (_chaos > 0.05) {
      const j = _chaos * CHAOS_JITTER_AMP;
      _x += Math.sin(_fxTime * 17.3 + _phase * 3) * j;
      _y += Math.cos(_fxTime * 13.7 + _phase * 2) * j;
    }

    // Danger pull — wisp drifts toward hidden threat
    if (_dangerIntensity > 0) {
      const pull = _dangerIntensity * DANGER_PULL_STRENGTH;
      _x += _dangerDx * pull;
      _y += _dangerDy * pull;
    }

    _spawnTrail(dtSec);
  }

  function _spawnTrail(dtSec) {
    if (!fx?.pool) return;
    const pr = _r | 0, pg = _g | 0, pb = _b | 0;
    const alpha = _betrayed ? BETRAYAL_DIM : 0.6;
    // More particles during miracle flight
    const rate = _flightState !== FLIGHT_IDLE ? TRAIL_RATE * 3 : TRAIL_RATE;
    _trailAccum += dtSec * rate;
    while (_trailAccum >= 1) {
      _trailAccum -= 1;
      fx.pool.spawn(new Particle({
        x: _x + (Math.random() - 0.5) * 0.06,
        y: _y + (Math.random() - 0.5) * 0.06,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.2 - Math.random() * 0.3,
        life: TRAIL_LIFE + Math.random() * 0.15,
        size0: 0.06 + Math.random() * 0.03,
        size1: 0.01,
        r: pr, g: pg, b: pb,
        a0: alpha,
      }));
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────

  function draw(bctx) {
    if (!_active) return;

    const r = _r | 0, g = _g | 0, b = _b | 0;
    const cr = Math.min(255, r * 0.5 + 128) | 0;
    const cg = Math.min(255, g * 0.5 + 128) | 0;
    const cb = Math.min(255, b * 0.5 + 128) | 0;
    const dim = _betrayed ? BETRAYAL_DIM : 1;

    bctx.save();

    // Miracle flare burst
    if (_flightState === FLIGHT_FLARE) {
      const flareT = Math.min(1, _flightTimer / MIRACLE_FLARE_TIME);
      const flareR = 0.5 + flareT * 0.8;
      const flareA = (1 - flareT) * 0.6;
      const fg = bctx.createRadialGradient(_x, _y, 0, _x, _y, flareR);
      fg.addColorStop(0, `rgba(255,255,240,${flareA.toFixed(3)})`);
      fg.addColorStop(0.3, `rgba(${cr},${cg},${cb},${(flareA * 0.6).toFixed(3)})`);
      fg.addColorStop(1, `rgba(${r},${g},${b},0)`);
      bctx.fillStyle = fg;
      bctx.beginPath();
      bctx.arc(_x, _y, flareR, 0, Math.PI * 2);
      bctx.fill();
    }

    // Outer halo
    const glowR = 0.22 + Math.sin(_fxTime * 3.2) * 0.04;
    const gradient = bctx.createRadialGradient(_x, _y, 0, _x, _y, glowR);
    gradient.addColorStop(0, `rgba(${r},${g},${b},${(0.7 * dim).toFixed(3)})`);
    gradient.addColorStop(0.4, `rgba(${r},${g},${b},${(0.3 * dim).toFixed(3)})`);
    gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
    bctx.fillStyle = gradient;
    bctx.beginPath();
    bctx.arc(_x, _y, glowR, 0, Math.PI * 2);
    bctx.fill();

    // Bright core
    const coreR = 0.06 + Math.sin(_fxTime * 5.1) * 0.015;
    bctx.fillStyle = `rgba(${cr},${cg},${cb},${(0.9 * dim).toFixed(3)})`;
    bctx.beginPath();
    bctx.arc(_x, _y, coreR, 0, Math.PI * 2);
    bctx.fill();

    // Danger sense pulse — faint ring when sensing hidden threats
    if (_dangerIntensity > 0.1 && _flightState === FLIGHT_IDLE) {
      const pulseR = 0.15 + Math.sin(_fxTime * 6) * 0.05;
      const pulseA = _dangerIntensity * 0.4;
      bctx.strokeStyle = `rgba(255,180,60,${pulseA.toFixed(3)})`;
      bctx.lineWidth = 0.02;
      bctx.beginPath();
      bctx.arc(_x, _y, pulseR, 0, Math.PI * 2);
      bctx.stroke();
    }

    bctx.restore();
  }

  // ── Lighting ──────────────────────────────────────────────────────

  function getActiveLights() {
    if (!_active) return [];
    const dim = _betrayed ? BETRAYAL_DIM : 1;
    const pulse = Math.sin(_fxTime * LIGHT_PULSE_FREQ * Math.PI * 2) * LIGHT_PULSE_AMP;
    // Miracle flare emits extra light
    const flareBonus = _flightState === FLIGHT_FLARE ? 3 : 0;
    return [{
      x: _x,
      y: _y,
      radius: (LIGHT_RADIUS + pulse + flareBonus) * dim,
      color: [_r | 0, _g | 0, _b | 0],
      softness: 16,
    }];
  }

  function setDepth(depth) { _lastDepth = depth | 0; }

  /** Expose wisp world position for prayer proximity check. */
  function getWispPos() {
    if (!_active) return null;
    return { x: _x, y: _y };
  }

  // ── Event wiring ──────────────────────────────────────────────────

  function installListeners() {
    // Combat agitation
    world.on('damaged', () => { _agitation = COMBAT_DECAY; });
    world.on('ranged:shot', () => { _agitation = COMBAT_DECAY; });
    world.on('castSpell', () => { _agitation = COMBAT_DECAY; });

    // Prayer — wisp spirals inward then eases back out
    world.on('prayer', () => { _prayerTimer = PRAYER_SPIRAL_DURATION; });

    // Player death — wisp settles onto the player's tile
    world.on('died', ({ id }) => {
      const pe = getPlayerEntity();
      if (pe && id === pe.id) { _deathVigil = true; _deathLandT = 0; }
    });

    // Deity wrath — extra agitation
    world.on('deity:wrath', () => { _agitation = COMBAT_DECAY * 2; });

    // Miracle / intervention — wisp flies to deliver it
    world.on('deity:intervention', (payload) => {
      const { playerId, kind } = payload || {};
      if (!playerId) return;
      const pos = getPosition(playerId);
      if (pos) _startMiracleFlight(pos.x, pos.y);
    });

    // Boon delivery — wisp flies to player
    world.on('deity:boon', (payload) => {
      const { actor } = payload || {};
      if (!actor) return;
      const pos = getPosition(actor);
      if (pos) _startMiracleFlight(pos.x, pos.y);
    });
  }

  return { tick, draw, getActiveLights, installListeners, setDepth, getWispPos };
}
