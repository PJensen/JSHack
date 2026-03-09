import { WeatherState } from "../components/WeatherState.js";
import { DungeonState } from "../components/DungeonState.js";
import { Player } from "../components/Player.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { GrowthStage } from "../components/GrowthStage.js";
import { HarvestNode } from "../components/HarvestNode.js";
import { Burned } from "../components/Burned.js";
import { Position } from "../components/Position.js";
import {
  getDestroyedTileLedger, destroyedTileKey, getDungeonStateRecord,
} from "../utils/destroyedTiles.js";
import { setTile } from "../environment/dungeon/tileMap.js";

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
      _extinguishStructures(world);
      _waterCrops(world);
      _emitRainAmbient(world, current);
    }

    break; // singleton
  }
}

/**
 * Remove burning status from the player.
 */
function _extinguishPlayer(world) {
  for (const [id] of world.query(Player, ActiveEffects)) {
    const ae = world.get(id, ActiveEffects);
    if (!ae || !Array.isArray(ae.effects)) continue;
    const before = ae.effects.length;
    ae.effects = ae.effects.filter(e => e.key !== "burn");
    if (ae.effects.length < before) {
      world.emit?.("weather:extinguish", { target: id, kind: "player" });
    }
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
