// src/rules/utils/spawnWeb.js
// Canonical web-creation helper.  Every code-path that places a web on the
// map should go through this function so that webs are:
//   • attached to the current floor (and therefore cleaned up on floor change)
//   • never placed on doors
//   • never doubled-up on a tile that already has one
//   • subject to fire / clearWeb interactions like every other web

import { Position } from "../components/Position.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { DoorState } from "../components/DoorState.js";
import { Web } from "../archetypes/RoomFeatures.js";
import { createFrom } from "../../lib/ecs-js/archetype.js";
import { getTileQuerySnapshot } from "../utils/tileQueryCache.js";
import { attachEntityToCurrentFloor } from "./floorEntities.js";
import { xyKey } from "./gridKey.js";

/**
 * Spawn a canonical web entity at (x, y).
 * Returns the new entity id, or 0 if the web was not placed (door / duplicate).
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function spawnWeb(world, x, y) {
  // ── door guard ──
  const snap = getTileQuerySnapshot(world);
  const ids = snap.byCell.get(xyKey(x, y));
  if (ids) {
    for (const eid of ids) {
      if (world.has(eid, DoorState)) return 0;
    }
  }

  // ── duplicate guard ──
  for (const [, ni, pos] of world.query(NamedIdentity, Position)) {
    if (ni?.identity === "web" && pos?.x === x && pos?.y === y) return 0;
  }

  // ── create & attach to floor ──
  const webId = createFrom(world, Web, { x, y });

  attachEntityToCurrentFloor(world, webId);

  return webId;
}
