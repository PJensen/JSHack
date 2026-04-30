import { assertEquals } from "jsr:@std/assert";
import { getInventoryDefaultAction, isInventoryItemUsable } from "../src/display/ui/inventoryUtils.js";
import { getQuickChipPrimaryAction } from "../src/display/ui/hud.js";

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

Deno.test("inventory use classification: equippable hook-backed items expose use without changing default action", () => {
  const sunsword = {
    id: 111,
    type: "equip",
    slot: "weapon",
    canUse: true,
    equipped: true,
  };
  assertEquals(isInventoryItemUsable(sunsword), true);
  assertEquals(getInventoryDefaultAction(sunsword), "equip");
  assertEquals(getQuickChipPrimaryAction(sunsword), "use");
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

Deno.test("inventory default action: apply-capable scrolls prioritize apply", () => {
  const scroll = {
    id: 250,
    type: "scroll",
    canApply: true,
    applyTargetCount: 2,
  };
  assertEquals(getInventoryDefaultAction(scroll), "apply");
  assertEquals(getQuickChipPrimaryAction(scroll), "apply");
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
