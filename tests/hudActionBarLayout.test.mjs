import { assertEquals } from "jsr:@std/assert";
import { MOBILE_ACTION_BAR_GRID_AREAS } from "../src/display/ui/hud.js";

Deno.test("mobile action bar: row 1 has 6 action buttons, row 2 spans full width for spells+items", () => {
  // Row 1 — core action buttons
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.character, { col: "1", row: "1" });
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.pet, { col: "2", row: "1" });
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.posture, { col: "3", row: "1" });
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.pray, { col: "4", row: "1" });
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.wait, { col: "5", row: "1" });
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.shoot, { col: "6", row: "1" });
  // Row 2 — spell slots + pinned quick items
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.mobileRow2, { col: "1 / 7", row: "2" });
  // Door button removed from mobile grid
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.quickInteract, undefined);
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.pinnedQuickSlots, undefined);
});
