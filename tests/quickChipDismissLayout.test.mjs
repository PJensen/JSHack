import { QUICK_CHIP_DISMISS_LAYOUT } from "../src/display/ui/hud.js";

Deno.test("quick chip dismiss layout exports top-right placement contract", () => {
  if (QUICK_CHIP_DISMISS_LAYOUT.chipPosition !== "relative") {
    throw new Error("quick chip container should remain relative positioned");
  }
  if (QUICK_CHIP_DISMISS_LAYOUT.contentPaddingRight !== "34px") {
    throw new Error("quick chip content should reserve space for dismiss button");
  }
  if (QUICK_CHIP_DISMISS_LAYOUT.top !== "6px") {
    throw new Error("quick chip dismiss button should be offset from top edge");
  }
  if (QUICK_CHIP_DISMISS_LAYOUT.right !== "8px") {
    throw new Error("quick chip dismiss button should be offset from right edge");
  }
});
