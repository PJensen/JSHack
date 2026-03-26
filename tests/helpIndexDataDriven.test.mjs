import { assert } from "jsr:@std/assert";

Deno.test("help index renders items and spells from canonical data sources", async () => {
  const path = new URL("../tools/help/index.html", import.meta.url);
  const text = await Deno.readTextFile(path);

  assert(
    text.includes('import { listCatalogItems } from \'../../src/rules/data/itemCatalog.js\';'),
    "item index should import listCatalogItems from itemCatalog.js",
  );
  assert(
    text.includes('import { listSpells } from \'../../src/rules/data/spells.js\';'),
    "spell index should import listSpells from spells.js",
  );
  assert(
    text.includes('document.getElementById("items-live").innerHTML'),
    "item index should render into items-live",
  );
  assert(
    text.includes('document.getElementById("spells-live").innerHTML'),
    "spell index should render into spells-live",
  );
});
