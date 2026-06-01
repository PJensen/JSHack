import { NamedIdentity } from "../components/NamedIdentity.js";
import { Polymorph } from "../components/Polymorph.js";
import { Position } from "../components/Position.js";
import { getMonster } from "../data/monsters.js";
import { spawnMonsterEntity } from "../utils/spawnMonsterEntity.js";
import { invalidateTileQueryCache } from "../utils/tileQueryCache.js";
import { addToInventory, destroyInventoryRoot, inventoryItems } from "../utils/inventoryFacade.js";
import { toMonsterSpawnParams } from "../utils/monsterSpawnParams.js";

const POLYMORPH_LISTENER_INSTALLED = Symbol.for("jshack:polymorph:listener:installed");

/** @type {{ before: Set<(ctx:any)=>void>, after: Set<(ctx:any)=>void> }} */
const POLYMORPH_HOOKS = {
  before: new Set(),
  after: new Set(),
};

/**
 * Register a lightweight polymorph hook.
 * @param {"before"|"after"} phase
 * @param {(ctx:any)=>void} fn
 * @returns {() => void} unsubscribe
 */
export function registerPolymorphHook(phase, fn) {
  if (!POLYMORPH_HOOKS[phase] || typeof fn !== "function") return () => {};
  POLYMORPH_HOOKS[phase].add(fn);
  return () => {
    POLYMORPH_HOOKS[phase].delete(fn);
  };
}

/** Test helper to reset module-level hooks. */
export function clearPolymorphHooks() {
  POLYMORPH_HOOKS.before.clear();
  POLYMORPH_HOOKS.after.clear();
}

function runPolymorphHooks(phase, ctx) {
  for (const fn of POLYMORPH_HOOKS[phase]) {
    try { fn(ctx); } catch (e) { console.debug("[polymorphSystem] hook failed:", e); }
  }
}

/**
 * Resolve a polymorph request immediately.
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {{ entityId?:number, actorId?:number, targetIdentity?:string, depth?:number, trigger?:string, reason?:string }} req
 * @returns {number} spawned entity id, or 0 when no transform happened
 */
export function resolvePolymorph(world, req = {}) {
  const entityId = req.entityId | 0;
  if (!(entityId > 0) || !world.isAlive(entityId)) return 0;

  const polymorph = world.get(entityId, Polymorph);
  if (!polymorph) return 0;
  if (polymorph.once && polymorph.revealed) return 0;

  const targetIdentity = String(req.targetIdentity || polymorph.targetIdentity || "");
  if (!targetIdentity) return 0;

  const def = getMonster(targetIdentity);
  if (!def) return 0;

  const pos = world.get(entityId, Position);
  if (!pos) return 0;

  const depth = Math.max(1, (Number(req.depth) || Number(polymorph.depth) || 1) | 0);
  const actorId = req.actorId | 0;
  const fromIdentity = String(world.get(entityId, NamedIdentity)?.identity || "");
  const hookKey = String(polymorph.hookKey || "");
  const trigger = String(req.trigger || polymorph.trigger || "manual");

  const ctx = {
    world,
    actorId,
    entityId,
    toEntityId: 0,
    fromIdentity,
    targetIdentity,
    hookKey,
    trigger,
    reason: String(req.reason || ""),
    at: { x: pos.x, y: pos.y },
  };

  runPolymorphHooks("before", ctx);
  world.emit("polymorph:before", ctx);

  const spawnedId = spawnMonsterEntity(world, {
    x: pos.x,
    y: pos.y,
    ...toMonsterSpawnParams(def, depth),
  });

  for (const itemId of inventoryItems(world, entityId)) {
    if (world.isAlive(itemId)) addToInventory(world, spawnedId, itemId);
  }

  destroyInventoryRoot(world, entityId);
  try { world.destroy(entityId); } catch {}
  invalidateTileQueryCache(world);

  const doneCtx = {
    ...ctx,
    toEntityId: spawnedId,
    toIdentity: String(world.get(spawnedId, NamedIdentity)?.identity || targetIdentity),
  };

  world.emit("spawned", { id: spawnedId, at: { x: pos.x, y: pos.y }, kind: "monster" });
  world.emit("polymorph:after", doneCtx);
  if (doneCtx.toIdentity === "mimic") {
    world.emit("mimic:revealed", doneCtx);
  }
  runPolymorphHooks("after", doneCtx);

  return spawnedId;
}

/**
 * Install polymorph event listener once per world.
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
export function installPolymorphListener(world) {
  if (!world || world[POLYMORPH_LISTENER_INSTALLED]) return;
  world[POLYMORPH_LISTENER_INSTALLED] = true;
  world.on("polymorph:request", (req) => {
    try { resolvePolymorph(world, req || {}); } catch (e) {
      console.error("[polymorphSystem] polymorph request failed:", e);
    }
  });
}

// Reserved for future queued/intents-based polymorphs.
export function polymorphSystem() {}
