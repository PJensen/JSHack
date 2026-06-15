import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { buildWorldView } from "../src/bridge/schema/worldView.js";
import { collectLightSources } from "../src/display/lighting/sources/index.js";
import { Position } from "../src/rules/components/Position.js";
import { LightEmitter } from "../src/rules/components/LightEmitter.js";
import { ObjectState } from "../src/rules/components/ObjectState.js";

Deno.test("WorldView projects scalar light emitters", () => {
  const world = new World({ seed: 0x11947 });
  const id = world.create();
  world.add(id, Position, { x: 7, y: 9 });
  world.add(id, LightEmitter, {
    radius: 3.5,
    color: [120, 200, 255],
    pattern: "pulse",
    softness: 5,
  });

  const view = buildWorldView(world);
  assertEquals(view.lightEmitters, [{
    id,
    pos: { x: 7, y: 9 },
    radius: 3.5,
    color: [120, 200, 255],
    pattern: "pulse",
    softness: 5,
    voidStrength: null,
  }]);
});

Deno.test("WorldView gates scalar light emitters by object state", () => {
  const world = new World({ seed: 0x11947 });
  const id = world.create();
  world.add(id, Position, { x: 2, y: 4 });
  world.add(id, ObjectState, { state: "unlit" });
  world.add(id, LightEmitter, {
    radius: 3,
    color: [255, 120, 40],
    pattern: "ember",
    softness: 8,
    whenState: "lit",
  });

  assertEquals(buildWorldView(world).lightEmitters, []);
  world.get(id, ObjectState).state = "lit";
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
      color: [155, 120, 255],
      pattern: "void",
      softness: 5,
      voidStrength: 0.65,
    }],
    entities: [{ id: 4, kind: "void_crack", pos: { x: 8, y: 3 }, tags: [] }],
  }, { fxTime: 1, dt: 0.016 });

  assert(lights.some((light) => light.kind === "void" && light.x === 8.5 && light.radius === 2.8));
  assertEquals(lights.filter((light) => light.kind === "void" && light.x === 8.5).length, 1);
});
