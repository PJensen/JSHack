import {
  collectLightSources,
  installLightEventListeners,
} from "../src/display/lighting/sources/index.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}
const Y_TOLERANCE = 0.01;

function makeEventBus() {
  const handlers = new Map();
  return {
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(fn);
    },
    emit(event, payload) {
      const list = handlers.get(event) || [];
      for (let i = 0; i < list.length; i++) list[i](payload);
    },
  };
}

Deno.test("floating eye gaze beam lights stop at LOS blockers", () => {
  const bus = makeEventBus();
  installLightEventListeners(bus, () => ({ x: 0, y: 0 }));
  bus.emit("dungeon:transitioned");
  bus.emit("proc:gaze:charged", { actor: 2, target: 1, chargeCount: 4, total: 8 });

  const baseView = {
    player: { id: 1, pos: { x: 5, y: 0 } },
    entities: [
      { id: 1, kind: "player", pos: { x: 5, y: 0 }, tags: [] },
      { id: 2, kind: "floating_eye", pos: { x: 0, y: 0 }, tags: [] },
    ],
    playerVisionRadius: 6,
    playerFacing: null,
    playerConeDegrees: 360,
  };

  const openLights = collectLightSources({
    ...baseView,
    isBlockedVision: () => false,
  });
  const openBeamFar = openLights.some((light) => light.x > 3 && Math.abs(light.y - 0.5) < Y_TOLERANCE);
  assert(openBeamFar, "expected gaze beam samples to reach past x>3 with clear LOS");

  const blockedLights = collectLightSources({
    ...baseView,
    isBlockedVision: (x, y) => x === 2 && y === 0,
  });
  const blockedBeamFar = blockedLights.some((light) => light.x > 2.1 && Math.abs(light.y - 0.5) < Y_TOLERANCE);
  assert(!blockedBeamFar, "expected gaze beam samples to stop before wall blocker");

  bus.emit("dungeon:transitioned");
});
