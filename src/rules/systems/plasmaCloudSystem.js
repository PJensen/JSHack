import { hazardSystem } from "./hazardSystem.js";

export { spawnPlasmaCloud } from "../utils/spawnPlasmaCloud.js";

/**
 * Compatibility shim: plasma cloud ticking is now handled by hazardSystem.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function plasmaCloudSystem(world) {
  hazardSystem(world);
}
