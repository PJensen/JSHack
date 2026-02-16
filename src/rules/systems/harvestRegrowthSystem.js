import { HarvestNode } from "../components/HarvestNode.js";

/**
 * Tick regrowth countdown for harvested nodes.
 * When countdown reaches zero, node becomes ready again.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
export function harvestRegrowthSystem(world) {
  for (const [id, node] of world.query(HarvestNode)) {
    if (node.ready) continue;
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
    world.emit?.("harvest:regrown", { id, kind: node.kind });
  }
}
