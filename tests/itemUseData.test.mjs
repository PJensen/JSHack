import { assert } from "jsr:@std/assert";
import { ITEM_USE_ACTION_IDS, ITEM_USE_DEFS } from "../src/rules/data/itemUseDefs.js";
import { validateItemUseDefs } from "../src/rules/data/validate.js";

Deno.test("item-use data validates with known action kinds", () => {
  const ok = validateItemUseDefs(ITEM_USE_DEFS, { actionIds: ITEM_USE_ACTION_IDS });
  assert(ok === true, "item-use definitions should validate");
});

Deno.test("item-use data rejects unknown action kind", () => {
  const defs = structuredClone(ITEM_USE_DEFS);
  defs[0].action.kind = "unknown_action_kind";

  let threw = false;
  try {
    validateItemUseDefs(defs, { actionIds: ITEM_USE_ACTION_IDS });
  } catch {
    threw = true;
  }
  assert(threw, "validator should reject unknown item-use action kinds");
});

