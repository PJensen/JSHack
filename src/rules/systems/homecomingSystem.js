import { Position } from "../components/Position.js";
import { DungeonState } from "../components/DungeonState.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Interactable } from "../components/Interactable.js";
import { Collider } from "../components/Collider.js";
import { transitionToDepth } from "../environment/dungeon/transition.js";
import { resolveTeleportDestination } from "../utils/teleport.js";

function getDungeonState(world) {
  for (const [, ds] of world.query(DungeonState)) return ds;
  return null;
}

function clearReturnPortal(world, ds) {
  const portalId = Number(ds?.returnPortal?.portalId || 0) | 0;
  if (portalId > 0 && world.isAlive(portalId)) {
    try { world.destroy(portalId); } catch {}
  }
  if (ds) ds.returnPortal = null;
}

/**
 * Resolve a homecoming request at a safe app-loop boundary.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {{actor:number,anchorX:number,anchorY:number,departureDepth:number,departureX:number,departureY:number}} req
 */
export function resolveHomecomingRequest(world, req) {
  const actor = Number(req?.actor || 0) | 0;
  const anchor = { x: Number(req?.anchorX || 0) | 0, y: Number(req?.anchorY || 0) | 0 };
  const departure = {
    depth: Number(req?.departureDepth || 0) | 0,
    pos: { x: Number(req?.departureX || 0) | 0, y: Number(req?.departureY || 0) | 0 },
  };

  if (!(actor > 0) || !world.isAlive(actor)) return;

  if (departure.depth !== 0) {
    transitionToDepth(world, 0, { x: anchor.x, y: anchor.y }, { skipPostTick: true });
  }

  const homePos = resolveTeleportDestination(world, anchor, {
    maxDistance: 3,
    exclude: [anchor],
  });
  if (!homePos) {
    try { world.emit?.("teleport:failed", { actor, spellId: "homecoming", reason: "home-blocked" }); } catch {}
    return;
  }
  world.set(actor, Position, homePos);

  const dsAfter = getDungeonState(world);
  if (!dsAfter) return;
  clearReturnPortal(world, dsAfter);

  const portalSpot = { x: anchor.x, y: anchor.y };
  if (departure.depth === 0) {
    try { world.emit?.("teleport:home", { actor, from: departure, to: { depth: 0, pos: homePos } }); } catch {}
    return;
  }

  const portalId = world.create();
  world.add(portalId, Position, portalSpot);
  world.add(portalId, NamedIdentity, { name: "Return Portal", identity: "home_return_portal" });
  world.add(portalId, Collider, { solid: true, blocksSight: false });
  world.add(portalId, Interactable, {
    action: "useReturnPortal",
    params: { fromDepth: departure.depth, fromPos: departure.pos },
  });

  dsAfter.returnPortal = {
    portalId,
    fromDepth: departure.depth,
    fromPos: departure.pos,
  };

  try {
    world.emit?.("portal:opened", {
      actor,
      portalId,
      at: portalSpot,
      color: "#b04dff",
      style: "swirl",
      radius: 3,
      from: departure,
    });
    world.emit?.("teleport:home", { actor, from: departure, to: { depth: 0, pos: homePos } });
  } catch {}
}
