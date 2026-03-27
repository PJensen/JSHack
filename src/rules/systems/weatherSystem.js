import { WeatherState } from "../components/WeatherState.js";
import { DungeonState } from "../components/DungeonState.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { GrowthStage } from "../components/GrowthStage.js";
import { HarvestNode } from "../components/HarvestNode.js";
import { Burned } from "../components/Burned.js";
import { HazardArea } from "../components/HazardArea.js";
import { Position } from "../components/Position.js";
import { playerEntity, queryHazardAreas } from "../utils/queries.js";
import { Vitality } from "../components/Vitality.js";
import {
  getDestroyedTileLedger, destroyedTileKey, getDungeonStateRecord,
} from "../utils/destroyedTiles.js";
import { setTile, getTile } from "../environment/dungeon/tileMap.js";
import { TILE_TREE, TILE_WATER, TILE_SHALLOW_WATER, TILE_WATER_DEEP } from "../environment/dungeon/constants.js";
import { forEachInRadius } from "../utils/spatialIndex.js";
import { dealDamage } from "../utils/dealDamage.js";

// Weather durations (in turns)
const CLEAR_MIN = 80;
const CLEAR_MAX = 160;
const RAIN_MIN = 40;
const RAIN_MAX = 80;
const HEAVY_RAIN_MIN = 20;
const HEAVY_RAIN_MAX = 40;

// Transition probabilities (cumulative)
const P_RAIN = 0.30;
const P_HEAVY = 0.10; // 10% heavy rain

// Lightning strike tuning
const LIGHTNING_CHANCE = 0.08;     // per-turn chance during heavy rain
const LIGHTNING_RADIUS = 10;       // max distance from player
const LIGHTNING_MIN_DMG = 3;
const LIGHTNING_MAX_DMG = 8;
const WATER_TILES = new Set([TILE_WATER, TILE_SHALLOW_WATER, TILE_WATER_DEEP]);

// Ambient rain messages
const RAIN_LINES = Object.freeze([
  "you hear rain pattering on the ground",
  "you hear a steady drizzle on the rooftops",
  "you hear raindrops drumming on leaves",
  "you hear water trickling along the path",
]);

const HEAVY_RAIN_LINES = Object.freeze([
  "you hear a downpour hammering the earth",
  "you hear heavy rain drowning out all else",
  "you hear thunder rumble in the distance",
]);

/**
 * Weather state machine for the overworld (depth 0).
 *
 * Transitions: clear ↔ rain ↔ heavy_rain using world.rand().
 * Gameplay effects during rain:
 *   - Extinguish player burning status
 *   - Extinguish active floor fire hazards
 *   - Put out burning structures (restore tiles from destroyedTileLedger)
 *   - Water crops (extra regrow countdown decrement)
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
export function weatherSystem(world) {
  let depth = 1;
  for (const [, ds] of world.query(DungeonState)) {
    depth = ds.currentDepth ?? 1;
    break;
  }
  if (depth !== 0) return;

  for (const [wsId, ws] of world.query(WeatherState)) {
    const prev = ws.current;
    let remaining = (ws.turnsRemaining || 0) - 1;
    let cooldown = Math.max(0, (ws.transitionCooldown || 0) - 1);
    let current = ws.current || "clear";

    // Transition when duration expires
    if (remaining <= 0 && cooldown <= 0) {
      const roll = world.rand();
      if (roll < P_HEAVY) {
        current = "heavy_rain";
        remaining = HEAVY_RAIN_MIN + Math.floor(world.rand() * (HEAVY_RAIN_MAX - HEAVY_RAIN_MIN));
      } else if (roll < P_HEAVY + P_RAIN) {
        current = "rain";
        remaining = RAIN_MIN + Math.floor(world.rand() * (RAIN_MAX - RAIN_MIN));
      } else {
        current = "clear";
        remaining = CLEAR_MIN + Math.floor(world.rand() * (CLEAR_MAX - CLEAR_MIN));
      }
      cooldown = 10; // minimum turns before next transition

      if (current !== prev) {
        world.emit?.("weather:changed", { weather: current, prev });
      }
    }

    world.set(wsId, WeatherState, {
      current,
      turnsRemaining: Math.max(0, remaining),
      transitionCooldown: cooldown,
    });

    // Gameplay effects during rain
    const isRaining = current === "rain" || current === "heavy_rain";
    if (isRaining) {
      _extinguishPlayer(world);
      _extinguishFloorFireHazards(world);
      _extinguishStructures(world);
      _waterCrops(world);
      _emitRainAmbient(world, current);
    }
    if (current === "heavy_rain") {
      _rollLightning(world);
    }

    break; // singleton
  }
}

/**
 * Rain removes active floor fire hazards before they can continue spreading.
 */
function _extinguishFloorFireHazards(world) {
  const toDestroy = [];
  for (const [hazardId, , hazard] of queryHazardAreas(world)) {
    if (!hazard) continue;
    if (String(hazard.kind || "").toLowerCase() !== "fire") continue;
    if (String(hazard.medium || "air").toLowerCase() !== "floor") continue;
    toDestroy.push(hazardId);
  }
  for (let i = 0; i < toDestroy.length; i++) {
    try { world.destroy(toDestroy[i]); } catch {}
  }
  if (toDestroy.length > 0) {
    world.emit?.("weather:extinguish", { kind: "hazard", hazardKind: "fire", medium: "floor", count: toDestroy.length });
  }
}

