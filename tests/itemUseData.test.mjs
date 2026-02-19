import { assert } from "jsr:@std/assert";
import {
  USE_EFFECT_PAYLOADS,
  USE_ITEM_MATCHER_PAYLOADS,
  USE_ITEM_PAYLOADS,
} from "../src/rules/content/items/usePayloads.js";
import {
  validateUseEffectPayloads,
  validateUseItemPayloads,
  validateUseMatcherPayloads,
} from "../src/rules/data/validate.js";

Deno.test("use payload registries validate", () => {
  assert(validateUseItemPayloads(USE_ITEM_PAYLOADS) === true, "direct use payloads should validate");
  assert(validateUseMatcherPayloads(USE_ITEM_MATCHER_PAYLOADS) === true, "matcher use payloads should validate");
  assert(validateUseEffectPayloads(USE_EFFECT_PAYLOADS) === true, "effect use payloads should validate");
});

Deno.test("matcher use payload data rejects non-function onUse", () => {
  const defs = USE_ITEM_MATCHER_PAYLOADS.map((def, i) => (i === 0 ? { ...def, onUse: { bad: true } } : { ...def }));

  let threw = false;
  try {
    validateUseMatcherPayloads(defs);
  } catch {
    threw = true;
  }
  assert(threw, "validator should reject non-function onUse hook");
});
