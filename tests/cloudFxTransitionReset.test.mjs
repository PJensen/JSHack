import { assert } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createCloudFxController } from "../src/display/fx/cloudFx.js";

Deno.test("cloudFx clears plasma state on dungeon transition", () => {
  const world = new World({ seed: 123 });
  const controller = createCloudFxController({
    world,
    cam: {},
    fx: { pool: { spawn() {} } },
    getFxTime: () => 0,
    getPosition: () => null,
  });
  controller.installListeners();

  world.emit("plasmaCloud:spawned", {
    cloudId: 99,
    at: { x: 12, y: 34 },
    radius: 1,
    turnsLeft: 3,
  });

  const before = controller.getActiveLights();
  assert(before.length > 0, "plasma cloud should produce lights before transition reset");

  world.emit("dungeon:transitioned", { depth: 2, pos: { x: 0, y: 0 } });

  const after = controller.getActiveLights();
  assert(after.length === 0, "transition should clear stale plasma cloud state");
});
