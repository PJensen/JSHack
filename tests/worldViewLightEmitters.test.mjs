import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { buildWorldView } from "../src/bridge/schema/worldView.js";
import { collectLightSources } from "../src/display/lighting/sources/index.js";
import { Position } from "../src/rules/components/Position.js";
import { LightEmitter } from "../src/rules/components/LightEmitter.js";

Deno.test("WorldView projects scalar light emitters", () => {
  const world = new World({ seed: 0x11947 });
  const id = world.create();
  world.add(id, Position, { x: 7, y: 9 });
  world.add(id, LightEmitter, {
    radius: 3.5,
    shadowSoftness: 5,
    temporalPattern: "pulse",
    phaseSeed: 17,
    intensityScale: 0.75,
    colorShiftScale: 0.4,
    baseColor: [120, 200, 255],
  });

  const view = buildWorldView(world);
  assertEquals(view.lightEmitters, [{
    id,
    pos: { x: 7, y: 9 },
    radius: 3.5,
    shadowSoftness: 5,
    temporalPattern: "pulse",
    phaseSeed: 17,
    intensityScale: 0.75,
    colorShiftScale: 0.4,
    voidStrength: null,
    baseColor: [120, 200, 255],
  }]);
});

Deno.test("LightEmitter stores one flat authored light, not an emitter list", () => {
  const world = new World({ seed: 0x11947 });
  const id = world.create();
  world.add(id, Position, { x: 2, y: 4 });
  world.add(id, LightEmitter, {
    radius: 3,
    shadowSoftness: 8,
    temporalPattern: "ember",
    baseColor: [255, 120, 40],
  });

  const light = world.get(id, LightEmitter);
  assert(!("emitters" in light));
  assertEquals(light.baseColor, [255, 120, 40]);
  assertEquals(buildWorldView(world).lightEmitters.length, 1);
});

Deno.test("collectLightSources consumes authored light emitters", () => {
  const lights = collectLightSources({
    turn: 1,
    player: null,
    lightEmitters: [{
      id: 4,
      pos: { x: 8, y: 3 },
      radius: 2.8,
      shadowSoftness: 5,
      temporalPattern: "void",
      phaseSeed: 0,
      intensityScale: 1,
      colorShiftScale: 1,
      voidStrength: 0.65,
      baseColor: [155, 120, 255],
    }],
    entities: [{ id: 4, kind: "void_crack", pos: { x: 8, y: 3 }, tags: [] }],
  }, { fxTime: 1, dt: 0.016 });

  assert(lights.some((light) => light.kind === "void" && light.x === 8.5 && light.radius === 2.8));
  assertEquals(lights.filter((light) => light.kind === "void" && light.x === 8.5).length, 1);
});