/**
 * Remove burning status from the player.
 */
function _extinguishPlayer(world) {
  const _player = playerEntity(world);
  if (!_player) return;
  const ae = world.get(_player.id, ActiveEffects);
  if (!ae || !Array.isArray(ae.effects)) return;
  const before = ae.effects.length;
  ae.effects = ae.effects.filter(e => e.key !== "burn");
  if (ae.effects.length < before) {
    world.emit?.("weather:extinguish", { target: _player.id, kind: "player" });
  }
}

/**
 * Put out burning structures by restoring tiles from the destroyed tile ledger.
 */
function _extinguishStructures(world) {
  const ds = getDungeonStateRecord(world);
  if (!ds || !ds.destroyedTiles || typeof ds.destroyedTiles !== "object") return;

  const toRemove = [];
  for (const [key, rec] of Object.entries(ds.destroyedTiles)) {
    if ((rec.roofTurnsLeft || 0) > 0 && rec.originalTile != null) {
      setTile(rec.x, rec.y, rec.originalTile);
      toRemove.push(key);
    }
  }

  if (toRemove.length > 0) {
    for (const key of toRemove) {
      delete ds.destroyedTiles[key];
    }

    // Remove Burned components from entities at those positions
    const removedKeys = new Set(toRemove);
    for (const [id, burned, pos] of world.query(Burned, Position)) {
      const key = destroyedTileKey(pos.x, pos.y);
      if (removedKeys.has(key)) {
        try { world.remove(id, Burned); } catch {}
      }
    }

    world.emit?.("weather:extinguish", { kind: "structure", count: toRemove.length });
  }
}

/**
 * Extra regrow countdown decrement for crops during rain (2x growth speed).
 */
function _waterCrops(world) {
  for (const [id, gs] of world.query(GrowthStage, HarvestNode)) {
    const hn = world.get(id, HarvestNode);
    if (!hn || hn.ready) continue;
    const left = Number(hn.regrowCountdown || 0);
    if (left > 1) {
      world.mutate(id, HarvestNode, (r) => {
        r.regrowCountdown = Math.max(0, left - 1);
      });
    }
  }
}

/**
 * Roll for a lightning strike during heavy rain.
 * Strikes a random tile near the player; deals electric damage to entities,
 * and chains through water tiles.
 */
function _rollLightning(world) {
  if (world.rand() >= LIGHTNING_CHANCE) return;

  // Find the player position
  const _player = playerEntity(world);
  const px = _player?.pos.x ?? 0;
  const py = _player?.pos.y ?? 0;

  // Pick a random strike position near the player
  const ox = Math.floor(world.rand() * (LIGHTNING_RADIUS * 2 + 1)) - LIGHTNING_RADIUS;
  const oy = Math.floor(world.rand() * (LIGHTNING_RADIUS * 2 + 1)) - LIGHTNING_RADIUS;
  const sx = px + ox;
  const sy = py + oy;

  const tile = getTile(sx, sy);

  // Lightning is attracted to trees and water
  const hitTree = tile === TILE_TREE;
  const hitWater = WATER_TILES.has(tile);

  // Base damage roll
  const rawDmg = LIGHTNING_MIN_DMG + Math.floor(
    world.rand() * (LIGHTNING_MAX_DMG - LIGHTNING_MIN_DMG + 1)
  );

  // Collect entities hit: at strike point, or within 1 tile if water (conduction)
  const hitRadius = hitWater ? 1 : 0;
  const hitEntities = [];
  forEachInRadius(world, sx, sy, hitRadius, (id) => {
    if (!world.get(id, Vitality)) return;
    hitEntities.push(id);
  });

  // Apply damage to all hit entities
  for (const id of hitEntities) {
    const pos = world.get(id, Position);
    dealDamage(world, {
      target: id,
      amount: rawDmg,
      source: 0,
      type: "lightning",
      cause: "lightning",
      at: pos ? { x: pos.x, y: pos.y } : undefined,
    });

    // Electrocution (stun + blind + deafen) auto-applied by damaged-event listener.
  }

  // Check if the player was among the hit entities
  const _hitPlayer = playerEntity(world);
  const hitPlayer = _hitPlayer != null && hitEntities.includes(_hitPlayer.id);

  // Emit visual event
  world.emit?.("weather:lightning", {
    x: sx, y: sy,
    hitTree,
    hitWater,
    damage: rawDmg,
    hitCount: hitEntities.length,
    hitPlayer,
  });
}

/** @type {WeakMap<object, number>} */
const _nextAmbientStep = new WeakMap();

/**
 * Emit periodic ambient rain sound messages.
 */
function _emitRainAmbient(world, weather) {
  const step = world.step | 0;
  const next = _nextAmbientStep.get(world) || 0;
  if (step < next) return;

  const lines = weather === "heavy_rain" ? HEAVY_RAIN_LINES : RAIN_LINES;
  const idx = Math.floor(world.rand() * lines.length);

  world.emit?.("ambient:sound", {
    source: "weather",
    depth: 0,
    sourceDbAt1Tile: 30,
    clarity: {
      far: lines[idx],
      mid: lines[idx],
      near: lines[idx],
    },
  });

  _nextAmbientStep.set(world, step + 20 + Math.floor(world.rand() * 15));
}
