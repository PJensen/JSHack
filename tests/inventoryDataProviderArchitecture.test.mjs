import { assert } from "jsr:@std/assert";

Deno.test("inventory data provider comparison slot map includes feet", async () => {
  const path = new URL("../src/main/ui/inventoryDataProvider.js", import.meta.url);
  const text = await Deno.readTextFile(path);
  assert(
    text.includes("feet: ['feet']") || text.includes('feet: ["feet"]'),
    "inventory comparison slot map should include feet slot",
  );
});
