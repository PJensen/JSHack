import { assert } from "jsr:@std/assert";

Deno.test("shop checkout wires pay button after selection helpers are initialized", async () => {
  const source = await Deno.readTextFile("src/display/ui/shopOverlay.js");
  const checkoutStart = source.indexOf("if (mode === 'checkout')");
  const browseStart = source.indexOf("// Tabs", checkoutStart);
  assert(checkoutStart >= 0 && browseStart > checkoutStart, "checkout renderer block should be present");

  const checkoutSource = source.slice(checkoutStart, browseStart);
  const helperIndex = checkoutSource.indexOf("const { getSel, setSel } = createSimpleSel");
  const initialSelectionIndex = checkoutSource.indexOf("if (unpaidItems.length) setSel(0);");
  const payListenerIndex = checkoutSource.indexOf("payBtn.addEventListener('click', payBill)");

  assert(helperIndex >= 0, "checkout renderer should initialize selection helpers");
  assert(initialSelectionIndex > helperIndex, "checkout renderer must not call setSel before it exists");
  assert(payListenerIndex > initialSelectionIndex, "pay button should be wired after checkout render setup completes");
  assert(
    source.includes("const shopkeeperId = Number(data?.shopkeeperId || state?.shopkeeperId || 0) | 0;"),
    "checkout actions should use shop data as the primary shopkeeper id source",
  );
});
