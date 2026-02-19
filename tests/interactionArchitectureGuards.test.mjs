import { assertEquals } from "jsr:@std/assert";
import { APPLY_PAYLOADS } from "../src/rules/content/items/applyPayloads.js";
import {
  USE_EFFECT_PAYLOADS,
  USE_ITEM_MATCHER_PAYLOADS,
  USE_ITEM_PAYLOADS,
} from "../src/rules/content/items/usePayloads.js";
import {
  validateApplyPayloads,
  validateUseEffectPayloads,
  validateUseItemPayloads,
  validateUseMatcherPayloads,
} from "../src/rules/data/validate.js";

const PIPELINES = Object.freeze([
  "src/rules/interaction/verbs/applyPipeline.js",
  "src/rules/interaction/verbs/usePipeline.js",
]);

const FORBIDDEN_TOKENS = Object.freeze([
  "data/applyDefs.js",
  "data/itemUseDefs.js",
  "findApplyDef",
  "findItemUseDef",
  "ApplyActionContext",
  "ItemApplyActionContext",
  "ItemUseActionContext",
  "ctx._world",
]);

Deno.test("apply/use pipelines do not reference legacy def/context adapters", async () => {
  const root = Deno.cwd();
  const offenders = [];

  for (let i = 0; i < PIPELINES.length; i++) {
    const relPath = PIPELINES[i];
    const absPath = `${root}/${relPath}`;
    const text = await Deno.readTextFile(absPath);
    for (let t = 0; t < FORBIDDEN_TOKENS.length; t++) {
      const token = FORBIDDEN_TOKENS[t];
      if (!text.includes(token)) continue;
      offenders.push(`${relPath}::${token}`);
    }
  }

  assertEquals(
    offenders,
    [],
    `Interaction pipelines must stay hook-native. Offenders: ${offenders.join(", ")}`,
  );
});

Deno.test("apply/use payload registries validate", () => {
  assertEquals(validateApplyPayloads(APPLY_PAYLOADS), true);
  assertEquals(validateUseItemPayloads(USE_ITEM_PAYLOADS), true);
  assertEquals(validateUseMatcherPayloads(USE_ITEM_MATCHER_PAYLOADS), true);
  assertEquals(validateUseEffectPayloads(USE_EFFECT_PAYLOADS), true);
});
