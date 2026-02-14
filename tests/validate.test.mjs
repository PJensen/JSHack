import { assert } from "jsr:@std/assert";
import { ITEM_CATALOG } from '../src/rules/data/itemCatalog.js';
import { AFFIX_DEFS } from '../src/rules/data/affixes.js';
import { validateAll } from '../src/rules/data/validate.js';

Deno.test("data validation passes for item catalog and affixes", () => {
  const ok = validateAll({ ITEM_CATALOG, AFFIX_DEFS });
  assert(ok === true, 'validation returns true');
});
