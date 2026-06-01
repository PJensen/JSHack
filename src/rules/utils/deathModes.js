import { Player } from "../components/Player.js";
import { Position } from "../components/Position.js";
import { Vitality } from "../components/Vitality.js";
import { Equipment, GEAR_SLOTS } from "../components/Equipment.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { DungeonState } from "../components/DungeonState.js";
import { RunState, DEATH_MODES, DEATH_MODE_SET } from "../components/RunState.js";
import {
  inventoryItems,
  placeOnGround,
  removeFromInventory,
} from "./inventoryFacade.js";

const DEFAULT_NORMAL_DEATH_MODE = DEATH_MODES.dropBackpack;

function normalizeDifficulty(value) {
  const difficulty = String(value || "normal").toLowerCase();
  if (difficulty === "easy") return "normal";
  if (difficulty === "hard") return "hard";
  return "normal";
}

function normalizeDeathMode(value, fallback = DEFAULT_NORMAL_DEATH_MODE) {
  const mode = String(value || fallback).toLowerCase();
  return DEATH_MODE_SET.has(mode) ? mode : fallback;
}

function findRunStateEntity(world) {
  for (const [id] of world.query(RunState)) return id;
  return 0;
}

export function ensureRunState(world, opts = {}) {
  let id = findRunStateEntity(world);
  const difficulty = normalizeDifficulty(opts.difficulty);
  const defaultMode = difficulty === "hard" ? DEATH_MODES.permadeath : DEFAULT_NORMAL_DEATH_MODE;
  const deathMode = normalizeDeathMode(opts.deathMode, defaultMode);
  const patch = {
    difficulty,
    deathMode,
    resurrectionCount: Math.max(0, Number(opts.resurrectionCount || 0) | 0),
  };

  if (id > 0) {
    const current = world.get(id, RunState) || {};
    world.set(id, RunState, {
      ...current,
      difficulty,
      deathMode,
      resurrectionCount: Math.max(0, Number(current.resurrectionCount || 0) | 0),
    });
    return id;
  }

  id = world.create();
  world.add(id, RunState, patch);
  return id;
}

export function getRunState(world) {
  const id = findRunStateEntity(world);
  if (id > 0) return { id, state: world.get(id, RunState) };
  return { id: ensureRunState(world), state: world.get(findRunStateEntity(world), RunState) };
}

export function setDeathMode(world, mode, opts = {}) {
  const normalized = normalizeDeathMode(mode);
  const { id, state } = getRunState(world);
  world.set(id, RunState, {
    ...state,
    deathMode: normalized,
    difficulty: normalizeDifficulty(opts.difficulty || state?.difficulty),
  });
}

function equippedItemIds(world, actorId) {
  const eq = world.get(actorId, Equipment);
  const out = new Set();
  if (!eq) return out;
  for (const slot of GEAR_SLOTS) {
    const itemId = Number(eq[slot] || 0) | 0;
    if (itemId > 0) out.add(itemId);
  }
  return out;
}

function clearEquippedSlot(world, actorId, itemId) {
  const eq = world.get(actorId, Equipment);
  if (!eq) return;
  let changed = false;
  const next = { ...eq };
  for (const slot of GEAR_SLOTS) {
    if ((Number(next[slot] || 0) | 0) === itemId) {
      next[slot] = null;
      changed = true;
    }
  }
  if (changed) world.set(actorId, Equipment, next);
}

function dropItemAt(world, actorId, itemId, x, y, source) {
  if (!(itemId > 0) || !world.isAlive(itemId) || !world.has(itemId, ItemInfo)) return 0;
  removeFromInventory(world, actorId, itemId);
  clearEquippedSlot(world, actorId, itemId);
  const placed = placeOnGround(world, itemId, x, y, { mergeCompatibleAmmo: true });
  const droppedId = placed.itemId || itemId;
  world.emit("item:dropped", {
    actor: actorId,
    itemId: droppedId,
    count: world.get(droppedId, ItemInfo)?.count || 1,
    at: { x, y },
    source,
    origin: { x, y },
  });
  return droppedId;
}

function chooseKeptEquippedItem(world, actorId, equipped) {
  const eq = world.get(actorId, Equipment);
  if (!eq) return 0;
  for (const slot of ["weapon", "ranged", "armor", "offhand"]) {
    const itemId = Number(eq[slot] || 0) | 0;
    if (equipped.has(itemId)) return itemId;
  }
  for (const itemId of equipped) return itemId;
  return 0;
}

function dropDeathModeItems(world, actorId, mode, x, y) {
  if (mode === DEATH_MODES.mercy) return [];

  const dropped = [];
  const equipped = equippedItemIds(world, actorId);
  const keepEquipped = mode === DEATH_MODES.dropBackpack;
  const keptItem = mode === DEATH_MODES.dropAllButOne
    ? chooseKeptEquippedItem(world, actorId, equipped)
    : 0;

  for (const itemId of inventoryItems(world, actorId)) {
    if (keepEquipped && equipped.has(itemId)) continue;
    if (mode === DEATH_MODES.dropAllButOne && equipped.has(itemId)) continue;
    if (itemId === keptItem) continue;
    const droppedId = dropItemAt(world, actorId, itemId, x, y, "resurrection");
    if (droppedId > 0) dropped.push(droppedId);
  }

  if (mode === DEATH_MODES.dropAllButOne) {
    for (const itemId of equipped) {
      if (itemId === keptItem) continue;
      const droppedId = dropItemAt(world, actorId, itemId, x, y, "resurrection");
      if (droppedId > 0) dropped.push(droppedId);
    }
  }

  return dropped;
}

/**
 * Convert a fatal player hit into a pseudo-death if the current run mode allows it.
 *
 * @returns {null|{mode:string,count:number,droppedItemIds:number[],returnTicket:{depth:number,x:number,y:number}}}
 */
export function tryHandlePlayerPseudoDeath(world, actorId, death = {}) {
  const id = Number(actorId) | 0;
  if (!(id > 0) || !world.isAlive(id) || !world.has(id, Player)) return null;

  const runId = findRunStateEntity(world);
  if (!(runId > 0)) return null;
  const state = world.get(runId, RunState);
  const mode = normalizeDeathMode(state?.deathMode);
  if (mode === DEATH_MODES.permadeath) return null;

  const pos = world.get(id, Position);
  const vit = world.get(id, Vitality);
  if (!pos || !vit) return null;

  const returnTicket = {
    depth: 0,
    x: pos.x | 0,
    y: pos.y | 0,
  };
  for (const [, ds] of world.query(DungeonState)) {
    returnTicket.depth = Number(ds?.currentDepth || 0) | 0;
    break;
  }

  const droppedItemIds = dropDeathModeItems(world, id, mode, returnTicket.x, returnTicket.y);
  const resurrectHp = Math.max(1, Math.floor((Number(vit.maxHp) || 1) * 0.35));
  vit.hp = Math.min(Number(vit.maxHp) || resurrectHp, resurrectHp);

  const count = Math.max(0, Number(state?.resurrectionCount || 0) | 0) + 1;
  world.set(runId, RunState, {
    ...state,
    deathMode: mode,
    resurrectionCount: count,
  });

  const detail = {
    id,
    mode,
    count,
    killer: Number(death.killer || 0) | 0,
    cause: String(death.cause || "unknown"),
    droppedItemIds,
    returnTicket,
    hp: vit.hp | 0,
    maxHp: vit.maxHp | 0,
  };
  world.emit("player:resurrected", detail);
  world.emit("dungeon:teleport-depth", {
    actor: id,
    source: "resurrection",
    targetDepth: 0,
    returnTicket,
  });

  return detail;
}
