import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Brain } from "../src/rules/components/Brain.js";
import { createPlayer } from "../src/rules/archetypes/Player.js";
import {
  FACING_CONE_BASE_DEG,
  FOV_CONE_DISABLED_KEY,
  getEntityFacingConeDegrees,
  getEntityFovConeDegrees,
  perceptionToFacingConeDegrees,
} from "../src/rules/utils/facing.js";

Deno.test("perceptionToFacingConeDegrees: fixed 200-degree baseline independent of perception", () => {
  assertEquals(perceptionToFacingConeDegrees(0), 200);
  assertEquals(perceptionToFacingConeDegrees(5), 200);
  assertEquals(perceptionToFacingConeDegrees(7), 200);
  assertEquals(perceptionToFacingConeDegrees(3), 200);
  assertEquals(perceptionToFacingConeDegrees(20), 200);
});

Deno.test("perceptionToFacingConeDegrees: override hooks still work", () => {
  assertEquals(perceptionToFacingConeDegrees(5, { baseDeg: 220 }), 200, "base clamps to max 200 by default");
  assertEquals(perceptionToFacingConeDegrees(5, { baseDeg: 160, minDeg: 150, maxDeg: 170 }), 160);
  assertEquals(perceptionToFacingConeDegrees(5, { baseDeg: 120, minDeg: 130, maxDeg: 170 }), 130);
});

Deno.test("getEntityFacingConeDegrees: debug toggle disables cone", () => {
  const world = { [FOV_CONE_DISABLED_KEY]: true, get: () => null };
  assertEquals(getEntityFacingConeDegrees(world, 1), 360);
});

Deno.test("getEntityFovConeDegrees: uses Brain.fovConeDegrees override when present", () => {
  const world = new World({ seed: 1 });
  const actor = world.create();
  world.add(actor, Brain, { fovConeDegrees: 260 });
  assertEquals(getEntityFovConeDegrees(world, actor), 260);
});

Deno.test("getEntityFovConeDegrees: falls back to default facing cone without override", () => {
  const world = new World({ seed: 1 });
  const actor = world.create();
  world.add(actor, Brain, {});
  assertEquals(getEntityFovConeDegrees(world, actor), FACING_CONE_BASE_DEG);
});

Deno.test("createPlayer: defaults player FOV cone override to 220 degrees", () => {
  const world = new World({ seed: 1 });
  const playerId = createPlayer(world, { x: 0, y: 0, name: "Hero" });
  assertEquals(getEntityFovConeDegrees(world, playerId), 220);
});
