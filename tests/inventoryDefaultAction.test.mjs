import { assertEquals } from "jsr:@std/assert";
import { getInventoryDefaultAction } from "../src/display/ui/overlay.js";

Deno.test("inventory default action: equippable items prioritize equip", () => {
  const sword = {
    id: 101,
    type: "equip",
    slot: "weapon",
    canApply: true,
    applyTargetCount: 2,
  };
  assertEquals(getInventoryDefaultAction(sword), "equip");
});

Deno.test("inventory default action: usable non-slot items prioritize use over apply", () => {
  const potion = {
    id: 202,
    type: "potion",
    canApply: true,
    applyTargetCount: 2,
  };
  assertEquals(getInventoryDefaultAction(potion), "use");
});

Deno.test("inventory default action: apply tools default to apply only with valid targets", () => {
  const tool = {
    id: 303,
    type: "utility",
    canApply: true,
    applyTargetCount: 1,
  };
  assertEquals(getInventoryDefaultAction(tool), "apply");

  const noTargets = {
    id: 304,
    type: "utility",
    canApply: true,
    applyTargetCount: 0,
  };
  assertEquals(getInventoryDefaultAction(noTargets), "none");
});
