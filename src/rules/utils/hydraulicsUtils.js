import { Collider } from "../components/Collider.js";
import { HydraulicsLink } from "../components/HydraulicsLink.js";
import { ObjectState } from "../components/ObjectState.js";
import { Position } from "../components/Position.js";

/**
 * Raise or lower a single portcullis gate entity.
 * Updates ObjectState + Collider, then emits hydraulics:portcullis.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} gateId
 * @param {boolean} raised
 * @param {string} [source]
 */
export function setPortcullisRaised(world, gateId, raised, source = "hydraulics") {
  const state = raised ? "raised" : "lowered";
  world.set(gateId, ObjectState, { state });

  const col = world.get(gateId, Collider);
  const next = { solid: !raised, blocksSight: !raised };
  if (col) world.set(gateId, Collider, next);
  else world.add(gateId, Collider, next);

  const pos = world.get(gateId, Position);
  world.emit("hydraulics:portcullis", {
    gateId,
    raised: !!raised,
    state,
    source,
    at: pos ? { x: pos.x | 0, y: pos.y | 0 } : null,
  });
}

/**
 * Set all portcullis entities sharing linkId to the given raised/lowered state.
 * Returns count of gates actually changed.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {string} linkId
 * @param {boolean} raised
 * @param {string} [source]
 * @returns {number}
 */
export function setLinkedPortcullisState(world, linkId, raised, source = "hydraulics") {
  const wanted = String(linkId || "").trim();
  if (!wanted) return 0;
  let changed = 0;
  for (const [id, link] of world.query(HydraulicsLink)) {
    if (String(link?.role || "") !== "portcullis") continue;
    if (String(link?.linkId || "") !== wanted) continue;
    const currentlyRaised = String(world.get(id, ObjectState)?.state || "lowered") === "raised";
    if (currentlyRaised === !!raised) continue;
    setPortcullisRaised(world, id | 0, !!raised, source);
    changed++;
  }
  return changed;
}
