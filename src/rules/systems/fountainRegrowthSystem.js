import { Interactable } from "../components/Interactable.js";
import { Position } from "../components/Position.js";
import { currentDepth } from "../utils/worldAccess.js";
import { Changed } from "../../lib/ecs-js/index.js";
import { createTurnSchedule } from "../utils/turnSchedule.js";

const FOUNTAIN_SOURCE_DB_AT_1_TILE = 80;

const FOUNTAIN_CLARITY = Object.freeze({
  far: "you hear faint gurgling",
  mid: "you hear running water",
  near: "you hear water gushing to life",
});

const FOUNTAIN_WAKEUPS = Symbol.for("jshack:fountainRegrowth:wakeups");
const FOUNTAIN_WAKEUPS_SEEDED = Symbol.for("jshack:fountainRegrowth:wakeups:seeded");

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
function getWakeups(world) {
  if (!world[FOUNTAIN_WAKEUPS]) {
    world[FOUNTAIN_WAKEUPS] = createTurnSchedule({ maxLevel: 10 });
  }
  return world[FOUNTAIN_WAKEUPS];
}

/**
 * @param {any} inter
 */
function readDryUntil(inter) {
  if (String(inter?.action || "") !== "fountain") return null;
  const params = (inter?.params && typeof inter.params === "object") ? inter.params : null;
  if (!params) return null;
  const chargesRemaining = Math.max(0, Number(params.chargesRemaining || 0) | 0);
  const dryUntilStep = Number(params.dryUntilStep ?? -1);
  if (chargesRemaining > 0) return null;
  if (!Number.isFinite(dryUntilStep) || dryUntilStep < 0) return null;
  return dryUntilStep | 0;
}

/**
 * Keep fountain wakeups aligned to Interactable state mutations.
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
function syncWakeupsFromChanged(world) {
  const wakeups = getWakeups(world);
  for (const [id, inter] of world.query(Interactable, Changed(Interactable))) {
    const due = readDryUntil(inter);
    const key = String(id | 0);
    if (due == null) wakeups.cancel(key);
    else wakeups.schedule(key, due, id | 0);
  }
}

/**
 * One-time seed from existing dry fountains (savegame/load/bootstrap).
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
function seedWakeups(world) {
  if (world[FOUNTAIN_WAKEUPS_SEEDED]) return;
  const wakeups = getWakeups(world);
  for (const [id, inter] of world.query(Interactable)) {
    const due = readDryUntil(inter);
    if (due == null) continue;
    wakeups.schedule(String(id | 0), due, id | 0);
  }
  world[FOUNTAIN_WAKEUPS_SEEDED] = true;
}

/**
 * Refill dry fountains as soon as cooldown expires.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
export function fountainRegrowthSystem(world) {
  const nowStep = Number(world.step || 0) | 0;
  const depth = currentDepth(world, 0);
  seedWakeups(world);
  syncWakeupsFromChanged(world);
  const wakeups = getWakeups(world);

  wakeups.drainDue(nowStep, (_key, value) => {
    const targetId = Number(value || 0) | 0;
    if (!(targetId > 0) || !world.isAlive(targetId)) return;
    const inter = world.get(targetId, Interactable);
    if (!inter || String(inter?.action || "") !== "fountain") return;

    const params = (inter.params && typeof inter.params === "object")
      ? { ...inter.params }
      : {};
    const chargesRemaining = Math.max(0, Number(params.chargesRemaining || 0) | 0);
    const maxCharges = Math.max(1, Number(params.maxCharges || 1) | 0);
    const cooldownTurns = Math.max(1, Number(params.cooldownTurns || 1) | 0);
    const dryUntilStep = Number(params.dryUntilStep ?? -1);
    if (chargesRemaining > 0) return;
    if (!Number.isFinite(dryUntilStep) || dryUntilStep < 0) return;
    if (nowStep < (dryUntilStep | 0)) return;

    params.chargesRemaining = maxCharges;
    params.maxCharges = maxCharges;
    params.cooldownTurns = cooldownTurns;
    params.dryUntilStep = -1;
    world.set(targetId, Interactable, { action: inter.action, params });

    const pos = world.get(targetId, Position);
    world.emit?.("fountain:refilled", {
      targetId,
      chargesRemaining: maxCharges,
      cooldownTurns,
    });
    world.emit?.("ambient:sound", {
      source: "fountain",
      at: { x: Number(pos?.x || 0) | 0, y: Number(pos?.y || 0) | 0 },
      depth,
      sourceDbAt1Tile: FOUNTAIN_SOURCE_DB_AT_1_TILE,
      clarity: FOUNTAIN_CLARITY,
      targetId,
    });
  });
}
