import { ItemCooldown } from "../components/ItemCooldown.js";
import { createTurnSchedule } from "./turnSchedule.js";

const ITEM_CD_SCHEDULE = Symbol.for("jshack:itemCooldowns:schedule");
const ITEM_CD_SEEDED = Symbol.for("jshack:itemCooldowns:seeded");

function stepOf(world) {
  return Number(world?.step || 0) | 0;
}

function ensureSchedule(world) {
  if (!world[ITEM_CD_SCHEDULE]) {
    world[ITEM_CD_SCHEDULE] = createTurnSchedule({ maxLevel: 12 });
  }
  return world[ITEM_CD_SCHEDULE];
}

function ensureSeeded(world) {
  if (world[ITEM_CD_SEEDED]) return;
  const schedule = ensureSchedule(world);
  const now = stepOf(world);
  for (const [id, cd] of world.query(ItemCooldown)) {
    const dueTurn = Number(cd?.dueTurn || 0) | 0;
    if (dueTurn > now) schedule.schedule(String(id), dueTurn, id | 0);
  }
  world[ITEM_CD_SEEDED] = true;
}

/**
 * @param {any} cooldown
 * @param {number} worldStep
 */
export function resolveItemCooldownRemaining(cooldown, worldStep) {
  const due = Number(cooldown?.dueTurn || 0) | 0;
  const now = Number(worldStep || 0) | 0;
  return Math.max(0, due - now);
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} itemId
 */
export function getItemCooldown(world, itemId) {
  const cd = world.get(itemId | 0, ItemCooldown);
  if (!cd) return null;
  const remaining = resolveItemCooldownRemaining(cd, stepOf(world));
  const max = Math.max(0, Number(cd.turnsMax || 0) | 0);
  return { remaining, max };
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} itemId
 */
export function getItemCooldownRemaining(world, itemId) {
  const info = getItemCooldown(world, itemId);
  return info ? info.remaining : 0;
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} itemId
 */
export function isItemOnCooldown(world, itemId) {
  return getItemCooldownRemaining(world, itemId) > 0;
}

/**
 * Canonical pathway for assigning item cooldowns.
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} itemId
 * @param {number} turns
 */
export function setItemCooldown(world, itemId, turns) {
  const id = Number(itemId || 0) | 0;
  const ttl = Math.max(0, Number(turns || 0) | 0);
  const schedule = ensureSchedule(world);
  ensureSeeded(world);
  schedule.cancel(String(id));

  let cd = /** @type any */ (world.get(id, ItemCooldown));
  if (!cd) {
    try { world.add(id, ItemCooldown, { turnsRemaining: 0, turnsMax: 0, dueTurn: 0 }); } catch {}
    cd = /** @type any */ (world.get(id, ItemCooldown));
  }
  if (!cd) return;

  if (!(ttl > 0)) {
    cd.turnsRemaining = 0;
    cd.turnsMax = 0;
    cd.dueTurn = stepOf(world);
    return;
  }

  const dueTurn = stepOf(world) + ttl;
  cd.turnsRemaining = ttl;
  cd.turnsMax = ttl;
  cd.dueTurn = dueTurn;
  schedule.schedule(String(id), dueTurn, id);
}

/**
 * Advance item cooldown state by waking only entities whose cooldown expired.
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
export function tickItemCooldowns(world) {
  const now = stepOf(world);
  ensureSeeded(world);
  const schedule = ensureSchedule(world);
  schedule.drainDue(now, (_key, value) => {
    const id = Number(value || 0) | 0;
    if (!(id > 0)) return;
    const cd = /** @type any */ (world.get(id, ItemCooldown));
    if (!cd) return;
    if (resolveItemCooldownRemaining(cd, now) > 0) return;
    cd.turnsRemaining = 0;
    cd.dueTurn = now;
  });
}
