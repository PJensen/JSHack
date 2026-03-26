import { assertEquals } from "jsr:@std/assert";
import { MOBILE_ACTION_BAR_GRID_AREAS } from "../src/display/ui/hud.js";

Deno.test("mobile action bar grid areas place quick slots on right 2x2 and shoot on bottom row", () => {
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.character, { col: "1", row: "1" });
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.pet, { col: "2", row: "1" });
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.pray, { col: "1", row: "2" });
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.wait, { col: "2", row: "2" });
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.shoot, { col: "3", row: "2" });
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.pinnedQuickSlots, { col: "4 / 6", row: "1 / 3" });
});
