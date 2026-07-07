import { assertStringIncludes } from "jsr:@std/assert";

Deno.test("VIS effect badges intercept pointer input before canvas movement", async () => {
  const hud = await Deno.readTextFile("src/display/ui/hud.js");

  assertStringIncludes(hud, "installBadgeInputGuards");
  assertStringIncludes(hud, "stopImmediatePropagation");
  assertStringIncludes(hud, "addEventListener('pointerdown', open, { capture: true, passive: false })");
  assertStringIncludes(hud, "addEventListener('touchstart', open, { capture: true, passive: false })");
  assertStringIncludes(hud, "addEventListener('click', consume, { capture: true, passive: false })");
  assertStringIncludes(hud, "showEffectDetails");
  assertStringIncludes(hud, "renderItemDetails");
});
