import { getKernel, rebuildKernel } from "../analytic/analyticDungeon.js";

export function createGeomKernelSystem({
  geomHandleComponent,
  floorStateComponent,
  eventLogProvider = () => [],
} = {}) {
  if (!geomHandleComponent || !floorStateComponent) {
    throw new Error("GeomKernelSystem requires geomHandleComponent and floorStateComponent");
  }

  return function geomKernelSystem(world) {
    for (const [entity, handle, floorState] of world.query(geomHandleComponent, floorStateComponent)) {
      const events = eventLogProvider(handle.floorId, entity) ?? [];
      let kernel = getKernel(handle.floorId);
      if (!kernel || handle.kernelKey !== kernel.hash) {
        kernel = rebuildKernel(handle.floorId, events);
      }
      handle.kernelKey = kernel.hash;
      handle.snapshotPtr = kernel;
      handle.version = kernel.version ?? 0;
      floorState.floorId = handle.floorId;
    }
  };
}

export const __doc__ = {
  purpose: "Ensures analytic kernels are available and synchronized per floor",
  stability: "beta",
  author: "CODEX",
  version: "2025.11.11",
  notes: [
    "Rebuilds kernels when floor state hashes diverge from cached keys.",
    "Updates GeomHandle snapshot pointers for downstream systems.",
    "Runs prior to traversal to guarantee deterministic geometry availability.",
  ],
};
