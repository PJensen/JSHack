// src/rules/systems/movementSystem.js
// Consumes MoveIntent, applies grid-based movement with simple collision.
//
// This system is responsible for three concerns only:
//   1. Direction resolution (including confusion misstep)
//   2. Collision detection and bump dispatch (via bumpResolvers)
//   3. Position update and blocking reservation
//
// Side effects like spider webs and auto-pickup are handled by listeners
// on the "moved" event and by autoPickupPostMoveSystem respectively.

import { Position } from "../components/Position.js";
import { MoveIntent } from "../components/Intents/MoveIntent.js";
import { Facing } from "../components/Facing.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Settings } from "../components/Settings.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Collider } from "../components/Collider.js";
import { Vitality } from "../components/Vitality.js";
import { isWalkable } from "../environment/dungeon/tileMap.js";
import { getTileQuerySnapshot, forEachItemAt } from "../utils/tileQueryCache.js";
import { combatSeed, mulberry32 } from "../utils/rng.js";
import { statusStrength } from "../utils/statusFacade.js";
import {
  addItemEntityToInventory,
  findInventoryStackTargetForItem,
} from "../utils/inventoryStacking.js";
import { resolveBump } from "../data/bumpResolvers.js";
import { Web } from "../archetypes/RoomFeatures.js";
import { createFrom } from "../../lib/ecs-js/archetype.js";
import { DoorState } from "../components/DoorState.js";
import { Encumbrance } from "../components/Encumbrance.js";

/** @param {number} x @param {number} y */
function key(x, y) { return `${x},${y}`; }

/** @param {any} world @param {number} id */
function hasIdentity(world, id, identity) {
  const ni = world.get(id, NamedIdentity);
  return String(ni?.identity || "").toLowerCase() === identity;
}

/** @param {any} world @param {import('../utils/tileQueryCache.js').TileQueryState} tiles @param {number} x @param {number} y */
function isBlockedOnlyByWebs(world, tiles, x, y) {
  const ids = tiles.byCell.get(key(x, y));
  if (!ids || ids.length === 0) return false;

  let foundBlocking = false;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const col = world.get(id, Collider);
    const vit = world.get(id, Vitality);
    const isBlocking = !!(col?.solid) || Number(vit?.hp || 0) > 0;
    if (!isBlocking) continue;
    foundBlocking = true;
    if (!hasIdentity(world, id, "web")) return false;
  }
  return foundBlocking;
}

const MISSTEP_DIRS = Object.freeze([
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],            [1, 0],
  [-1, 1],  [0, 1],   [1, 1],
]);

// ── Spider web departure listener ───────────────────────────────────

const SPIDER_WEB_INSTALLED = Symbol.for("jshack:spiderWeb:installed");

