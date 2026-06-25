import { startLoop, stopLoop, setLoopVolume } from "./audioEngine.js";
import { resolve } from "./sounds.js";
import { defineExtension } from "../../lib/ecs-js/index.js";
import { FountainDried } from "../../events/FountainDried.js";
import { FountainRefilled } from "../../events/FountainRefilled.js";

const FOUNTAIN_AUDIBLE_RADIUS_TILES = 7;
const FOUNTAIN_LOOP_GAIN = 0.24;
const AMBIENT_LOOP_BUS = "ambient:loop";
const FOUNTAIN_AMBIENT_EVENTS_KEY = Symbol.for("jshack:display:fountainAmbientEvents");

/**
 * @param {{ x:number, y:number }} a
 * @param {{ x:number, y:number }} b
 */
function euclideanDistance(a, b) {
  const dx = Number(a?.x || 0) - Number(b?.x || 0);
  const dy = Number(a?.y || 0) - Number(b?.y || 0);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Distance-based gain for the fountain loop.
 * Full volume beside the basin, fading to silence at the audible radius.
 * @param {number} distance
 * @returns {number}
 */
export function computeFountainLoopVolume(distance) {
  if (!Number.isFinite(distance)) return 0;
  if (distance <= 1) return FOUNTAIN_LOOP_GAIN;
  if (distance >= FOUNTAIN_AUDIBLE_RADIUS_TILES) return 0;
  const t = (distance - 1) / (FOUNTAIN_AUDIBLE_RADIUS_TILES - 1);
  return FOUNTAIN_LOOP_GAIN * Math.pow(1 - t, 1.35);
}

/**
 * @param {{
 *   world: { on?: (event:string, cb:(payload:any)=>void) => void },
 *   startLoopFn?: typeof startLoop,
 *   stopLoopFn?: typeof stopLoop,
 *   setLoopVolumeFn?: typeof setLoopVolume,
 *   resolveFn?: typeof resolve,
 * }} deps
 */
export function createFountainAmbientController({
  world,
  startLoopFn = startLoop,
  stopLoopFn = stopLoop,
  setLoopVolumeFn = setLoopVolume,
  resolveFn = resolve,
}) {
  const dryFountains = new Set();
  const fountainSound = resolveFn("fountain");
  const fountainUrl = fountainSound?.url || null;
  let loopActive = false;

  function isInactiveFountainEntity(entity) {
    if (!entity || entity.kind !== "fountain") return false;
    if (dryFountains.has(entity.id)) return true;
    const tags = Array.isArray(entity.tags) ? entity.tags : [];
    return tags.includes("inactive");
  }

  function installListeners() {
    world.install(defineExtension("jshack:display:fountainAmbientEvents", (installedWorld) => {
      const offDry = installedWorld.on(FountainDried, ({ targetId }) => dryFountains.add(targetId));
      const offRefilled = installedWorld.on(FountainRefilled, ({ targetId }) => dryFountains.delete(targetId));
      const offTransition = installedWorld.on("dungeon:transitioned", () => {
        dryFountains.clear();
        if (!fountainUrl || !loopActive) return;
        stopLoopFn(fountainUrl, { fadeOut: 0.35 });
        loopActive = false;
      });
      return () => { offDry(); offRefilled(); offTransition(); };
    }, { key: FOUNTAIN_AMBIENT_EVENTS_KEY }));
  }

  /**
   * @param {{
   *   player?: { pos?: { x:number, y:number } } | null,
   *   entities?: Array<{ id:number, kind?: string, pos?: { x:number, y:number } }>
   * } | null} worldView
   */
  function syncWorldView(worldView) {
    if (!fountainUrl) return;
    const playerPos = worldView?.player?.pos || null;
    const entities = Array.isArray(worldView?.entities) ? worldView.entities : [];
    if (!playerPos || entities.length === 0) {
      if (loopActive) {
        stopLoopFn(fountainUrl, { fadeOut: 0.35 });
        loopActive = false;
      }
      return;
    }

    let nearestDist = Infinity;
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (entity?.kind !== "fountain") continue;
      if (isInactiveFountainEntity(entity)) continue;
      if (!entity?.pos) continue;
      const dist = euclideanDistance(entity.pos, playerPos);
      if (dist < nearestDist) nearestDist = dist;
    }

    const targetVolume = computeFountainLoopVolume(nearestDist);
    if (targetVolume <= 0.001) {
      if (loopActive) {
        stopLoopFn(fountainUrl, { fadeOut: 0.45 });
        loopActive = false;
      }
      return;
    }

    if (!loopActive) {
      startLoopFn(fountainUrl, {
        bus: AMBIENT_LOOP_BUS,
        volume: targetVolume,
        fadeIn: 0.45,
      });
      loopActive = true;
      return;
    }

    setLoopVolumeFn(fountainUrl, targetVolume, { ramp: 0.12 });
  }

  return {
    installListeners,
    syncWorldView,
  };
}
