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
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Trap } from "../../rules/components/Trap.js";

const INSTALLED_KEY = Symbol.for("jshack:display:spiritWisp:installed");

// ── Orbit geometry ──────────────────────────────────────────────────
const BASE_ORBIT_RADIUS = 1.2;
const BASE_ORBIT_SPEED = 1.4; // rad/s
const COMBAT_ORBIT_SPEED = 4.0;
const BOB_AMP = 0.12;
const BOB_FREQ = 2.2;

// ── Mood → orbit modifiers ─────────────────────────────────────────
const WRATH_RADIUS_SHRINK = 0.5; // orbit tightens with wrath
const SERENITY_RADIUS_GROW = 0.4; // orbit widens with serenity
const CHAOS_JITTER_AMP = 0.25; // positional jitter from chaos
const SORROW_SPEED_DRAG = 0.6; // orbit slows with sorrow
const AMUSEMENT_SPEED_BOOST = 1.2; // orbit quickens with amusement

// ── Anchor / easing ────────────────────────────────────────────────
const ANCHOR_EASE = 5.0;

// ── Particles ──────────────────────────────────────────────────────
const TRAIL_RATE = 18;
const TRAIL_LIFE = 0.35;

// ── Light ──────────────────────────────────────────────────────────
const LIGHT_RADIUS = 3.0;
const LIGHT_PULSE_AMP = 0.4;
const LIGHT_PULSE_FREQ = 1.8;
const LIGHT_COLOR = [140, 210, 255]; // cool cyan-white — the ball of light itself

// ── Combat agitation ───────────────────────────────────────────────
const COMBAT_DECAY = 2.0;

// ── Ribbon trail (drawn, not particles) ────────────────────────────
const RIBBON_MAX_POINTS = 14;
const RIBBON_MIN_STEP = 0.05;

// ── Color ──────────────────────────────────────────────────────────
const COLOR_EASE_SPEED = 1.5;
const MOOD_RGB = {
  wrath: [200, 30, 10],
  serenity: [180, 220, 255],
  hunger: [160, 120, 40],
  amusement: [255, 230, 100],
  sorrow: [60, 50, 120],
  chaos: [200, 180, 255],
};
const MOOD_KEYS = Object.keys(MOOD_RGB);
const NEUTRAL_COLOR = [140, 210, 255];

// ── Danger sense ───────────────────────────────────────────────────
const DANGER_SENSE_RADIUS = 4;          // tiles at peak attitude standing
const DANGER_PULL_STRENGTH = 0.35;      // how far wisp drifts toward danger (tiles)
const DANGER_SCAN_INTERVAL = 0.5;       // seconds between scans (perf)
const DANGER_SENSE_PEAK_STANDING = 1.2; // standing at which full radius applies

// ── Miracle flight ─────────────────────────────────────────────────
const MIRACLE_FLY_SPEED = 12; // tiles/sec
const MIRACLE_FLARE_TIME = 0.4; // seconds at target before returning
const MIRACLE_RETURN_SPEED = 8;

// ── Betrayal ───────────────────────────────────────────────────────
const BETRAYAL_STANDING_THRESHOLD = -0.3; // below this → betrayal mode
const BETRAYAL_ORBIT_OFFSET = 2.5; // drift further from player
const BETRAYAL_DIM = 0.35; // alpha multiplier

// ── Orbiting motes ─────────────────────────────────────────────────
const MOTE_BASE_COUNT = 2;
const MOTE_MAX_COUNT = 4;
const MOTE_RADIUS = 0.16;
const FORTUNE_MOTE_BOOST = 2;
const ALTAR_ATTUNE_DURATION = 2.6;
const MALEVOLENCE_COLOR = [255, 90, 70];
const SACRED_ACK_SCAN_INTERVAL = 0.9;
const SACRED_ACK_RADIUS = 4;
const VANQUISH_CIRCLE_DURATION = 2.4;
const VANQUISH_ORBIT_RADIUS = 0.84;
const PET_REBIRTH_CIRCLE_DURATION = 3.4;
const PET_REBIRTH_ORBIT_RADIUS = 0.96;
const ITEM_FETCH_COOLDOWN = 1.15;
const ITEM_FETCH_RADIUS = 7;
const SACRED_IDENTITIES = new Set(["altar", "shrine", "church_altar"]);

// ── Essence harvest (passive soul-pull aura) ─────────────────────
const HARVEST_DOWNTIME_THRESHOLD = 0.15; // agitation must be below this
const HARVEST_LINGER_DELAY = 1.8; // seconds of calm before pull activates
const HARVEST_ABSORB_COLOR = [200, 240, 255]; // absorption burst color

// ── Guidance pulse (tutorial mode) ────────────────────────────────
const GUIDANCE_PULSE_DURATION = 2.0;
const GUIDANCE_COLOR = [160, 230, 255]; // soft cyan
const GUIDANCE_FLY_SPEED = 10;

/**
 * @param {{
 *   world: import('../../lib/ecs-js/index.js').World,
 *   fx: { pool: { spawn(o:object):void } },
 *   getPosition: (id:number) => ({x:number,y:number}|null),
 *   getPlayerEntity: () => ({id:number, pos:{x:number,y:number}}|null),
 *   sampleMood: () => ({wrath:number,serenity:number,hunger:number,amusement:number,sorrow:number,chaos:number}|null),
 *   deathEssenceFx?: { peekOrbs():Array, consumeOrbAt(i:number):object|null },
 * }} deps
 */
