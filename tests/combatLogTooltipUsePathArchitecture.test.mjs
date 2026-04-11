import { assert } from "jsr:@std/assert";

Deno.test("combat log tooltip item name tap dispatches use/drink via shared tooltip", async () => {
  const path = new URL("../src/display/ui/combatLogTooltip.js", import.meta.url);
  const text = await Deno.readTextFile(path);

  assert(
    text.includes("renderItemDetails(tip, obj, {"),
    "expected combat log tooltip to pass options into renderItemDetails",
  );
  assert(
    text.includes("onNameTap: () => {"),
    "expected renderItemDetails options to include onNameTap",
  );
  assert(
    text.includes("window.dispatchEvent(new CustomEvent('ui:requestUse'"),
    "expected tooltip name tap path to dispatch ui:requestUse",
  );
  assert(
    text.includes("window.dispatchEvent(new CustomEvent('ui:requestDrink'"),
    "expected tooltip name tap path to dispatch ui:requestDrink for potions",
  );
  assert(
    text.includes("tip.style.pointerEvents = 'auto';"),
    "expected combat log item tooltip to allow interaction",
  );
});
