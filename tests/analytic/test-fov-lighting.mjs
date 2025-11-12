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
import { createLightingBakeSystem } from "../../src/rules/systems/lightingBakeSystem.js";
import { createKernelPrewarmSystem } from "../../src/rules/systems/kernelPrewarmSystem.js";
import { createFloorActivationSystem } from "../../src/rules/systems/floorActivationSystem.js";
import { propagateLightThroughPortal } from "../../src/rules/analytic/lightingAccel.js";

const FloorRef = defineComponent("FloorRef", { floorId: 1 });
const Position = defineComponent("Position", { x: 0, y: 0 });
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
const DungeonLevel = defineComponent("DungeonLevel", {
  levelId: "",
  floors: [],
  activeFloorId: 0
});

function identityTransform() {
  return {
    apply(p) {
      return { x: p.x, y: p.y };
    }
  };
}

resetRegistries();
resetSystems();

for (let floor = 1; floor <= 3; floor++) {
  registerFloorDefinition(floor, {
    primitives: [
      { type: "solid-box", min: { x: -4, y: -4 }, max: { x: 4, y: 4 } }
    ],
    version: 1,
    levelArgs: { id: "atrium" },
    floorArgs: { id: floor }
  });
}

registerPortalV({
  id: "atrium-core",
  fromFloor: 1,
  toFloor: 2,
  shape2D: { type: "circle", center: { x: 0, y: 0 }, radius: 0.75 },
  transformAB: identityTransform(),
  transformBA: identityTransform(),
  visAttn: 0.4,
  canSeeThrough: true
});

registerPortalV({
  id: "blocked-upper",
  fromFloor: 2,
  toFloor: 3,
  shape2D: { type: "circle", center: { x: 0, y: 0 }, radius: 0.5 },
  transformAB: identityTransform(),
  transformBA: identityTransform(),
  canSeeThrough: false,
  canTraverse: false
});

const world = new World();
const cache = new KernelCache(4);

for (let floor = 1; floor <= 3; floor++) {
  const entity = world.create();
  world.add(entity, GeomHandle, { floorId: floor });
  world.add(entity, FloorState, { floorId: floor });
  world.add(entity, LightingAccelHandle, { floorId: floor });
}

const levelEntity = world.create();
world.add(levelEntity, DungeonLevel, { levelId: "atrium", floors: [1, 2, 3], activeFloorId: 1 });

const actor = world.create();
world.add(actor, FloorRef, { floorId: 1 });
world.add(actor, Position, { x: 0, y: 0 });

const activationState = { activeFloors: new Set(), pausedFloors: new Map() };

registerSystem(
  createGeomKernelSystem({ geomHandleComponent: GeomHandle, floorStateComponent: FloorState }),
  "pre"
);
registerSystem(
  createLightingBakeSystem({
    lightingAccelComponent: LightingAccelHandle,
    geomHandleComponent: GeomHandle,
    lightProvider: (floorId) => [{ position: { x: 0, y: 0 }, intensity: floorId === 1 ? 1 : 0 }],
    ttl: 5
  }),
  "post"
);
registerSystem(
  createKernelPrewarmSystem({
    floorRefComponent: FloorRef,
    positionComponent: Position,
    cache,
    radius: 2,
    portalsAccessor: getPortalsV
  }),
  "pre"
);
registerSystem(
  createFloorActivationSystem({
    dungeonLevelComponent: DungeonLevel,
    onUpdate: ({ activeFloors, pausedFloors }) => {
      activationState.activeFloors = activeFloors;
      activationState.pausedFloors = pausedFloors;
    }
  }),
  "post"
);

world.setScheduler(composeScheduler("pre", "post"));

for (let i = 0; i < 10; i++) {
  world.tick();
}

const geomEntries = world.query(GeomHandle, LightingAccelHandle);
for (const [, geom, lighting] of geomEntries) {
  if (!geom.snapshotPtr) {
    continue;
  }
  assert.ok(lighting.accelPtr, "Lighting accelerator should be baked");
  assert.ok(lighting.version >= geom.snapshotPtr.version, "Lighting version must track kernel version");
}

const portalsFloor1 = getPortalsV(1);
assert.equal(portalsFloor1.length, 1, "Floor 1 should expose atrium portal");
const atriumPortal = portalsFloor1[0];

const propagated = propagateLightThroughPortal({ position: { x: 0, y: 0 }, intensity: 1, floorId: 1 }, atriumPortal);
assert.ok(propagated, "Light should propagate through see-through portal");
assert.equal(propagated.floorId, atriumPortal.toFloor, "Light should land on connected floor");
assert.ok(Math.abs(propagated.intensity - 0.4) < 1e-6, "Attenuation should match visAttn");

const portalsFloor2 = getPortalsV(2);
const blockedPortal = portalsFloor2.find((p) => p.id === "blocked-upper" && p.toFloor === 3);
assert.ok(blockedPortal, "Blocked portal should be indexed on floor 2");
const blocked = propagateLightThroughPortal({ position: { x: 0, y: 0 }, intensity: 1, floorId: 2 }, blockedPortal);
assert.equal(blocked, null, "Opaque portal must prevent light propagation");

assert.ok(activationState.activeFloors.has(1), "Active floors set should include current floor");

console.log("test-fov-lighting ✅");
