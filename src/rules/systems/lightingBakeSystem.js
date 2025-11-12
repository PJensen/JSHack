import { LightingAccel } from "../analytic/lightingAccel.js";

const DEFAULT_LIGHT_TTL = 12;

export function createLightingBakeSystem({
  lightingAccelComponent,
  geomHandleComponent,
  lightProvider = () => [],
  ttl = DEFAULT_LIGHT_TTL,
} = {}) {
  if (!lightingAccelComponent || !geomHandleComponent) {
    throw new Error("LightingBakeSystem requires lightingAccelComponent and geomHandleComponent");
  }
  const expiry = new Map();

  return function lightingBakeSystem(world) {
    const currentStep = world.step ?? 0;
    for (const [, lightingHandle, geomHandle] of world.query(lightingAccelComponent, geomHandleComponent)) {
      const kernel = geomHandle.snapshotPtr;
      if (!kernel) continue;
      const floorId = geomHandle.floorId;
      const kernelVersion = kernel.version ?? 0;
      let accel = lightingHandle.accelPtr;
      const needsRebuild = !accel || lightingHandle.version < kernelVersion;
      const stepExpiry = expiry.get(floorId) ?? -Infinity;
      if (needsRebuild || stepExpiry <= currentStep) {
        accel = new LightingAccel(kernel);
        const lights = lightProvider(floorId, kernel) ?? [];
        accel.bake(lights);
        lightingHandle.accelPtr = accel;
        lightingHandle.version = Math.max(kernelVersion, accel.version ?? kernelVersion);
        lightingHandle.ttlTicks = ttl;
        expiry.set(floorId, currentStep + ttl);
      }
    }
  };
}

export const __doc__ = {
  purpose: "Maintains lighting acceleration structures in sync with analytic kernels",
  stability: "beta",
  author: "CODEX",
  version: "2025.11.11",
  notes: [
    "Rebuilds derived lighting data when kernel versions change or TTL expires.",
    "Delegates light sourcing to an injectable provider for deterministic tests.",
    "Ensures LightingAccelHandle.version never lags kernel snapshots.",
  ],
};
