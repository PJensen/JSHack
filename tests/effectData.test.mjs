import { assert } from "jsr:@std/assert";
import { EFFECT_DEFS, EFFECT_OPERATION_IDS } from "../src/rules/data/effectDefs.js";
import { validateEffectDefs } from "../src/rules/data/validate.js";

Deno.test("effect data validates with known operations", () => {
  const ok = validateEffectDefs(EFFECT_DEFS, { operationIds: EFFECT_OPERATION_IDS });
  assert(ok === true, "effect defs should validate");
});

Deno.test("effect data rejects unknown operation", () => {
  const defs = structuredClone(EFFECT_DEFS);
  defs[0].operation = "unknown_operation";

  let threw = false;
  try {
    validateEffectDefs(defs, { operationIds: EFFECT_OPERATION_IDS });
  } catch {
    threw = true;
  }
  assert(threw, "validator should reject unknown effect operations");
});

