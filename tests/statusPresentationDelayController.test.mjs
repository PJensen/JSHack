import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createStatusPresentationDelayController } from "../src/display/fx/statusPresentationDelayController.js";

Deno.test("statusPresentationDelayController delays frozen tag until frost projectile impact", () => {
  const world = new World({ seed: 7 });
  let fxTime = 0;
  const controller = createStatusPresentationDelayController({
    world,
    getFxTime: () => fxTime,
  });
  controller.installListeners();

  const target = 42;
  const sourceView = Object.freeze({
    entities: [
      { id: target, pos: { x: 5, y: 5 }, tags: ["frozen", "burning"] },
    ],
  });

  world.emit("spell:frost", {
    targetId: target,
    projectileDelay: 0.4,
    fizzle: false,
  });

  let filtered = controller.filterWorldView(sourceView, fxTime);
  assert(filtered !== sourceView, "expected a filtered world view while delay is active");
  assertEquals(filtered.entities[0].tags, ["burning"]);
  assertEquals(sourceView.entities[0].tags, ["frozen", "burning"], "source view must remain unchanged");

  fxTime = 0.39;
  filtered = controller.filterWorldView(sourceView, fxTime);
  assertEquals(filtered.entities[0].tags, ["burning"]);

  fxTime = 0.4;
  filtered = controller.filterWorldView(sourceView, fxTime);
  assert(filtered === sourceView, "view should pass through unchanged once the delay expires");
});

Deno.test("statusPresentationDelayController ignores fizzled frost casts", () => {
  const world = new World({ seed: 8 });
  const controller = createStatusPresentationDelayController({
    world,
    getFxTime: () => 0,
  });
  controller.installListeners();

  const sourceView = {
    entities: [
      { id: 9, pos: { x: 1, y: 1 }, tags: ["frozen"] },
    ],
  };

  world.emit("spell:frost", {
    targetId: 9,
    projectileDelay: 0.4,
    fizzle: true,
  });

  assert(controller.filterWorldView(sourceView, 0) === sourceView);
});