export function createSpiritWispFxController(
  { world, fx, getPosition, getPlayerEntity, sampleMood, deathEssenceFx },
) {
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
  /** @type {Array<{x:number,y:number}>} */
  const _ribbonPoints = [];

  // Depth
  let _lastDepth = -1;

  // Smoothed color
  let _r = NEUTRAL_COLOR[0], _g = NEUTRAL_COLOR[1], _b = NEUTRAL_COLOR[2];

  // Cached mood values (updated each frame from sampler)
  let _wrath = 0, _serenity = 0, _chaos = 0, _sorrow = 0, _amusement = 0;

  // Danger sense state
  let _dangerDx = 0, _dangerDy = 0; // normalized pull direction
  let _dangerIntensity = 0; // 0 = no danger, 1 = max
  let _dangerScanTimer = 0;
  let _dangerSnapTimer = 0;
  let _trapHintTimer = 0;
  let _trapHintX = 0, _trapHintY = 0;

  // Miracle flight state
  const FLIGHT_IDLE = 0, FLIGHT_TO = 1, FLIGHT_FLARE = 2, FLIGHT_BACK = 3;
  let _flightState = FLIGHT_IDLE;
  let _flightTargetX = 0, _flightTargetY = 0;
  let _flightTimer = 0;
  let _flightSavedX = 0, _flightSavedY = 0; // where wisp was before flying
  let _flareBurstQueued = false;

  // Spell surge — wisp follows a projectile path with a slight orbit offset
  let _surgeActive = false;
  let _surgeFromX = 0, _surgeFromY = 0;
  let _surgeToX = 0, _surgeToY = 0;
  let _surgeDuration = 0;
  let _surgeElapsed = 0;
  const SURGE_ORBIT_OFFSET = 0.35; // tiles offset perpendicular to projectile path
  const SURGE_ORBIT_FREQ = 12;     // fast helical spin around projectile
  const SURGE_FLARE_TIME = 0.3;    // flare at impact before returning

  // Prayer spiral — wisp spirals inward, absorbs, then expands back
  let _prayerTimer = 0;
  const PRAYER_SPIRAL_DURATION = 1.2;

  // Death vigil — wisp descends onto player tile, holds still
  let _deathVigil = false;
  let _deathLandT = 0; // 0→1 eases wisp to player tile
  const DEATH_LAND_DURATION = 6.2; // seconds to settle onto player
  const DEATH_CIRCLE_DURATION = 2.2;
  const DEATH_CIRCLE_RADIUS = 0.95;
  let _deathTargetX = 0, _deathTargetY = 0;
  let _deathStartX = 0, _deathStartY = 0;
  let _deathHasStart = false;
  let _deathCircleTimer = 0;
  let _deathCirclePhase = 0;

  // Betrayal
  let _standing = 0;
  let _betrayed = false;

  // Boon / miracle visual states
  let _aegisTimer = 0;
  let _cleanseTimer = 0;
  let _fortuneTimer = 0;
  let _omenTimer = 0;
  let _ceremonyTimer = 0;
  let _targetCueX = 0, _targetCueY = 0, _targetCueTimer = 0;
  let _altarBeaconTimer = 0;
  let _altarBeaconX = 0, _altarBeaconY = 0;
  let _altarRejectTimer = 0;
  let _malevolenceTimer = 0;
  let _malevolenceX = 0, _malevolenceY = 0;
  let _vanquishTimer = 0;
  let _vanquishX = 0, _vanquishY = 0;
  let _petRebirthTimer = 0;
  let _petRebirthX = 0, _petRebirthY = 0;
  let _sacredScanTimer = 0;
  let _itemFetchCooldownTimer = 0;
  let _itemFetchReturnBurst = false;

  // Guide mode — allows wisp on overworld (depth 0) for tutorials.
  let _guideMode = false;
  let _guidancePulseTimer = 0;

  // Essence harvest — passive gravity well that pulls essences to wisp.
  let _harvestDowntimeAccum = 0; // how long we've been calm
  let _harvestAbsorbBurstTimer = 0; // VFX burst after absorption
  let _harvestBurstR = 0, _harvestBurstG = 0, _harvestBurstB = 0;
  let _harvestFlareTimer = 0; // wisp reaction glow on absorb (0→decays)
  const HARVEST_FLARE_DURATION = 0.55; // seconds of wisp glow reaction

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
    if (typeof sampleMood === "function") {
      const mood = sampleMood();
      if (mood) {
        _wrath = Number(mood.wrath || 0);
        _serenity = Number(mood.serenity || 0);
        _chaos = Number(mood.chaos || 0);
        _sorrow = Number(mood.sorrow || 0);
        _amusement = Number(mood.amusement || 0);

        // Blend color proportionally
        tr = 0;
        tg = 0;
        tb = 0;
        for (let i = 0; i < MOOD_KEYS.length; i++) {
          const k = MOOD_KEYS[i];
          const w = Number(mood[k] || 0);
          const c = MOOD_RGB[k];
          tr += c[0] * w;
          tg += c[1] * w;
          tb += c[2] * w;
        }

        // Compute standing for betrayal check
        _standing = (_serenity * 1.7) - (_wrath * 2.2) -
          (Number(mood.hunger || 0) * 0.25) - (_sorrow * 0.1);
        _betrayed = _standing < BETRAYAL_STANDING_THRESHOLD;
      }
    }
    const t = Math.min(1, COLOR_EASE_SPEED * dtSec);
    _r += (tr - _r) * t;
    _g += (tg - _g) * t;
    _b += (tb - _b) * t;
  }

  function _scanDangers(px, py) {
    // Trap awareness scales entirely with attitude: 0 at betrayal threshold, 1 at peak.
    const attitudeFactor = Math.max(0, Math.min(1,
      (_standing - BETRAYAL_STANDING_THRESHOLD) /
      (DANGER_SENSE_PEAK_STANDING - BETRAYAL_STANDING_THRESHOLD),
    ));
    if (attitudeFactor <= 0) {
      _dangerIntensity = 0;
      return;
    }

    const effectiveRadius = DANGER_SENSE_RADIUS * attitudeFactor;
    let closestDist = Infinity;
    let dx = 0, dy = 0;
    let found = false;

    for (const [id, pos, trap] of world.query(Position, Trap)) {
      if (trap.revealed || !trap.armed) continue;
      const dist = Math.max(Math.abs(pos.x - px), Math.abs(pos.y - py));
      if (dist > effectiveRadius || dist < 1) continue;
      if (dist < closestDist) {
        closestDist = dist;
        dx = pos.x - px;
        dy = pos.y - py;
        found = true;
      }
    }

    if (found) {
      const len = Math.hypot(dx, dy) || 1;
      const prevDx = _dangerDx;
      const prevDy = _dangerDy;
      _dangerDx = dx / len;
      _dangerDy = dy / len;
      _dangerIntensity = Math.min(
        1,
        attitudeFactor * (1 - (closestDist - 1) / effectiveRadius),
      );
      _trapHintX = px + dx;
      _trapHintY = py + dy;
      _trapHintTimer = Math.max(_trapHintTimer, 0.35 + _dangerIntensity * 0.45);
      // Snap emphasis when direction changes so the pointer reads stronger.
      const dot = (prevDx * _dangerDx) + (prevDy * _dangerDy);
      if (dot < 0.9) _dangerSnapTimer = 0.22;
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
        _x = _flightTargetX;
        _y = _flightTargetY;
        _flightState = FLIGHT_FLARE;
        _flightTimer = 0;
        _flareBurstQueued = true;
      } else {
        const step = Math.min(dist, MIRACLE_FLY_SPEED * dtSec);
        _x += (dx / dist) * step;
        _y += (dy / dist) * step;
      }
      return true;
    }

    if (_flightState === FLIGHT_FLARE) {
      _x = _flightTargetX;
      _y = _flightTargetY;
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

  /**
   * Start a spell surge — wisp follows alongside a projectile path.
   * Takes priority over miracle flight (cancels it).
   */
  function _startSpellSurge(fromX, fromY, toX, toY, duration) {
    // Cancel any in-progress miracle flight
    _flightState = FLIGHT_IDLE;
    _surgeActive = true;
    _surgeFromX = fromX;
    _surgeFromY = fromY;
    _surgeToX = toX;
    _surgeToY = toY;
    _surgeDuration = Math.max(0.1, duration);
    _surgeElapsed = 0;
    // Snap wisp to start so it appears alongside projectile immediately
    _x = fromX;
    _y = fromY;
  }

  function _tickSpellSurge(dtSec) {
    if (!_surgeActive) return false;
    _surgeElapsed += dtSec;
    const progress = Math.min(1, _surgeElapsed / _surgeDuration);

    if (progress < 1) {
      // Lerp along projectile path with a helical offset
      const baseX = _surgeFromX + (_surgeToX - _surgeFromX) * progress;
      const baseY = _surgeFromY + (_surgeToY - _surgeFromY) * progress;
      // Perpendicular offset: rotate 90° from travel direction
      const tdx = _surgeToX - _surgeFromX;
      const tdy = _surgeToY - _surgeFromY;
      const tLen = Math.hypot(tdx, tdy) || 1;
      const perpX = -tdy / tLen;
      const perpY = tdx / tLen;
      const angle = _surgeElapsed * SURGE_ORBIT_FREQ;
      const offset = Math.sin(angle) * SURGE_ORBIT_OFFSET;
      const bobOffset = Math.cos(angle) * SURGE_ORBIT_OFFSET * 0.5;
      _x = baseX + perpX * offset;
      _y = baseY + perpY * offset + bobOffset * 0.3;
      return true;
    }

    // Arrived at target — brief flare then hand off to miracle return
    _surgeActive = false;
    _x = _surgeToX;
    _y = _surgeToY;
    _flightTargetX = _surgeToX;
    _flightTargetY = _surgeToY;
    _flightState = FLIGHT_FLARE;
    _flightTimer = 0;
    _flareBurstQueued = true;
    _agitation = COMBAT_DECAY * 2.5;
    return true;
  }

  function _pushRibbonPoint() {
    const n = _ribbonPoints.length;
    if (n > 0) {
      const last = _ribbonPoints[n - 1];
      const dx = _x - last.x;
      const dy = _y - last.y;
      if ((dx * dx + dy * dy) < (RIBBON_MIN_STEP * RIBBON_MIN_STEP)) return;
    }
    _ribbonPoints.push({ x: _x, y: _y });
    if (_ribbonPoints.length > RIBBON_MAX_POINTS) _ribbonPoints.shift();
  }

  function _spawnFlareBurst() {
    if (!fx?.pool) return;
    const pr = _r | 0, pg = _g | 0, pb = _b | 0;
    const rays = 14;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const sp = 1.8 + Math.random() * 1.4;
      fx.pool.spawn(
        new Particle({
          x: _x,
          y: _y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 0.2,
          life: 0.26 + Math.random() * 0.18,
          size0: 0.07 + Math.random() * 0.04,
          size1: 0.01,
          r: pr,
          g: pg,
          b: pb,
          a0: _betrayed ? 0.22 : 0.6,
        }),
      );
    }
  }

  function _spawnRingBurst(
    x,
    y,
    color,
    count = 16,
    speedMin = 0.9,
    speedMax = 1.8,
    lifeMin = 0.25,
    lifeJitter = 0.2,
    alpha = 0.7,
  ) {
    if (!fx?.pool) return;
    const cr = color[0] | 0, cg = color[1] | 0, cb = color[2] | 0;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const sp = speedMin + Math.random() * Math.max(0.01, speedMax - speedMin);
      fx.pool.spawn(
        new Particle({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 0.08,
          life: lifeMin + Math.random() * lifeJitter,
          size0: 0.05 + Math.random() * 0.03,
          size1: 0.01,
          r: cr,
          g: cg,
          b: cb,
          a0: alpha,
        }),
      );
    }
  }

  function _triggerCleanseAt(x, y, intensity = 1) {
    _cleanseTimer = Math.max(_cleanseTimer, 1.2 + intensity * 0.4);
    _spawnRingBurst(
      x,
      y,
      [150, 235, 255],
      14 + ((intensity * 6) | 0),
      0.8,
      1.9,
      0.28,
      0.18,
      0.65,
    );
  }

  function _triggerAegisAt(x, y, intensity = 1) {
    _aegisTimer = Math.max(_aegisTimer, 2.2 + intensity * 0.8);
    _spawnRingBurst(
      x,
      y,
      [255, 230, 135],
      12 + ((intensity * 8) | 0),
      0.7,
      1.2,
      0.24,
      0.2,
      0.55,
    );
  }

  function _triggerFortuneAt(x, y, intensity = 1) {
    _fortuneTimer = Math.max(_fortuneTimer, 2.4 + intensity * 1.2);
    _spawnRingBurst(
      x,
      y,
      [255, 220, 110],
      10 + ((intensity * 8) | 0),
      0.5,
      1.0,
      0.35,
      0.25,
      0.58,
    );
  }

  function _triggerCeremonyAt(x, y, intensity = 1) {
    _ceremonyTimer = Math.max(_ceremonyTimer, 1.7 + intensity * 0.7);
    _spawnRingBurst(
      x,
      y,
      [225, 205, 255],
      18 + ((intensity * 8) | 0),
      1.1,
      2.5,
      0.32,
      0.25,
      0.62,
    );
  }

  function _triggerPetRebirthAt(x, y, intensity = 1) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const t = Math.max(0.8, Number(intensity || 1));
    _petRebirthX = Number(x);
    _petRebirthY = Number(y);
    _petRebirthTimer = Math.max(
      _petRebirthTimer,
      PET_REBIRTH_CIRCLE_DURATION + Math.min(1.8, t * 0.5),
    );
    _setTargetCue(_petRebirthX, _petRebirthY, 1.8);
    _attuneSacredPos(_petRebirthX, _petRebirthY, 2.8);
    _spawnRingBurst(
      _petRebirthX,
      _petRebirthY,
      [215, 245, 255],
      20 + ((t * 10) | 0),
      1.1,
      2.8,
      0.32,
      0.28,
      0.74,
    );
    _spawnRingBurst(
      _petRebirthX,
      _petRebirthY,
      [255, 232, 165],
      14 + ((t * 8) | 0),
      0.9,
      2.2,
      0.28,
      0.26,
      0.66,
    );
    _triggerCeremonyAt(_petRebirthX, _petRebirthY, 1.1 + t * 0.5);
    _startMiracleFlight(_petRebirthX, _petRebirthY);
  }

  function _setTargetCue(x, y, ttl = 1.4) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    _targetCueX = x;
    _targetCueY = y;
    _targetCueTimer = Math.max(_targetCueTimer, Math.max(0.2, ttl));
  }

  function _attuneSacredPos(x, y, ttl = ALTAR_ATTUNE_DURATION) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    _altarBeaconX = Number(x);
    _altarBeaconY = Number(y);
    _altarBeaconTimer = Math.max(_altarBeaconTimer, Math.max(0.35, ttl));
    _setTargetCue(_altarBeaconX, _altarBeaconY, Math.min(1.8, ttl));
    return { x: _altarBeaconX, y: _altarBeaconY };
  }

  function _attuneSacredSite(
    targetId,
    fallbackActorId = 0,
    ttl = ALTAR_ATTUNE_DURATION,
  ) {
    const tid = Number(targetId || 0) | 0;
    let pos = tid > 0 ? getPosition(tid) : null;
    if (!pos) {
      const aid = Number(fallbackActorId || 0) | 0;
      pos = aid > 0 ? getPosition(aid) : null;
    }
    if (!pos) return null;
    return _attuneSacredPos(pos.x, pos.y, ttl);
  }

  function _triggerMalevolenceAt(x, y, intensity = 1) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const t = Math.max(0.6, Number(intensity || 1));
    _malevolenceX = x;
    _malevolenceY = y;
    _malevolenceTimer = Math.max(
      _malevolenceTimer,
      1.3 + Math.min(2.5, t) * 0.9,
    );
    _agitation = Math.max(
      _agitation,
      COMBAT_DECAY * (1.1 + Math.min(1.2, t * 0.35)),
    );
    _spawnRingBurst(
      x,
      y,
      MALEVOLENCE_COLOR,
      14 + ((t * 8) | 0),
      0.9,
      2.2,
      0.24,
      0.24,
      0.62,
    );
  }

  function _scanNearbySacredSite(px, py) {
    if (_betrayed) return;
    let best = null;
    let bestDist = Infinity;
    for (const [, pos, ident] of world.query(Position, NamedIdentity)) {
      const key = String(ident?.identity || "").toLowerCase();
      if (!SACRED_IDENTITIES.has(key)) continue;
      const dist = Math.max(
        Math.abs((pos.x | 0) - px),
        Math.abs((pos.y | 0) - py),
      );
      if (dist < 1 || dist > SACRED_ACK_RADIUS) continue;
      if (dist < bestDist) {
        bestDist = dist;
        best = pos;
      }
    }
    if (!best) return;
    _attuneSacredPos(best.x, best.y, 0.95);
    _omenTimer = Math.max(_omenTimer, 0.25);
  }

  function _queueItemFetch(x, y, cueTtl = 1.5) {
    if (_deathVigil || _betrayed) return false;
    if (_itemFetchCooldownTimer > 0) return false;
    if (_flightState !== FLIGHT_IDLE) return false;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    _setTargetCue(x, y, cueTtl);
    _startMiracleFlight(x, y);
    _itemFetchCooldownTimer = ITEM_FETCH_COOLDOWN;
    _itemFetchReturnBurst = true;
    return true;
  }

  // ── Essence harvest helpers (gravity well — pull essences to wisp) ─

  function _isHarvestDowntime() {
    if (_betrayed) return false;
    if (_deathVigil) return false;
    if (_flightState !== FLIGHT_IDLE) return false;
    if (_prayerTimer > 0) return false;
    if (_vanquishTimer > 0) return false;
    if (_petRebirthTimer > 0) return false;
    if (_agitation > HARVEST_DOWNTIME_THRESHOLD) return false;
    return true;
  }

  /**
   * Tick all in-flight essences — once an orb is pulling it always finishes.
   * Called every frame regardless of downtime state.
   */
  function _tickActiveEssencePulls(dtSec) {
    if (!deathEssenceFx) return;
    const orbs = deathEssenceFx.peekOrbs();
    if (!orbs || orbs.length === 0) return;

    // Absorb any that arrived — iterate backwards so splice indices stay valid
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      if (!o.pulling) continue;
      const dx = _x - o.x;
      const dy = _y - o.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.2) {
        // Absorbed — wisp reacts!
        _harvestBurstR = o.r;
        _harvestBurstG = o.g;
        _harvestBurstB = o.b;
        _harvestAbsorbBurstTimer = 0.6;
        _harvestFlareTimer = HARVEST_FLARE_DURATION;
        // Brief color bleed: wisp color shifts toward essence color momentarily
        _r = _r * 0.6 + o.r * 0.4;
        _g = _g * 0.6 + o.g * 0.4;
        _b = _b * 0.6 + o.b * 0.4;
        // Inward implosion particles (essence color sucked into wisp core)
        if (fx?.pool) {
          for (let j = 0; j < 10; j++) {
            const a = (j / 10) * Math.PI * 2 + Math.random() * 0.3;
            const spawnR = 0.18 + Math.random() * 0.12;
            fx.pool.spawn(
              new Particle({
                x: _x + Math.cos(a) * spawnR,
                y: _y + Math.sin(a) * spawnR,
                vx: -Math.cos(a) * (1.2 + Math.random() * 0.8),
                vy: -Math.sin(a) * (1.2 + Math.random() * 0.8),
                life: 0.18 + Math.random() * 0.12,
                size0: 0.04 + Math.random() * 0.025,
                size1: 0.005,
                r: o.r,
                g: o.g,
                b: o.b,
                a0: 0.7,
              }),
            );
          }
        }
        // Tiny outward exhale (wisp color — the "satisfied pulse")
        _spawnRingBurst(
          _x, _y,
          [_r | 0, _g | 0, _b | 0],
          6, 0.3, 0.7, 0.18, 0.12, 0.4,
        );
        // Arcade score feedback — float text at wisp + stat bar update
        {
          const depth = Math.max(1, _lastDepth);
          const pts = Math.max(1, (o.maxHp || 1) * depth);
          world.emit('wisp:harvest', {
            x: _x, y: _y,
            wispX: _x, wispY: _y,
            points: pts,
          });
        }
        deathEssenceFx.consumeOrbAt(i);
        continue;
      }
      // Pull toward wisp — accelerates as it gets closer (gravity)
      const pullStrength = o.pullStrength || 0;
      o.pullStrength = Math.min(4.0, pullStrength + dtSec * 0.6);
      const speed = 0.3 + o.pullStrength * (1.0 + 1.5 / Math.max(0.5, dist));
      const step = Math.min(dist, speed * dtSec);
      const mx = (dx / dist) * step;
      const my = (dy / dist) * step;
      // Move the underlying coords so deathEssence draw() picks them up
      o.fromX += mx;
      o.fromY += my;
      o.toX += mx;
      o.toY += my;
      o.x += mx;
      o.y += my;
      // Shrink orb as it approaches
      const shrink = Math.min(1, dist / 2.0);
      o.radius = (o.baseRadius || o.radius) * (0.3 + 0.7 * shrink);
      o.glowRadius = (o.baseGlowRadius || o.glowRadius) * (0.2 + 0.8 * shrink);
    }
  }

  /**
   * Recruit new essences into the gravity well.
   * Only called during downtime — but once recruited, they always finish.
   */
  function _recruitNewEssences() {
    if (!deathEssenceFx) return;
    const orbs = deathEssenceFx.peekOrbs();
    if (!orbs || orbs.length === 0) return;
    if (_harvestDowntimeAccum < HARVEST_LINGER_DELAY) return;

    for (let i = 0; i < orbs.length; i++) {
      const o = orbs[i];
      if (o.pulling) continue;
      const dx = _x - o.x;
      const dy = _y - o.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 7 || dist < 0.2) continue;
      o.pulling = true;
      o.pullStrength = 0;
      o.baseRadius = o.radius;
      o.baseGlowRadius = o.glowRadius;
    }
  }

  // ── Main tick ─────────────────────────────────────────────────────

  function tick(dtSec) {
    if (dtSec <= 0) return;
    _fxTime += dtSec;

    const pe = getPlayerEntity();
    const ppos = pe ? getPosition(pe.id) : null;
    if (!ppos && !_deathVigil) {
      _active = false;
      return;
    }

    if (_lastDepth === 0 && !_guideMode) {
      _active = false;
      return;
    }

    if (!_active || !_anchored) {
      _anchorX = Number(ppos?.x ?? _deathTargetX);
      _anchorY = Number(ppos?.y ?? _deathTargetY);
      _anchored = true;
      _active = true;
      if (_deathVigil && _deathHasStart) {
        _x = _deathStartX;
        _y = _deathStartY;
      } else {
        _x = _anchorX;
        _y = _anchorY;
      }
      _ribbonPoints.length = 0;
      _pushRibbonPoint();
    }

    // Ease anchor
    if (ppos) {
      const ease = Math.min(1, ANCHOR_EASE * dtSec);
      _anchorX += (ppos.x - _anchorX) * ease;
      _anchorY += (ppos.y - _anchorY) * ease;
      if (!_deathVigil) {
        _deathTargetX = ppos.x;
        _deathTargetY = ppos.y;
      }
    } else if (_deathVigil) {
      _anchorX = _deathTargetX;
      _anchorY = _deathTargetY;
    }

    // Death vigil — wisp gently descends onto the player's tile and holds
    if (_deathVigil) {
      if (_deathCircleTimer > 0) {
        _deathCircleTimer = Math.max(0, _deathCircleTimer - dtSec);
        const circleT = 1 - (_deathCircleTimer / DEATH_CIRCLE_DURATION); // 0→1
        const angle = _deathCirclePhase + circleT * Math.PI * 4.2;
        const radius = DEATH_CIRCLE_RADIUS * (1 - circleT * 0.45);
        const targetX = _deathTargetX + Math.cos(angle) * radius;
        const targetY = _deathTargetY + Math.sin(angle) * radius * 0.65;
        const pull = 0.18 + circleT * 0.34;
        _x += (targetX - _x) * pull;
        _y += (targetY - _y) * pull;
        _pushRibbonPoint();
        _spawnTrail(dtSec * 0.55);
        return;
      }
      _deathLandT = Math.min(1, _deathLandT + dtSec / DEATH_LAND_DURATION);
      // Smooth ease-out (decelerate into landing)
      const t = 1 - (1 - _deathLandT) * (1 - _deathLandT);
      const sway = (1 - _deathLandT) * 0.07;
      const targetX = _deathTargetX + Math.sin(_fxTime * 0.8) * sway;
      const targetY = _deathTargetY + Math.cos(_fxTime * 0.6) * sway * 0.6;
      _x = _x + (targetX - _x) * t;
      _y = _y + (targetY - _y) * t;
      // Gentle fade of trail particles
      _pushRibbonPoint();
      if (_deathLandT < 1) _spawnTrail(dtSec * (1 - _deathLandT) * 0.85);
      return;
    }

    _agitation = Math.max(0, _agitation - dtSec);
    _dangerSnapTimer = Math.max(0, _dangerSnapTimer - dtSec);
    _updateMood(dtSec);
    _aegisTimer = Math.max(0, _aegisTimer - dtSec);
    _cleanseTimer = Math.max(0, _cleanseTimer - dtSec);
    _fortuneTimer = Math.max(0, _fortuneTimer - dtSec);
    _omenTimer = Math.max(0, _omenTimer - dtSec);
    _ceremonyTimer = Math.max(0, _ceremonyTimer - dtSec);
    _targetCueTimer = Math.max(0, _targetCueTimer - dtSec);
    _trapHintTimer = Math.max(0, _trapHintTimer - dtSec);
    _altarBeaconTimer = Math.max(0, _altarBeaconTimer - dtSec);
    _altarRejectTimer = Math.max(0, _altarRejectTimer - dtSec);
    _malevolenceTimer = Math.max(0, _malevolenceTimer - dtSec);
    _vanquishTimer = Math.max(0, _vanquishTimer - dtSec);
    _petRebirthTimer = Math.max(0, _petRebirthTimer - dtSec);
    _itemFetchCooldownTimer = Math.max(0, _itemFetchCooldownTimer - dtSec);
    _guidancePulseTimer = Math.max(0, _guidancePulseTimer - dtSec);
    _harvestAbsorbBurstTimer = Math.max(0, _harvestAbsorbBurstTimer - dtSec);
    _harvestFlareTimer = Math.max(0, _harvestFlareTimer - dtSec);

    if (ppos) {
      // Danger scan (throttled)
      _dangerScanTimer -= dtSec;
      if (_dangerScanTimer <= 0) {
        _dangerScanTimer = DANGER_SCAN_INTERVAL;
        _scanDangers(ppos.x | 0, ppos.y | 0);
      }

      // Ambient sacred-site acknowledgment while roaming near altars/shrines.
      _sacredScanTimer -= dtSec;
      if (_sacredScanTimer <= 0) {
        _sacredScanTimer = SACRED_ACK_SCAN_INTERVAL;
        _scanNearbySacredSite(ppos.x | 0, ppos.y | 0);
      }
    }

    // Always finish in-flight essence pulls, even during combat/miracles
    _tickActiveEssencePulls(dtSec);

    // Spell surge overrides miracle flight and orbit
    if (_tickSpellSurge(dtSec)) {
      _pushRibbonPoint();
      if (_flareBurstQueued) {
        _flareBurstQueued = false;
        _spawnFlareBurst();
      }
      return;
    }

    // Miracle flight overrides orbit
    if (_tickFlight(dtSec)) {
      _pushRibbonPoint();
      if (_flareBurstQueued) {
        _flareBurstQueued = false;
        _spawnFlareBurst();
      }
      if (_itemFetchReturnBurst && _flightState === FLIGHT_IDLE) {
        _itemFetchReturnBurst = false;
        _triggerFortuneAt(_anchorX, _anchorY, 0.75);
      }
      _spawnTrail(dtSec);
      return;
    }

    // Essence harvest — recruit new essences only during downtime
    if (_isHarvestDowntime()) {
      _harvestDowntimeAccum += dtSec;
      _recruitNewEssences();
    } else {
      _harvestDowntimeAccum = 0;
    }

    // Decay prayer spiral
    _prayerTimer = Math.max(0, _prayerTimer - dtSec);

    // Advance orbit (speed up during prayer spiral)
    const prayerRaw = _prayerTimer / PRAYER_SPIRAL_DURATION; // 1→0 over duration
    // Ease-in: slow start, accelerates into the spiral (cubic)
    const prayerT = prayerRaw * prayerRaw * prayerRaw;
    _phase += _orbitSpeed() * dtSec * (1 + prayerT * 3);

    // Compute position — prayer shrinks orbit to zero (spiral inward)
    const orbitR = _orbitRadius() * (1 - prayerT * 0.9);
    const bob = Math.sin(_fxTime * BOB_FREQ * Math.PI * 2) * BOB_AMP *
      (1 - prayerT);
    // Blend smooth orbit toward angular/harsh motion with wrath
    const smoothX = Math.cos(_phase);
    const smoothY = Math.sin(_phase);
    // Triangle wave: linear zig-zag, sharp direction reversals
    const triX = (2 / Math.PI) * Math.asin(smoothX);
    const triY = (2 / Math.PI) * Math.asin(smoothY);
    const w = Math.min(1, _wrath * 1.5); // 0 = smooth, 1 = fully angular
    _x = _anchorX + (smoothX + (triX - smoothX) * w) * orbitR;
    _y = _anchorY + (smoothY + (triY - smoothY) * w) * orbitR * 0.6 + bob;

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

    // Circling vanquished foes (player kill acknowledgment).
    if (_vanquishTimer > 0 && !_betrayed) {
      const t = Math.min(1, _vanquishTimer / VANQUISH_CIRCLE_DURATION);
      const angle = _phase * 1.35 + (1 - t) * Math.PI * 4;
      const radius = VANQUISH_ORBIT_RADIUS + (1 - t) * 0.26;
      const tx = _vanquishX + Math.cos(angle) * radius;
      const ty = _vanquishY + Math.sin(angle) * radius * 0.72;
      const blend = 0.22 + t * 0.56;
      _x += (tx - _x) * blend;
      _y += (ty - _y) * blend;
    }
    if (_petRebirthTimer > 0 && !_betrayed) {
      const t = Math.min(1, _petRebirthTimer / PET_REBIRTH_CIRCLE_DURATION);
      const angle = _phase * 1.55 + (1 - t) * Math.PI * 6.4;
      const radius = PET_REBIRTH_ORBIT_RADIUS + (1 - t) * 0.32;
      const tx = _petRebirthX + Math.cos(angle) * radius;
      const ty = _petRebirthY + Math.sin(angle) * radius * 0.68;
      const blend = 0.24 + t * 0.62;
      _x += (tx - _x) * blend;
      _y += (ty - _y) * blend;
    }

    _pushRibbonPoint();
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
      fx.pool.spawn(
        new Particle({
          x: _x + (Math.random() - 0.5) * 0.06,
          y: _y + (Math.random() - 0.5) * 0.06,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -0.2 - Math.random() * 0.3,
          life: TRAIL_LIFE + Math.random() * 0.15,
          size0: 0.06 + Math.random() * 0.03,
          size1: 0.01,
          r: pr,
          g: pg,
          b: pb,
          a0: alpha,
        }),
      );
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────

  function draw(bctx) {
    if (!_active) return;

    const dim = _betrayed ? BETRAYAL_DIM : 1;

    bctx.save();
    bctx.globalCompositeOperation = "lighter";

    // Motion ribbon: tapered, mood-tinted comet tail
    if (_ribbonPoints.length >= 2) {
      const pr = _r | 0, pg = _g | 0, pb = _b | 0;
      for (let i = 1; i < _ribbonPoints.length; i++) {
        const t = i / (_ribbonPoints.length - 1); // 0 oldest .. 1 newest
        const p0 = _ribbonPoints[i - 1];
        const p1 = _ribbonPoints[i];
        const alpha = (0.05 + t * 0.32) * dim;
        const width = 0.01 + t * 0.06;
        bctx.strokeStyle = `rgba(${pr},${pg},${pb},${alpha.toFixed(3)})`;
        bctx.lineWidth = width;
        bctx.lineCap = "round";
        bctx.beginPath();
        bctx.moveTo(p0.x, p0.y);
        bctx.lineTo(p1.x, p1.y);
        bctx.stroke();
      }
    }

    // Miracle flare burst (mood-colored — it's a deity event)
    if (_flightState === FLIGHT_FLARE) {
      const pr = _r | 0, pg = _g | 0, pb = _b | 0;
      const flareT = Math.min(1, _flightTimer / MIRACLE_FLARE_TIME);
      const flareR = 0.5 + flareT * 0.8;
      const flareA = (1 - flareT) * 0.6;
      const fg = bctx.createRadialGradient(_x, _y, 0, _x, _y, flareR);
      fg.addColorStop(0, `rgba(255,255,240,${flareA.toFixed(3)})`);
      fg.addColorStop(
        0.3,
        `rgba(${pr},${pg},${pb},${(flareA * 0.6).toFixed(3)})`,
      );
      fg.addColorStop(1, `rgba(${pr},${pg},${pb},0)`);
      bctx.fillStyle = fg;
      bctx.beginPath();
      bctx.arc(_x, _y, flareR, 0, Math.PI * 2);
      bctx.fill();

      // Sigil rings at miracle point
      const ringA = (1 - flareT) * 0.45 * dim;
      bctx.strokeStyle = `rgba(${pr},${pg},${pb},${ringA.toFixed(3)})`;
      bctx.lineWidth = 0.02;
      bctx.beginPath();
      bctx.arc(_x, _y, 0.18 + flareT * 0.9, 0, Math.PI * 2);
      bctx.stroke();
      bctx.beginPath();
      bctx.arc(_x, _y, 0.1 + flareT * 0.6, 0, Math.PI * 2);
      bctx.stroke();
    }

    // Mood-tinted ball of light
    const r = _r | 0, g = _g | 0, b = _b | 0;
    const cr = Math.min(255, r * 0.5 + 128) | 0;
    const cg = Math.min(255, g * 0.5 + 128) | 0;
    const cb = Math.min(255, b * 0.5 + 128) | 0;

    // Core glow (outer halo) — flares on essence absorption
    const harvestFlareT = _harvestFlareTimer > 0
      ? Math.min(1, _harvestFlareTimer / HARVEST_FLARE_DURATION)
      : 0;
    const glowR = 0.22 + Math.sin(_fxTime * 3.2) * 0.04 + harvestFlareT * 0.12;
    const glowAlphaBoost = harvestFlareT * 0.25; // brighter on absorb
    const gradient = bctx.createRadialGradient(_x, _y, 0, _x, _y, glowR);
    gradient.addColorStop(
      0,
      `rgba(${r}, ${g}, ${b}, ${Math.min(1, (0.7 + glowAlphaBoost) * dim).toFixed(3)})`,
    );
    gradient.addColorStop(
      0.4,
      `rgba(${r}, ${g}, ${b}, ${Math.min(1, (0.3 + glowAlphaBoost * 0.5) * dim).toFixed(3)})`,
    );
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    bctx.fillStyle = gradient;
    bctx.beginPath();
    bctx.arc(_x, _y, glowR, 0, Math.PI * 2);
    bctx.fill();

    // Bright core — lightened mood color, swells on essence absorb
    const coreR = 0.06 + Math.sin(_fxTime * 5.1) * 0.015 + harvestFlareT * 0.03;
    bctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${(0.9 * dim).toFixed(3)})`;
    bctx.beginPath();
    bctx.arc(_x, _y, coreR, 0, Math.PI * 2);
    bctx.fill();

    // Orbiting spirit motes around core
    const moteCount = Math.min(
      MOTE_MAX_COUNT + FORTUNE_MOTE_BOOST,
      MOTE_BASE_COUNT +
        ((_amusement + _chaos) > 0.75 ? 1 : 0) +
        (_flightState !== FLIGHT_IDLE ? 1 : 0) +
        (_fortuneTimer > 0 ? FORTUNE_MOTE_BOOST : 0),
    );
    for (let i = 0; i < moteCount; i++) {
      const speed = 1.4 + i * 0.35 + _amusement * 1.2;
      const ang = _phase * speed + i * 2.1 +
        Math.sin(_fxTime * (3.5 + i)) * 0.2;
      const rr = MOTE_RADIUS + i * 0.045 +
        Math.sin(_fxTime * (2.7 + i * 0.4)) * 0.015;
      const mx = _x + Math.cos(ang) * rr;
      const my = _y + Math.sin(ang) * rr * 0.7;
      const ma = (0.22 + 0.18 * Math.sin(_fxTime * (7.2 + i))) * dim;
      bctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${
        Math.max(0.08, ma).toFixed(3)
      })`;
      bctx.beginPath();
      bctx.arc(mx, my, 0.017 + i * 0.004, 0, Math.PI * 2);
      bctx.fill();
    }

    // Danger sense pulse — faint ring when sensing hidden threats
    if (_dangerIntensity > 0.1 && _flightState === FLIGHT_IDLE) {
      const pulseR = 0.15 + Math.sin(_fxTime * 6) * 0.05;
      const pulseA = _dangerIntensity * 0.4;
      bctx.strokeStyle = `rgba(255,180,60,${pulseA.toFixed(3)})`;
      bctx.lineWidth = 0.02;
      bctx.beginPath();
      bctx.arc(_x, _y, pulseR, 0, Math.PI * 2);
      bctx.stroke();

      // Occasional directional hint: brief point spark in danger direction.
      const snapT = Math.min(1, _dangerSnapTimer / 0.22);
      const blink = Math.sin(_fxTime * 8.5 + _phase * 0.6) > 0.87;
      if (snapT > 0.05 || blink) {
        const dirLen = 0.46 + (_dangerIntensity * 0.36) + (snapT * 0.22);
        const nx = _dangerDx;
        const ny = _dangerDy;
        const lx = -ny;
        const ly = nx;
        const tipX = _x + nx * dirLen;
        const tipY = _y + ny * dirLen;
        const wing = 0.035 + _dangerIntensity * 0.03 + snapT * 0.02;
        const alpha = Math.min(
          0.92,
          0.42 + (_dangerIntensity * 0.38) + snapT * 0.18,
        );

        bctx.fillStyle = `rgba(255,232,150,${alpha.toFixed(3)})`;
        bctx.beginPath();
        bctx.arc(tipX, tipY, 0.02 + wing * 0.65, 0, Math.PI * 2);
        bctx.fill();

        bctx.strokeStyle = `rgba(255,248,210,${
          Math.min(0.95, alpha + 0.12).toFixed(3)
        })`;
        bctx.lineWidth = 0.016 + _dangerIntensity * 0.01;
        bctx.beginPath();
        bctx.moveTo(
          tipX - nx * (wing * 2.4) + lx * wing,
          tipY - ny * (wing * 2.4) + ly * wing,
        );
        bctx.lineTo(tipX, tipY);
        bctx.lineTo(
          tipX - nx * (wing * 2.4) - lx * wing,
          tipY - ny * (wing * 2.4) - ly * wing,
        );
        bctx.stroke();
      }
    }

    // Trap hint ping: faint marker at inferred hidden trap position.
    if (
      _trapHintTimer > 0 && _dangerIntensity > 0.18 &&
      _flightState === FLIGHT_IDLE
    ) {
      const tt = Math.min(1, _trapHintTimer / 0.8);
      const ring = 0.08 + (1 - tt) * 0.14;
      const alpha = Math.min(0.55, 0.14 + _dangerIntensity * 0.35) * tt;
      bctx.strokeStyle = `rgba(255,170,70,${alpha.toFixed(3)})`;
      bctx.lineWidth = 0.015;
      bctx.beginPath();
      bctx.arc(_trapHintX, _trapHintY, ring, 0, Math.PI * 2);
      bctx.stroke();
    }

    // Cleanse aura: rotating spiral ring around spirit
    if (_cleanseTimer > 0) {
      const t = Math.min(1, _cleanseTimer / 1.2);
      const ringR = 0.26 + (1 - t) * 0.10;
      const a = (0.20 + 0.28 * t) * dim;
      bctx.strokeStyle = `rgba(160,235,255,${a.toFixed(3)})`;
      bctx.lineWidth = 0.022;
      bctx.beginPath();
      bctx.arc(_x, _y, ringR, _phase, _phase + Math.PI * 1.5);
      bctx.stroke();
    }

    // Aegis halo: defensive shell pulses while active
    if (_aegisTimer > 0) {
      const pulse = 0.28 + Math.sin(_fxTime * 8.0) * 0.04;
      const aa = (0.25 + Math.min(0.25, _aegisTimer * 0.08)) * dim;
      bctx.strokeStyle = `rgba(255,235,165,${aa.toFixed(3)})`;
      bctx.lineWidth = 0.028;
      bctx.beginPath();
      bctx.arc(_x, _y, pulse, 0, Math.PI * 2);
      bctx.stroke();
    }

    // Guidance pulse: gentle expanding ring when delivering a tutorial tip.
    if (_guidancePulseTimer > 0) {
      const gt = Math.min(1, _guidancePulseTimer / GUIDANCE_PULSE_DURATION);
      const gr = 0.18 + (1 - gt) * 0.35;
      const ga = (0.15 + gt * 0.35) * dim;
      bctx.strokeStyle = `rgba(${GUIDANCE_COLOR[0]},${GUIDANCE_COLOR[1]},${GUIDANCE_COLOR[2]},${ga.toFixed(3)})`;
      bctx.lineWidth = 0.022;
      bctx.beginPath();
      bctx.arc(_x, _y, gr, 0, Math.PI * 2);
      bctx.stroke();
      // Inner sparkle ring.
      const ir = 0.10 + (1 - gt) * 0.18;
      bctx.strokeStyle = `rgba(220,245,255,${(ga * 0.7).toFixed(3)})`;
      bctx.lineWidth = 0.014;
      bctx.beginPath();
      bctx.arc(_x, _y, ir, _phase, _phase + Math.PI * 1.6);
      bctx.stroke();
    }

    // Omen / patron shift ceremony ring
    if (_omenTimer > 0 || _ceremonyTimer > 0) {
      const o = Math.max(_omenTimer, _ceremonyTimer * 1.2);
      const tr = Math.min(1, o / 1.6);
      const rr = 0.34 + (1 - tr) * 0.18 + Math.sin(_fxTime * 5.4) * 0.02;
      bctx.strokeStyle = `rgba(225,205,255,${(0.15 + tr * 0.26).toFixed(3)})`;
      bctx.lineWidth = 0.018;
      bctx.beginPath();
      bctx.arc(_x, _y, rr, 0, Math.PI * 2);
      bctx.stroke();
    }

    // Providence target cue (e.g. supply drop landing tile)
    if (_targetCueTimer > 0) {
      const tt = Math.min(1, _targetCueTimer / 1.4);
      const rr = 0.18 + (1 - tt) * 0.30;
      const aa = 0.12 + tt * 0.32;
      bctx.strokeStyle = `rgba(255,220,110,${aa.toFixed(3)})`;
      bctx.lineWidth = 0.02;
      bctx.beginPath();
      bctx.arc(_targetCueX, _targetCueY, rr, 0, Math.PI * 2);
      bctx.stroke();

      bctx.strokeStyle = `rgba(255,245,210,${(aa * 0.9).toFixed(3)})`;
      bctx.lineWidth = 0.016;
      bctx.beginPath();
      bctx.moveTo(_targetCueX - 0.12, _targetCueY);
      bctx.lineTo(_targetCueX + 0.12, _targetCueY);
      bctx.moveTo(_targetCueX, _targetCueY - 0.12);
      bctx.lineTo(_targetCueX, _targetCueY + 0.12);
      bctx.stroke();
    }

    // Vanquish mark: a brief honoring ring around defeated foes.
    if (_vanquishTimer > 0) {
      const t = Math.min(1, _vanquishTimer / VANQUISH_CIRCLE_DURATION);
      const ring = 0.2 + (1 - t) * 0.18;
      const a = (0.08 + t * 0.24) * dim;
      bctx.strokeStyle = `rgba(255,214,150,${a.toFixed(3)})`;
      bctx.lineWidth = 0.017;
      bctx.beginPath();
      bctx.arc(_vanquishX, _vanquishY, ring, 0, Math.PI * 2);
      bctx.stroke();
    }
    if (_petRebirthTimer > 0) {
      const t = Math.min(1, _petRebirthTimer / PET_REBIRTH_CIRCLE_DURATION);
      const ringA = (0.14 + t * 0.3) * dim;
      const r1 = 0.26 + (1 - t) * 0.22;
      const r2 = 0.14 + (1 - t) * 0.14;
      bctx.strokeStyle = `rgba(205,245,255,${ringA.toFixed(3)})`;
      bctx.lineWidth = 0.02;
      bctx.beginPath();
      bctx.arc(_petRebirthX, _petRebirthY, r1, 0, Math.PI * 2);
      bctx.stroke();
      bctx.strokeStyle = `rgba(255,228,160,${(ringA * 0.92).toFixed(3)})`;
      bctx.lineWidth = 0.016;
      bctx.beginPath();
      bctx.arc(_petRebirthX, _petRebirthY, r2, 0, Math.PI * 2);
      bctx.stroke();
    }

    // Essence harvest VFX: tether lines to pulling orbs + absorption burst.
    if (_harvestDowntimeAccum >= HARVEST_LINGER_DELAY && deathEssenceFx) {
      const orbs = deathEssenceFx.peekOrbs();
      for (let i = 0; i < orbs.length; i++) {
        const o = orbs[i];
        if (!o.pulling) continue;
        // Faint tether from wisp to each pulling essence
        const dist = Math.hypot(_x - o.x, _y - o.y);
        const tetherA = Math.min(0.22, 0.04 + (o.pullStrength || 0) * 0.04) *
          (1 - Math.min(1, dist / 5)) * dim;
        if (tetherA < 0.01) continue;
        bctx.strokeStyle = `rgba(${HARVEST_ABSORB_COLOR[0]},${HARVEST_ABSORB_COLOR[1]},${HARVEST_ABSORB_COLOR[2]},${tetherA.toFixed(3)})`;
        bctx.lineWidth = 0.010;
        bctx.beginPath();
        bctx.moveTo(_x, _y);
        bctx.lineTo(o.x, o.y);
        bctx.stroke();
      }
    }
    if (_harvestAbsorbBurstTimer > 0) {
      // Post-absorption glow: brief color bloom at wisp location
      const bt = Math.min(1, _harvestAbsorbBurstTimer / 0.6);
      const burstR = 0.08 + (1 - bt) * 0.16;
      const burstA = bt * 0.35 * dim;
      const glow = bctx.createRadialGradient(_x, _y, 0, _x, _y, burstR);
      glow.addColorStop(0, `rgba(${_harvestBurstR},${_harvestBurstG},${_harvestBurstB},${burstA.toFixed(3)})`);
      glow.addColorStop(0.5, `rgba(${HARVEST_ABSORB_COLOR[0]},${HARVEST_ABSORB_COLOR[1]},${HARVEST_ABSORB_COLOR[2]},${(burstA * 0.5).toFixed(3)})`);
      glow.addColorStop(1, `rgba(${HARVEST_ABSORB_COLOR[0]},${HARVEST_ABSORB_COLOR[1]},${HARVEST_ABSORB_COLOR[2]},0)`);
      bctx.fillStyle = glow;
      bctx.beginPath();
      bctx.arc(_x, _y, burstR, 0, Math.PI * 2);
      bctx.fill();
    }

    // Sacred-site attunement: the spirit marks altar/shrine tile when engaged.
    if (_altarBeaconTimer > 0) {
      const t = Math.min(1, _altarBeaconTimer / ALTAR_ATTUNE_DURATION);
      const ringA = 0.16 + t * 0.34;
      const r1 = 0.22 + (1 - t) * 0.25;
      const r2 = 0.12 + (1 - t) * 0.16;
      bctx.strokeStyle = `rgba(208,170,255,${ringA.toFixed(3)})`;
      bctx.lineWidth = 0.018;
      bctx.beginPath();
      bctx.arc(_altarBeaconX, _altarBeaconY, r1, 0, Math.PI * 2);
      bctx.stroke();
      bctx.beginPath();
      bctx.arc(_altarBeaconX, _altarBeaconY, r2, 0, Math.PI * 2);
      bctx.stroke();

      // Light tether from spirit to sacred site for communion feel.
      const tetherA = (0.05 + t * 0.18) * (_betrayed ? 0.5 : 1);
      bctx.strokeStyle = `rgba(235,210,255,${tetherA.toFixed(3)})`;
      bctx.lineWidth = 0.012;
      bctx.beginPath();
      bctx.moveTo(_x, _y);
      bctx.lineTo(_altarBeaconX, _altarBeaconY);
      bctx.stroke();
    }

    // Rejection response: cracked ember ring when offering fails.
    if (_altarRejectTimer > 0 && _altarBeaconTimer > 0) {
      const t = Math.min(1, _altarRejectTimer / 1.0);
      bctx.strokeStyle = `rgba(255,110,70,${(0.2 + t * 0.35).toFixed(3)})`;
      bctx.lineWidth = 0.022;
      bctx.beginPath();
      bctx.arc(
        _altarBeaconX,
        _altarBeaconY,
        0.18 + (1 - t) * 0.12,
        0,
        Math.PI * 1.45,
      );
      bctx.stroke();
    }

    // Malevolence surge: cursed offerings/offenses/wrath leave a hostile scar.
    if (_malevolenceTimer > 0) {
      const mt = Math.min(1, _malevolenceTimer / 2.4);
      const pulse = 0.18 + (1 - mt) * 0.22 + Math.sin(_fxTime * 9.2) * 0.02;
      const a = 0.12 + mt * 0.34;
      bctx.strokeStyle = `rgba(255,95,65,${a.toFixed(3)})`;
      bctx.lineWidth = 0.02;
      bctx.beginPath();
      bctx.arc(_malevolenceX, _malevolenceY, pulse, 0, Math.PI * 2);
      bctx.stroke();

      bctx.strokeStyle = `rgba(210,55,40,${Math.min(0.5, a + 0.1).toFixed(3)})`;
      bctx.lineWidth = 0.014;
      bctx.beginPath();
      bctx.moveTo(_malevolenceX - 0.11, _malevolenceY - 0.11);
      bctx.lineTo(_malevolenceX + 0.11, _malevolenceY + 0.11);
      bctx.moveTo(_malevolenceX + 0.11, _malevolenceY - 0.11);
      bctx.lineTo(_malevolenceX - 0.11, _malevolenceY + 0.11);
      bctx.stroke();
    }

    bctx.restore();
  }

  // ── Lighting ──────────────────────────────────────────────────────

  function getActiveLights() {
    if (!_active) return [];
    const dim = _betrayed ? BETRAYAL_DIM : 1;
    const pulse = Math.sin(_fxTime * LIGHT_PULSE_FREQ * Math.PI * 2) *
      LIGHT_PULSE_AMP;
    // Miracle flare / essence absorption emit extra light
    const harvestGlow = _harvestFlareTimer > 0
      ? Math.min(1, _harvestFlareTimer / HARVEST_FLARE_DURATION) * 1.2
      : 0;
    const flareBonus = (_flightState === FLIGHT_FLARE ? 3 : 0) + harvestGlow;
    return [{
      x: _x,
      y: _y,
      radius: (LIGHT_RADIUS + pulse + flareBonus) * dim,
      color: [_r | 0, _g | 0, _b | 0],
      softness: 16,
    }];
  }

  function setDepth(depth) {
    _lastDepth = depth | 0;
  }

  /** Expose wisp world position for prayer proximity check. */
  function getWispPos() {
    if (!_active) return null;
    return { x: _x, y: _y };
  }

  // ── Event wiring ──────────────────────────────────────────────────

  function installListeners() {
    if (!world || world[INSTALLED_KEY]) return;
    world[INSTALLED_KEY] = true;

    const flyTo = (entityId) => {
      const pos = getPosition(Number(entityId || 0) | 0);
      if (pos) _startMiracleFlight(pos.x, pos.y);
      return pos;
    };

    const onDivineBoon = (payload) => {
      const actor = Number(payload?.actor || 0) | 0;
      if (actor > 0) flyTo(actor);

      const boon = String(payload?.boon || "").toLowerCase();
      const actorPos = actor > 0 ? getPosition(actor) : null;
      const ax = Number(actorPos?.x || _anchorX);
      const ay = Number(actorPos?.y || _anchorY);
      const amount = Math.max(0, Number(payload?.amount || 0));
      const removed = Math.max(0, Number(payload?.removed || 0));
      const uncursed = Math.max(0, Number(payload?.uncursed || 0));
      const strength = 1 + Math.min(2, (amount + removed + uncursed) / 20);

      if (boon === "cleanse" || boon === "extinguish") {
        _triggerCleanseAt(ax, ay, strength);
      } else if (boon === "protection") {
        _triggerAegisAt(ax, ay, strength);
      } else if (boon === "fortune") {
        _triggerFortuneAt(ax, ay, strength);
      } else if (boon === "supply_drop") {
        const itemId = Number(payload?.itemId || 0) | 0;
        const ip = itemId > 0 ? getPosition(itemId) : null;
        if (ip) _queueItemFetch(ip.x, ip.y, 1.8);
        _triggerFortuneAt(ip?.x ?? ax, ip?.y ?? ay, 1.2);
      } else if (
        boon === "renewal" || boon === "mana_surge" || boon === "sustain"
      ) {
        _triggerAegisAt(ax, ay, 0.7 + Math.min(1.2, amount / 30));
      }
    };

    const onMiracle = (payload) => {
      const playerId = Number(payload?.playerId || 0) | 0;
      const p = playerId > 0 ? flyTo(playerId) : null;
      const px = Number(p?.x || _anchorX);
      const py = Number(p?.y || _anchorY);
      const effect = String(payload?.effect || "").toLowerCase();
      if (effect === "heal") _triggerAegisAt(px, py, 1.4);
      else if (effect === "cure" || effect === "uncurse_equipment") {
        _triggerCleanseAt(px, py, 1.3);
      } else if (effect === "satiate") _triggerAegisAt(px, py, 1.0);
      else if (effect === "lucky_affix" || effect === "lucky_buff") {
        _triggerFortuneAt(px, py, 1.5);
      } else _triggerCeremonyAt(px, py, 0.9);
    };

    const onIntervention = (payload) => {
      const playerId = Number(payload?.playerId || 0) | 0;
      if (playerId > 0) flyTo(playerId);
      const kind = String(payload?.kind || "").toLowerCase();
      if (kind === "wrath") {
        _agitation = COMBAT_DECAY * 2;
      } else if (kind === "shrine_blessing") {
        _triggerAegisAt(_anchorX, _anchorY, 1.0);
      } else if (kind === "patron_shift") {
        _triggerCeremonyAt(_anchorX, _anchorY, 1.4);
      } else if (kind === "prayer_uncurse") {
        _triggerCleanseAt(_anchorX, _anchorY, 1.1);
      }
    };

    // Combat agitation
    world.on("damaged", () => {
      _agitation = COMBAT_DECAY;
    });
    world.on("ranged:shot", () => {
      _agitation = COMBAT_DECAY;
    });
    world.on("castSpell", () => {
      _agitation = COMBAT_DECAY;
    });

    // Spirit spell boost — wisp follows the spell projectile to the target.
    // The boost event sets a one-shot flag; the next matching spell:* projectile
    // event triggers the actual surge flight so timing syncs perfectly.
    let _pendingSurge = false;
    world.on("spirit:spellBoost", () => {
      if (_betrayed || _deathVigil) return;
      _pendingSurge = true;
      _agitation = COMBAT_DECAY * 2.5;
    });

    // Hook spell projectile events for surge flight.
    // Each spell emits its own event with from/to coordinates; the wisp
    // lerps alongside the first one that fires after a spirit:spellBoost.

    /** Consume a pending surge and start the flight. */
    function _trySurge(fromX, fromY, toX, toY, speed) {
      if (!_pendingSurge) return;
      _pendingSurge = false;
      const dist = Math.hypot(toX - fromX, toY - fromY) || 1;
      _startSpellSurge(fromX, fromY, toX, toY, Math.max(0.06, Math.min(0.7, dist / speed)));
    }

    // ── Ranged projectile spells ──────────────────────────────────────
    world.on("spell:frost", ({ from, at, fizzle }) => {
      if (fizzle || !from || !at) return;
      _trySurge(from.x, from.y, at.x, at.y, 8);
    });
    world.on("spell:shadow_bolt", ({ from, to, fizzle }) => {
      if (fizzle || !from || !to) return;
      _trySurge(from.x, from.y, to.x, to.y, 10);
    });
    world.on("spell:bolt", ({ from, to, chainIndex }) => {
      if (!from || !to || (chainIndex | 0) !== 0) return; // first chain segment only
      _trySurge(from.x, from.y, to.x, to.y, 14);
    });
    world.on("spell:smite", ({ actor, targetId, fizzle }) => {
      if (fizzle) return;
      const apos = getPosition(Number(actor || 0));
      const tpos = getPosition(Number(targetId || 0));
      if (apos && tpos) _trySurge(apos.x, apos.y, tpos.x, tpos.y, 10);
    });

    // ── Ranged AoE (single-target AoE at a point) ────────────────────
    world.on("spell:meteor", ({ from, origin, fizzle }) => {
      if (fizzle || !from || !origin) return;
      _trySurge(from.x, from.y, origin.x, origin.y, 10);
    });
    world.on("spell:scorch", ({ actor, targetId, fizzle }) => {
      if (fizzle) return;
      const apos = getPosition(Number(actor || 0));
      const tpos = getPosition(Number(targetId || 0));
      if (apos && tpos) _trySurge(apos.x, apos.y, tpos.x, tpos.y, 10);
    });

    // ── Fireball (wisp flies to target) ────────────────────────────
    world.on("spell:fireball", ({ from, to, fizzle }) => {
      if (fizzle || !from || !to) return;
      _trySurge(from.x, from.y, to.x, to.y, 10);
    });

    // ── Targeted DoTs (wisp flies to target on application) ──────────
    world.on("spell:plague_swarm", ({ from, at, fizzle }) => {
      if (fizzle || !from || !at) return;
      _trySurge(from.x, from.y, at.x, at.y, 8);
    });
    world.on("spell:agony", ({ from, at, fizzle }) => {
      if (fizzle || !from || !at) return;
      _trySurge(from.x, from.y, at.x, at.y, 8);
    });
    world.on("spell:drain_life:start", ({ from, to, fizzle }) => {
      if (fizzle || !from || !to) return;
      _trySurge(from.x, from.y, to.x, to.y, 8);
    });

    // ── Self-centered AoE (wisp flares in place instead of flying) ───
    world.on("spell:blastwave", ({ origin }) => {
      if (!_pendingSurge || !origin) return;
      _pendingSurge = false;
      // Flare at player rather than flying — AoE radiates from caster
      _flareBurstQueued = true;
      _agitation = COMBAT_DECAY * 2.5;
    });
    world.on("spell:earthshatter", () => {
      if (!_pendingSurge) return;
      _pendingSurge = false;
      _flareBurstQueued = true;
      _agitation = COMBAT_DECAY * 2.5;
    });
    world.on("spell:cleave", () => {
      if (!_pendingSurge) return;
      _pendingSurge = false;
      _flareBurstQueued = true;
      _agitation = COMBAT_DECAY * 2.5;
    });
    world.on("spell:thorn_burst", () => {
      if (!_pendingSurge) return;
      _pendingSurge = false;
      _flareBurstQueued = true;
      _agitation = COMBAT_DECAY * 2.5;
    });
    world.on("spell:war_cry", () => {
      if (!_pendingSurge) return;
      _pendingSurge = false;
      _flareBurstQueued = true;
      _agitation = COMBAT_DECAY * 2.5;
    });
    for (const _ev of ["spell:iron_flesh", "spell:ignite_weapons", "spell:barkskin", "spell:quicken", "spell:mark_of_death", "spell:primal_roar"]) {
      world.on(_ev, () => {
        if (!_pendingSurge) return;
        _pendingSurge = false;
        _flareBurstQueued = true;
        _agitation = COMBAT_DECAY * 2.5;
      });
    }

    // ── Generic fallback — any remaining ranged spell ────────────────
    world.on("castSpell", ({ targetId, spiritBoosted }) => {
      if (!_pendingSurge || !spiritBoosted) return;
      // If no specific spell:* event consumed the surge, fly to target directly
      setTimeout(() => {
        if (!_pendingSurge) return;
        _pendingSurge = false;
        const tid = Number(targetId || 0) | 0;
        const pos = tid > 0 ? getPosition(tid) : null;
        if (pos) _startMiracleFlight(pos.x, pos.y);
      }, 0);
    });

    // Prayer — wisp spirals inward then eases back out
    world.on("prayer", () => {
      _prayerTimer = Math.max(_prayerTimer, PRAYER_SPIRAL_DURATION);
    });

    // Player death — wisp settles onto the player's tile
    world.on("died", ({ id, killer }) => {
      const deadId = Number(id || 0) | 0;
      const pe = getPlayerEntity();
      const playerId = Number(pe?.id || 0) | 0;
      if (playerId > 0 && deadId === playerId) {
        _deathVigil = true;
        _deathLandT = 0;
        _deathCircleTimer = DEATH_CIRCLE_DURATION;
        const pos = getPosition(deadId) || pe?.pos ||
          { x: _anchorX, y: _anchorY };
        _deathTargetX = Number(pos?.x ?? _anchorX);
        _deathTargetY = Number(pos?.y ?? _anchorY);
        if (_active) {
          _deathStartX = _x;
          _deathStartY = _y;
          _deathHasStart = true;
        } else {
          _deathStartX = _deathTargetX + 1.2;
          _deathStartY = _deathTargetY - 0.8;
          _deathHasStart = true;
        }
        const dx = _deathStartX - _deathTargetX;
        const dy = (_deathStartY - _deathTargetY) / 0.65;
        _deathCirclePhase = (Math.abs(dx) + Math.abs(dy)) > 0.01
          ? Math.atan2(dy, dx)
          : _phase;
        _attuneSacredPos(_deathTargetX, _deathTargetY, 1.5);
        return;
      }
      if (
        playerId > 0 && (Number(killer || 0) | 0) === playerId &&
        deadId !== playerId
      ) {
        const pos = getPosition(deadId);
        if (!pos) return;
        _vanquishX = Number(pos.x);
        _vanquishY = Number(pos.y);
        _vanquishTimer = Math.max(_vanquishTimer, VANQUISH_CIRCLE_DURATION);
      }
    });

    world.on("item:dropped", ({ actor, itemId, at, source }) => {
      if (_deathVigil || _betrayed) return;
      const pe = getPlayerEntity();
      if (!pe) return;
      const playerId = Number(pe.id || 0) | 0;
      if (!(playerId > 0)) return;
      if ((Number(actor || 0) | 0) === playerId) return;

      const dropSource = String(source || "").toLowerCase();
      if (dropSource !== "death" && dropSource !== "boon") return;

      const pos = Number.isFinite(at?.x) && Number.isFinite(at?.y)
        ? { x: Number(at.x), y: Number(at.y) }
        : (Number(itemId || 0) > 0 ? getPosition(Number(itemId) | 0) : null);
      if (!pos) return;
      const dist = Math.max(
        Math.abs((pos.x | 0) - (_anchorX | 0)),
        Math.abs((pos.y | 0) - (_anchorY | 0)),
      );
      if (dist > ITEM_FETCH_RADIUS) return;
      _queueItemFetch(pos.x, pos.y, 1.5);
    });

    // Deity wrath — extra agitation
    world.on("deity:wrath", ({ playerId, cursed, severityScale }) => {
      const pe = getPlayerEntity();
      if (!pe || Number(playerId || 0) !== pe.id) return;
      _agitation = COMBAT_DECAY * 2;
      const scale = Math.max(1, Number(severityScale || 1));
      if (cursed || scale > 1.05) {
        _triggerMalevolenceAt(
          _anchorX,
          _anchorY,
          1.2 + Math.min(2.0, (scale - 1) * 2.5 + (cursed ? 0.8 : 0)),
        );
      }
    });
    world.on("deity:omen", () => {
      _omenTimer = Math.max(_omenTimer, 1.4);
    });
    world.on("deity:patronShift", ({ playerId }) => {
      const pe = getPlayerEntity();
      if (!pe || Number(playerId || 0) !== pe.id) return;
      _triggerCeremonyAt(_anchorX, _anchorY, 1.5);
    });
    world.on("prayer:insight", ({ actor }) => {
      const pe = getPlayerEntity();
      if (!pe || Number(actor || 0) !== pe.id) return;
      _omenTimer = Math.max(_omenTimer, 0.8);
    });

    // Altar/shrine interactions: sacred-site behavior keyed to target tile.
    world.on("altar:pray", ({ actor, targetId }) => {
      const pe = getPlayerEntity();
      if (!pe || Number(actor || 0) !== pe.id) return;
      const pos = _attuneSacredSite(targetId, actor, 2.2);
      if (pos) _startMiracleFlight(pos.x, pos.y);
      _omenTimer = Math.max(_omenTimer, 0.9);
    });
    world.on("altar:offered", ({ actor, targetId, value }) => {
      const pe = getPlayerEntity();
      if (!pe || Number(actor || 0) !== pe.id) return;
      const pos = _attuneSacredSite(targetId, actor, 2.8);
      const strength = 0.9 + Math.min(1.8, Number(value || 0) * 2.2);
      if (pos) _startMiracleFlight(pos.x, pos.y);
      _triggerCeremonyAt(_altarBeaconX, _altarBeaconY, strength);
      _triggerFortuneAt(
        _altarBeaconX,
        _altarBeaconY,
        Math.max(0.7, strength * 0.8),
      );
    });
    world.on("altar:offerFailed", ({ actor, targetId }) => {
      const pe = getPlayerEntity();
      if (!pe || Number(actor || 0) !== pe.id) return;
      _attuneSacredSite(targetId, actor, 1.2);
      _altarRejectTimer = Math.max(_altarRejectTimer, 1.0);
      _agitation = Math.max(_agitation, COMBAT_DECAY * 0.75);
    });
    world.on("altar:offer", ({ actor, targetId, beatitudeState, value }) => {
      const pe = getPlayerEntity();
      if (!pe || Number(actor || 0) !== pe.id) return;
      const pos = _attuneSacredSite(targetId, actor, 1.8);
      const state = String(beatitudeState || "").toLowerCase();
      if (state === "cursed") {
        _altarRejectTimer = Math.max(_altarRejectTimer, 1.4);
        _triggerMalevolenceAt(
          pos?.x ?? _altarBeaconX ?? _anchorX,
          pos?.y ?? _altarBeaconY ?? _anchorY,
          1.1 + Math.min(1.5, Number(value || 0) * 2.0),
        );
      }
    });
    world.on("altar:resurrectionDenied", ({ actor, targetId }) => {
      const pe = getPlayerEntity();
      if (!pe || Number(actor || 0) !== pe.id) return;
      _attuneSacredSite(targetId, actor, 2.0);
      _altarRejectTimer = Math.max(_altarRejectTimer, 1.6);
      _triggerMalevolenceAt(
        _altarBeaconX || _anchorX,
        _altarBeaconY || _anchorY,
        1.9,
      );
    });
    world.on("pet:resurrected", ({ actor, petId, at }) => {
      const pe = getPlayerEntity();
      if (!pe || Number(actor || 0) !== pe.id) return;
      const pid = Number(petId || 0) | 0;
      const pos = Number.isFinite(at?.x) && Number.isFinite(at?.y)
        ? { x: Number(at.x), y: Number(at.y) }
        : (pid > 0 ? getPosition(pid) : null);
      if (!pos) return;
      _triggerPetRebirthAt(pos.x, pos.y, 1.35);
    });
    world.on("shrine:communion", ({ actor, targetId, effect }) => {
      const pe = getPlayerEntity();
      if (!pe || Number(actor || 0) !== pe.id) return;
      const pos = _attuneSacredSite(targetId, actor, 2.5);
      if (pos) _startMiracleFlight(pos.x, pos.y);
      const e = String(effect || "").toLowerCase();
      if (e === "blessing") _triggerAegisAt(_altarBeaconX, _altarBeaconY, 1.3);
      else if (e === "cooldown") _omenTimer = Math.max(_omenTimer, 0.8);
      else _triggerCeremonyAt(_altarBeaconX, _altarBeaconY, 0.8);
    });
    world.on("deity:nicheEvent", ({ playerId, event }) => {
      const pe = getPlayerEntity();
      if (!pe || Number(playerId || 0) !== pe.id) return;
      const ev = String(event || "").toLowerCase();
      if (ev === "cursed_offering_angered") {
        _triggerMalevolenceAt(
          _altarBeaconX || _anchorX,
          _altarBeaconY || _anchorY,
          2.0,
        );
      } else if (ev === "cursed_offering_amused") {
        _triggerMalevolenceAt(
          _altarBeaconX || _anchorX,
          _altarBeaconY || _anchorY,
          1.1,
        );
      } else if (ev === "blessed_offering") {
        _triggerCeremonyAt(
          _altarBeaconX || _anchorX,
          _altarBeaconY || _anchorY,
          1.0,
        );
      }
    });
    world.on("deity:offense", ({ playerId }) => {
      const pe = getPlayerEntity();
      if (!pe || Number(playerId || 0) !== pe.id) return;
      _triggerMalevolenceAt(_anchorX, _anchorY, 1.4);
    });

    // Miracle / intervention — wisp flies to deliver it
    world.on("deity:intervention", onIntervention);
    world.on("deity:miracle", onMiracle);

    // Boon delivery — wisp flies to player
    world.on("deity:boon", onDivineBoon);

    // Tutorial guidance — pulse and optional flight to feature.
    world.on("guidance:pulse", () => {
      _guidancePulseTimer = Math.max(_guidancePulseTimer, GUIDANCE_PULSE_DURATION);
    });
    world.on("guidance:flyTo", ({ x, y }) => {
      if (Number.isFinite(x) && Number.isFinite(y)) {
        _startMiracleFlight(Number(x), Number(y));
      }
    });
  }

  function setGuideMode(v) {
    _guideMode = !!v;
  }

  return {
    tick,
    draw,
    getActiveLights,
    installListeners,
    setDepth,
    setGuideMode,
    getWispPos,
  };
}
