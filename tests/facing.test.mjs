import { assertEquals } from "jsr:@std/assert";
import { FOV_CONE_DISABLED_KEY, getEntityFacingConeDegrees, perceptionToFacingConeDegrees } from "../src/rules/utils/facing.js";

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
