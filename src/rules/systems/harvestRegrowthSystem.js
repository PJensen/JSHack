import { HarvestNode } from "../components/HarvestNode.js";
import { Collider } from "../components/Collider.js";
import { WeatherState } from "../components/WeatherState.js";

/**
 * Tick regrowth countdown for harvested nodes.
 * When countdown reaches zero, node becomes ready again.
 * Growth only occurs while it is raining.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
export function harvestRegrowthSystem(world) {
  // Only grow during rain.
  let raining = false;
  for (const [, ws] of world.query(WeatherState)) {
    raining = ws.current === "rain" || ws.current === "heavy_rain";
    break;
  }
  if (!raining) return;

  for (const [id, node] of world.query(HarvestNode)) {
    if (node.ready) continue;
    if (node.needsPlanting) continue;
    const left = Number(node.regrowCountdown || 0);
    if (left > 1) {
      world.mutate(id, HarvestNode, (r) => { r.regrowCountdown = left - 1; });
      continue;
    }
    world.set(id, HarvestNode, {
      kind: node.kind,
      ready: true,
      regrowTurns: node.regrowTurns,
      regrowCountdown: 0,
    });
    // Regrown trees become solid again.
    if (node.kind === "tree") {
      const col = world.get(id, Collider);
      if (col) world.set(id, Collider, { solid: true, blocksSight: true });
    }
    world.emit?.("harvest:regrown", { id, kind: node.kind });
  }
}
