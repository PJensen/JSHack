import { assertEquals } from "jsr:@std/assert";
import { getInventoryDefaultAction } from "../src/display/ui/overlay.js";

Deno.test("inventory default action: potion prefers drink over apply", () => {
  const potion = {
    id: 101,
    type: "potion",
    canApply: true,
    applyTargetCount: 2,
  };
  assertEquals(getInventoryDefaultAction(potion), "drink");
});

Deno.test("inventory default action: non-potion apply tools still default to apply", () => {
  const tool = {
    id: 202,
    type: "utility",
    canApply: true,
    applyTargetCount: 1,
  };
  assertEquals(getInventoryDefaultAction(tool), "apply");
});

