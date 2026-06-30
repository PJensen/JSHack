import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createSparksFxController } from "../src/display/fx/sparksFxController.js";
import { collectFxLights } from "../src/display/lighting/sources/index.js";

function makeFxHarness() {
  const spawned = [];
  return {
    spawned,
    fx: {
      pool: {
        spawn(particle) {
          spawned.push(particle);
        },
      },
    },
  };
}

Deno.test("sparks FX emits digging particles and smallest impact light half a tile forward", () => {
  const world = new World({ seed: 123 });
  const harness = makeFxHarness();
  const actor = 7;
  const controller = createSparksFxController({
    world,
    fx: harness.fx,
    getPosition: (id) => id === actor ? { x: 3, y: 3 } : null,
    isVisibleAt: () => true,
  });
  controller.installListeners();

  world.emit("tile:dug", { actor, x: 4, y: 3 });

  assert(harness.spawned.length > 0, "digging should spawn spark particles");
  assert(harness.spawned.some((p) => p.r === 255 && p.g === 255 && p.b === 255), "spark burst should start white-hot");
  assert(harness.spawned.some((p) => p.r === 255 && p.g < 220 && p.b < 120), "spark burst should include rapidly cooling flecks");

  const lights = controller.getActiveLights();
  assertEquals(lights.length, 1);
  assertEquals(lights[0].x, 3.5);
  assertEquals(lights[0].y, 3);
  assert(lights[0].radius > 0 && lights[0].radius <= 1.05, "spark light should be a very small point source");

  controller.tick(0.25);
  assertEquals(controller.getActiveLights().length, 0);
});

Deno.test("collectFxLights includes sparks controller lights", () => {
  const out = [];
  collectFxLights(out, {
    sparksFx: {
      getActiveLights() {
        return [{ x: 1, y: 2, radius: 0.5, color: [255, 255, 255] }];
      },
    },
  });
  assertEquals(out.length, 1);
  assertEquals(out[0].radius, 0.5);
});
