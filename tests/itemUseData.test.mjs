import { assert } from "jsr:@std/assert";
import { ITEM_USE_DEFS } from "../src/rules/data/itemUseDefs.js";
import { validateItemUseDefs } from "../src/rules/data/validate.js";

Deno.test("item-use data validates with callback actions", () => {
  const ok = validateItemUseDefs(ITEM_USE_DEFS);
  assert(ok === true, "item-use definitions should validate");
});

Deno.test("item-use data rejects non-function actions", () => {
  const defs = ITEM_USE_DEFS.map((def, i) => (i === 0 ? { ...def, run: { bad: true } } : { ...def }));

  let threw = false;
  try {
    validateItemUseDefs(defs);
  } catch {
    threw = true;
  }
  assert(threw, "validator should reject non-function item-use actions");
});
