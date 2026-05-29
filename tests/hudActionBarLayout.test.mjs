import { assertEquals } from "jsr:@std/assert";
import { MOBILE_ACTION_BAR_GRID_AREAS } from "../src/display/ui/hud.js";

Deno.test("mobile action bar is a single row of 7 action buttons", () => {
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.character, { col: "1", row: "1" });
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.pet, { col: "2", row: "1" });
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.posture, { col: "3", row: "1" });
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.pray, { col: "4", row: "1" });
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.wait, { col: "5", row: "1" });
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.attack, { col: "6", row: "1" });
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.shoot, { col: "7", row: "1" });
  // Door and pinned slots removed from action bar grid (door cut, pins in spell dock)
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.quickInteract, undefined);
  assertEquals(MOBILE_ACTION_BAR_GRID_AREAS.pinnedQuickSlots, undefined);
});
