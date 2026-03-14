import { Collider } from "../components/Collider.js";
import { DoorKey } from "../components/DoorKey.js";
import { DoorLock } from "../components/DoorLock.js";
import { DoorState } from "../components/DoorState.js";
import { inventoryItems } from "./inventoryFacade.js";
import { invalidateTileQueryCache } from "./tileQueryCache.js";

/**
 * @param {any} world
 * @param {number} doorId
 * @returns {string}
 */
export function getDoorLockId(world, doorId) {
  return String(world.get(doorId, DoorLock)?.lockId || "");
}

/**
 * @param {any} world
 * @param {number} actorId
 * @param {number} doorId
 * @returns {number}
 */
export function findDoorKeyForActor(world, actorId, doorId) {
  const lockId = getDoorLockId(world, doorId);
  if (!lockId || !(actorId > 0)) return 0;
  for (const itemId of inventoryItems(world, actorId)) {
    if (String(world.get(itemId, DoorKey)?.lockId || "") === lockId) return itemId;
  }
  return 0;
}

/**
 * @param {any} world
 * @param {number} actorId
 * @param {number} doorId
 * @returns {boolean}
 */
export function actorHasDoorKey(world, actorId, doorId) {
  return findDoorKeyForActor(world, actorId, doorId) > 0;
}

/**
 * Keep door state, collider state, and tile cache synchronized.
 * @param {any} world
 * @param {number} doorId
 * @param {{ open?: boolean, locked?: boolean }} nextState
 * @param {number} [actor=0]
 * @returns {boolean}
 */
export function setDoorState(world, doorId, nextState, actor = 0) {
  const current = world.get(doorId, DoorState);
  if (!current) return false;

  const open = typeof nextState?.open === "boolean" ? nextState.open : !!current.open;
  const locked = typeof nextState?.locked === "boolean" ? nextState.locked : !!current.locked;
  if (open && locked) return false;
  if (current.open === open && current.locked === locked) return false;

  world.set(doorId, DoorState, { ...current, open, locked });
  const col = world.get(doorId, Collider);
  if (col) world.set(doorId, Collider, { ...col, solid: !open, blocksSight: !open });
  invalidateTileQueryCache(world);
  world.emit?.("interaction", {
    actor,
    targetId: doorId,
    action: "toggleDoor",
    result: open ? "opened" : "closed",
    locked,
  });
  return true;
}
