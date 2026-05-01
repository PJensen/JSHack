import { HarvestNode } from "../components/HarvestNode.js";
import { Collider } from "../components/Collider.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { WeatherState } from "../components/WeatherState.js";
import { Changed } from "../../lib/ecs-js/index.js";

const HARVEST_REGROW_ACTIVE = Symbol.for("jshack:harvestRegrowth:active");
const HARVEST_REGROW_SEEDED = Symbol.for("jshack:harvestRegrowth:seeded");

const HARVEST_READY_IDENTITY = Object.freeze({
  iron_ore:      "ore_vein_iron",
  coal_ore:      "ore_vein_coal",
  stone:         "ore_vein_stone",
  berries:       "berry_bush",
  herbs:         "herb_patch",
  thorn_bramble: "thorn_bramble",
  venom_fern:    "venom_fern",
  moonleaf:      "moonleaf_cluster",
  ember_root:    "ember_root_patch",
});

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
function activeSet(world) {
  if (!world[HARVEST_REGROW_ACTIVE]) world[HARVEST_REGROW_ACTIVE] = new Set();
  return world[HARVEST_REGROW_ACTIVE];
}

/**
 * @param {any} node
 */
function shouldTrack(node) {
  if (!node) return false;
  if (node.ready) return false;
  if (node.needsPlanting) return false;
  return (Number(node.regrowCountdown || 0) | 0) > 0;
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
function seedActiveSet(world) {
  if (world[HARVEST_REGROW_SEEDED]) return;
  const active = activeSet(world);
  for (const [id, node] of world.query(HarvestNode)) {
    if (shouldTrack(node)) active.add(id | 0);
  }
  world[HARVEST_REGROW_SEEDED] = true;
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
function syncFromChanged(world) {
  const active = activeSet(world);
  for (const [id, node] of world.query(HarvestNode, Changed(HarvestNode))) {
    if (shouldTrack(node)) active.add(id | 0);
    else active.delete(id | 0);
  }
}

/**
 * Tick regrowth countdown for harvested nodes.
 * When countdown reaches zero, node becomes ready again.
 * Growth only occurs while it is raining.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
export function harvestRegrowthSystem(world) {
  seedActiveSet(world);
  syncFromChanged(world);

  // Most plants only grow during rain. Fishing spots are water-bound and
  // replenish on their own cooldown.
  let raining = false;
  for (const [, ws] of world.query(WeatherState)) {
    raining = ws.current === "rain" || ws.current === "heavy_rain";
    break;
  }

  const active = activeSet(world);
  for (const id of active) {
    if (!world.isAlive(id)) {
      active.delete(id);
      continue;
    }
    const node = world.get(id, HarvestNode);
    if (!shouldTrack(node)) {
      active.delete(id);
      continue;
    }
    if (!raining && String(node.kind || "") !== "fishing_spot") continue;
    const left = Number(node.regrowCountdown || 0);
    if (left > 1) {
      world.mutate(id, HarvestNode, (r) => { r.regrowCountdown = left - 1; });
      continue;
    }
    world.mutate(id, HarvestNode, (r) => {
      r.ready = true;
      r.regrowCountdown = 0;
      if (String(r.kind || "") === "fishing_spot") {
        r.fishingPressure = Math.max(0, (Number(r.fishingPressure || 0) | 0) - 1);
        r.overfished = r.fishingPressure >= 4;
      }
    });
    active.delete(id);
    // Regrown trees and mushrooms become solid again.
    if (node.kind === "tree" || node.kind === "mushrooms") {
      const col = world.get(id, Collider);
      if (col) {
        world.set(id, Collider, {
          solid: true,
          blocksSight: node.kind === "tree",
        });
      }
    }
    if (node.kind === "mushrooms") {
      const ni = world.get(id, NamedIdentity);
      if (ni) {
        world.set(id, NamedIdentity, {
          ...ni,
          name: "Mushrooms",
          identity: "mushrooms",
        });
      }
    }
    // Ore veins and plant nodes: re-enable collider and restore ready glyph.
    const readyIdentity = HARVEST_READY_IDENTITY[node.kind];
    if (readyIdentity) {
      const col = world.get(id, Collider);
      if (col) world.set(id, Collider, { solid: true, blocksSight: false });
      const ni = world.get(id, NamedIdentity);
      if (ni) world.set(id, NamedIdentity, { ...ni, identity: readyIdentity });
    }
    world.emit?.("harvest:regrown", { id, kind: node.kind });
  }
}
