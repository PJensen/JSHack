import { assertEquals } from "jsr:@std/assert";
import { MOBILE_ACTION_BAR_GRID_AREAS } from "../src/display/ui/hud.js";

Deno.test("mobile action bar grid areas place quick slots in center and shoot/pray on right", () => {
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.character, { col: "1", row: "1" });
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.pet, { col: "2", row: "1" });
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.pray, { col: "5", row: "1" });
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.shoot, { col: "6", row: "1" });
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.quickInteract, { col: "1", row: "2" });
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.wait, { col: "6", row: "2" });
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.pinnedQuickSlots, { col: "3 / 5", row: "1 / 3" });
});
