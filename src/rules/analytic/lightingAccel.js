export class LightingAccel {
  constructor(kernel2D) {
    this.kernel = kernel2D;
    this.version = kernel2D?.version ?? 0;
    this.lightSamples = [];
  }

  bake(lights = []) {
    this.lightSamples = lights.map((light) => ({ ...light }));
    this.version = Math.max(this.version, this.kernel?.version ?? 0);
    return this.lightSamples;
  }
}

export function propagateLightThroughPortal(light, portal) {
  if (!portal.canSeeThrough) {
    return null;
  }
  const mapped = portal.forward.apply(light.position);
  return {
    ...light,
    position: mapped,
    intensity: (light.intensity ?? 1) * (portal.visAttn ?? 1),
    floorId: portal.toFloor,
    path: [...(light.path ?? []), portal.id],
  };
}

export const __doc__ = {
  purpose: "Derived lighting acceleration structures for analytic dungeon",
  stability: "beta",
  author: "CODEX",
  version: "2025.11.11",
  notes: [
    "Lighting acceleration caches are derived from analytic kernels.",
    "Light propagation honours portal attenuation and visibility flags.",
    "Version field monotonically tracks underlying kernel versions.",
  ],
};
