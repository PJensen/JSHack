import assert from "node:assert/strict";
import {
  World,
  defineComponent,
  registerSystem,
  composeScheduler,
  resetSystems
} from "../helpers/ecsHarness.mjs";
import {
  registerFloorDefinition,
  registerPortalV,
  resetRegistries,
  getPortalsV
} from "../../src/rules/analytic/analyticDungeon.js";
import { KernelCache } from "../../src/rules/analytic/kernelCache.js";
import { createGeomKernelSystem } from "../../src/rules/systems/geomKernelSystem.js";
import { createKernelPrewarmSystem } from "../../src/rules/systems/kernelPrewarmSystem.js";
import { createPortalUseSystem } from "../../src/rules/systems/portalUseSystem.js";
import { createLightingBakeSystem } from "../../src/rules/systems/lightingBakeSystem.js";

const FloorRef = defineComponent("FloorRef", { floorId: 1 });
const Position = defineComponent("Position", { x: 0, y: 0 });
const FacingState = defineComponent("FacingState", {
  facing: 0
});
const PortalTrace = defineComponent("PortalTrace", {
  portalId: "",
  fromFloor: 0,
  toFloor: 0,
  entryPosA: { x: 0, y: 0 },
  exitPosB: { x: 0, y: 0 },
  expiresAtTick: 0
});
const GeomHandle = defineComponent("GeomHandle", {
  floorId: 0,
  kernelKey: "",
  snapshotPtr: null,
  version: 0
});
const FloorState = defineComponent("FloorState", {
  floorId: 0,
  doorStatesHash: "",
  dynamicEditsHash: ""
});
const LightingAccelHandle = defineComponent("LightingAccelHandle", {
  floorId: 0,
  accelPtr: null,
  version: 0,
  ttlTicks: 0
});

const LIGHT_PROVIDER = () => [{ position: { x: 0, y: 0 }, intensity: 1 }];

function identityTransform() {
  return {
    apply(p) {
      return { x: p.x, y: p.y };
    }
  };
}

resetRegistries();
resetSystems();

registerFloorDefinition(1, {
  primitives: [
    { type: "solid-box", min: { x: -5, y: -5 }, max: { x: 5, y: 5 } }
  ],
  version: 1,
  levelArgs: { id: "test" },
  floorArgs: { id: 1 }
});

registerFloorDefinition(2, {
  primitives: [
    { type: "solid-box", min: { x: -5, y: -5 }, max: { x: 5, y: 5 } }
  ],
  version: 1,
  levelArgs: { id: "test" },
  floorArgs: { id: 2 }
});

registerPortalV({
  id: "stairs",
  fromFloor: 1,
  toFloor: 2,
  shape2D: { type: "circle", center: { x: 0, y: 0 }, radius: 0.5 },
  transformAB: identityTransform(),
  transformBA: identityTransform(),
  reentrySnapEpsilon: 0.05,
  arrivalFacing: Math.PI / 2
});

const world = new World();
const cache = new KernelCache(4);

const floor1 = world.create();
world.add(floor1, GeomHandle, { floorId: 1 });
world.add(floor1, FloorState, { floorId: 1 });
world.add(floor1, LightingAccelHandle, { floorId: 1 });

const floor2 = world.create();
world.add(floor2, GeomHandle, { floorId: 2 });
world.add(floor2, FloorState, { floorId: 2 });
world.add(floor2, LightingAccelHandle, { floorId: 2 });

const actor = world.create();
world.add(actor, FloorRef, { floorId: 1 });
world.add(actor, Position, { x: 0, y: 0 });
world.add(actor, FacingState, { facing: 0 });

registerSystem(
  createGeomKernelSystem({ geomHandleComponent: GeomHandle, floorStateComponent: FloorState }),
  "pre"
);
registerSystem(
  createLightingBakeSystem({
    lightingAccelComponent: LightingAccelHandle,
    geomHandleComponent: GeomHandle,
    lightProvider: LIGHT_PROVIDER
  }),
  "post"
);
registerSystem(
  createKernelPrewarmSystem({
    floorRefComponent: FloorRef,
    positionComponent: Position,
    cache,
    radius: 1.5,
    portalsAccessor: getPortalsV
  }),
  "pre"
);
registerSystem(
  createPortalUseSystem({
    floorRefComponent: FloorRef,
    positionComponent: Position,
    facingComponent: FacingState,
    portalTraceComponent: PortalTrace,
    ttlTicks: 50,
    portalEpsilon: 0.5,
    portalsAccessor: getPortalsV
  }),
  "simulation"
);

world.setScheduler(composeScheduler("pre", "simulation", "post"));

const floorRef = world.get(actor, FloorRef);
const position = world.get(actor, Position);
const facingState = world.get(actor, FacingState);
const startPos = { ...position };

const iterations = 100;
for (let i = 0; i < iterations; i++) {
  world.tick();
  assert.equal(floorRef.floorId, 2, "Actor should be on floor 2 after descending");
  world.tick();
  assert.equal(floorRef.floorId, 1, "Actor should return to floor 1 via re-entry");
  const drift = Math.hypot(position.x - startPos.x, position.y - startPos.y);
  assert.ok(drift < 1e-4, `Round-trip drift exceeded tolerance: ${drift}`);
}

const events = world.consumeEvents("FloorChanged");
assert.equal(events.length, iterations * 2, "Expected floor change event for each traversal");
for (let i = 1; i < events.length; i++) {
  assert.ok(events[i].seq > events[i - 1].seq, "FloorChanged events must have strictly increasing sequence");
}

assert.ok(cache.hitRate() >= 0.99, `Kernel cache hit rate too low: ${cache.hitRate()}`);
assert.equal(floorRef.floorId, 1, "Actor should end on original floor");
assert.ok(Math.abs(facingState.facing - Math.PI / 2) < 1e-6, "Arrival facing should be applied");

console.log("test-roundtrip ✅");
