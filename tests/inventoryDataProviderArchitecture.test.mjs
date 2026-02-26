import { assert } from "jsr:@std/assert";

Deno.test("inventory data provider comparison slot map uses canonical gear slots", async () => {
  const path = new URL("../src/main/ui/inventoryDataProvider.js", import.meta.url);
  const text = await Deno.readTextFile(path);
  assert(
    text.includes("Object.fromEntries(GEAR_SLOTS.map"),
    "inventory comparison slot map should be derived from canonical GEAR_SLOTS",
  );
});
