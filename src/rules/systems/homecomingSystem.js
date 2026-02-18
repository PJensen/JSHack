import { HomecomingIntent } from "../components/Intents/HomecomingIntent.js";
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

export function homecomingSystem(world) {
  for (const [actor, intent] of world.query(HomecomingIntent)) {
    try {
      const anchor = { x: intent.anchorX | 0, y: intent.anchorY | 0 };
      const departure = {
        depth: intent.departureDepth | 0,
        pos: { x: intent.departureX | 0, y: intent.departureY | 0 },
      };

      if (departure.depth !== 0) {
        transitionToDepth(world, 0, { x: anchor.x, y: anchor.y }, { skipPostTick: true });
      }

      const homePos = resolveTeleportDestination(world, anchor, { maxDistance: 3 });
      if (!homePos) {
        try { world.emit?.("teleport:failed", { actor, spellId: "homecoming", reason: "home-blocked" }); } catch {}
        continue;
      }
      world.set(actor, Position, homePos);

      const dsAfter = getDungeonState(world);
      if (!dsAfter) continue;
      clearReturnPortal(world, dsAfter);

      const portalSpot = resolveTeleportDestination(world, anchor, {
        maxDistance: 3,
        exclude: [homePos],
      });
      if (!portalSpot || departure.depth === 0) {
        try { world.emit?.("teleport:home", { actor, from: departure, to: { depth: 0, pos: homePos } }); } catch {}
        continue;
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
    } finally {
      try { world.remove(actor, HomecomingIntent); } catch {}
    }
  }
}
