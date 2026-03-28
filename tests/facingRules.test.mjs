import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { FacingRules } from "../src/rules/components/FacingRules.js";
import { isFacingTurnCostEnabled, setFacingTurnCostEnabled } from "../src/rules/utils/facing.js";

Deno.test("facing rules helpers persist turn-cost toggle in component state", () => {
  const world = new World({ seed: 1 });

  assertEquals(isFacingTurnCostEnabled(world), false);
  setFacingTurnCostEnabled(world, true);
  assertEquals(isFacingTurnCostEnabled(world), true);

  let count = 0;
  for (const [, rules] of world.query(FacingRules)) {
    count += 1;
    assertEquals(rules.turnCostEnabled, true);
  }
  assertEquals(count, 1, "should keep a single FacingRules record");

  setFacingTurnCostEnabled(world, false);
  assertEquals(isFacingTurnCostEnabled(world), false);
});