/**
 * Install a listener that spawns webs when spiders depart a tile.
 * Must be called once per world in configureWorld().
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function installSpiderWebListener(world) {
  if (!world || world[SPIDER_WEB_INSTALLED]) return;
  world[SPIDER_WEB_INSTALLED] = true;

  world.on("moved", ({ id, from }) => {
    try {
      const ni = world.get(id, NamedIdentity);
      if (ni?.identity === "spider") {
        const snap = getTileQuerySnapshot(world);
        const ids = snap.byCell.get(key(from.x, from.y));
        let hasDoor = false;
        if (ids) for (const eid of ids) {
          if (world.has(eid, DoorState)) { hasDoor = true; break; }
        }
        if (hasDoor) return;
        createFrom(world, Web, { x: from.x, y: from.y });
      }
    } catch (e) {
      console.debug("[movementSystem] spider web spawn failed:", e);
    }
  });
}

// ── Auto-pickup on arrival listener ─────────────────────────────────

const AUTO_PICKUP_INSTALLED = Symbol.for("jshack:moveAutoPickup:installed");

/**
 * Install a listener that auto-picks up items (e.g. currency) when any actor
 * with Inventory moves onto a tile. Works for all actors, not just the player.
 * Must be called once per world in configureWorld().
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function installMoveAutoPickupListener(world) {
  if (!world || world[AUTO_PICKUP_INSTALLED]) return;
  world[AUTO_PICKUP_INSTALLED] = true;

  world.on("moved", ({ id: actor, to }) => {
    try {
      const inv = world.get(actor, Inventory);
      if (!inv) return;
      const set = world.get(actor, Settings);
      if (set?.autoPickup === false) return;
      const kinds = Array.isArray(set?.autoPickupKinds) && set.autoPickupKinds.length
        ? set.autoPickupKinds : ["currency"];

      forEachItemAt(world, to.x, to.y, (itemId) => {
        if (!world.isAlive(itemId)) return;
        const ipos = world.get(itemId, Position);
        if (!ipos || ipos.x !== to.x || ipos.y !== to.y) return;
        const info = world.get(itemId, ItemInfo);
        if (!info || !info.type || !kinds.includes(info.type)) return;
        const count = info.count || 1;
        const stackTarget = findInventoryStackTargetForItem(world, inv, itemId);
        if (stackTarget) {
          addItemEntityToInventory(world, inv, itemId);
        } else {
          const ignoreCapacity = info.type === "currency";
          if (ignoreCapacity || inv.capacity == null || inv.items.length < inv.capacity) {
            addItemEntityToInventory(world, inv, itemId);
          }
        }
        try { world.emit?.("item:pickup", { actor, itemId, count }); } catch {}
      });
    } catch (e) {
      console.debug("[movementSystem] auto-pickup failed:", e);
    }
  });
}

// ── Movement system ─────────────────────────────────────────────────

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function movementSystem(world) {
  const tiles = getTileQuerySnapshot(world);
  // Start from snapshot and reserve destinations as actors move this tick.
  const blocking = new Set(tiles.blockedByCell);

  for (const [actor, intent] of world.query(MoveIntent)) {
    try {
      const pos = world.get(actor, Position);
      if (!pos) { world.remove(actor, MoveIntent); continue; }

      const intendedDx = intent.dx | 0;
      const intendedDy = intent.dy | 0;
      let mdx = intendedDx;
      let mdy = intendedDy;

      // Confusion: movement inputs become a deterministic random misstep.
      const confusePower = statusStrength(world, actor, "confused");
      if (confusePower > 0 && (intendedDx !== 0 || intendedDy !== 0)) {
        const options = MISSTEP_DIRS.filter(([dx, dy]) => !(dx === intendedDx && dy === intendedDy));
        if (options.length > 0) {
          const posSalt = (((pos.x | 0) & 0xffff) << 16) ^ ((pos.y | 0) & 0xffff);
          const r = mulberry32(combatSeed(world.seed, world.step, actor, posSalt, 0xC0F00D11));
          const idx = (r() * options.length) | 0;
          [mdx, mdy] = options[idx];
          try {
            world.emit?.("status:confused-misstep", {
              actor,
              from: { dx: intendedDx, dy: intendedDy },
              to: { dx: mdx, dy: mdy },
            });
          } catch (e) { console.debug("[movementSystem] emit status:confused-misstep failed:", e); }
        }
      }

      // Overloaded actors cannot move diagonally; force to dominant axis.
      if (mdx !== 0 && mdy !== 0) {
        const enc = /** @type {any} */ (world.get(actor, Encumbrance));
        if (enc?.overloaded) {
          if (Math.abs(intendedDx) >= Math.abs(intendedDy)) { mdy = 0; } else { mdx = 0; }
        }
      }

      const nx = pos.x + mdx;
      const ny = pos.y + mdy;
      const k = key(nx, ny);

      // Record facing direction on every move attempt (successful or not)
      if (world.has(actor, Facing)) {
        world.set(actor, Facing, { dx: mdx, dy: mdy });
      }

      const spiderCanTraverseWeb =
        hasIdentity(world, actor, "spider")
        && isWalkable(nx, ny)
        && blocking.has(k)
        && tiles.blockedByCell.has(k)
        && isBlockedOnlyByWebs(world, tiles, nx, ny);

      if (!isWalkable(nx, ny) || (blocking.has(k) && !spiderCanTraverseWeb)) {
        // Blocked — delegate to bump resolver dispatch table
        const target = tiles.livingByCell.get(k) || 0;
        resolveBump(world, actor, { nx, ny, mdx, mdy, target, tiles });
      } else {
        // Successful move
        const from = { x: pos.x, y: pos.y };
        world.set(actor, Position, { x: nx, y: ny });
        world.emit?.("moved", { id: actor, from, to: { x: nx, y: ny } });
        // Reserve the destination so subsequent movers can't step into the same tile
        blocking.add(k);
      }
    } catch (e) { console.error("[movementSystem] movement resolution failed:", e); }
    // Consume the intent regardless
    try { world.remove(actor, MoveIntent); } catch {}
  }
}
