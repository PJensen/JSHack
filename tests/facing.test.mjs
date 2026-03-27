import { assertEquals } from "jsr:@std/assert";
import { FOV_CONE_DISABLED_KEY, getEntityFacingConeDegrees, perceptionToFacingConeDegrees } from "../src/rules/utils/facing.js";

Deno.test("perceptionToFacingConeDegrees: baseline is 120 and scales by perception", () => {
  assertEquals(perceptionToFacingConeDegrees(5), 120);
  assertEquals(perceptionToFacingConeDegrees(7), 140);
  assertEquals(perceptionToFacingConeDegrees(3), 100);
});

Deno.test("getEntityFacingConeDegrees: debug toggle disables cone", () => {
  const world = { [FOV_CONE_DISABLED_KEY]: true, get: () => null };
  assertEquals(getEntityFacingConeDegrees(world, 1), 360);
});
