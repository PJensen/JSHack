import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import {
  createTeleportFxController,
  teleportVeilAlpha,
} from "../src/display/fx/teleportFxController.js";
import { Teleported } from "../src/events/Teleported.js";

Deno.test("player teleport snaps the camera and reveals through an opaque veil", () => {
  const world = new World({ seed: 1 });
  const cam = { x: 1, y: 2, targetX: 1, targetY: 2 };
  const fx = createTeleportFxController({ world, cam, isPlayer: (id) => id === 7 });

  world.emit("teleported", { id: 8, to: { x: 40, y: 50 } });
  assertEquals(cam.x, 1, "non-player teleports should not move the camera");
  world.emit(new Teleported({ id: 7, to: { x: 12, y: -4 } }));

  assertEquals(cam, { x: 12, y: -4, targetX: 12, targetY: -4 });
  assert(fx.active);
  assertEquals(teleportVeilAlpha(0), 1);
  fx.tick(1);
  assertEquals(fx.active, false);
  assertEquals(teleportVeilAlpha(1), 0);
});
