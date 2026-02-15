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

Deno.test("effect data includes status pass foundation keys", () => {
  const byId = new Map(EFFECT_DEFS.map((def) => [def.id, def]));
  const expected = [
    { id: "confused", keys: ["confuse", "confused"], status: "confused" },
    { id: "weakened", keys: ["weaken", "weakened"], status: "weakened" },
    { id: "cursed", keys: ["curse", "cursed"], status: "cursed" },
    { id: "blessed", keys: ["bless", "blessed"], status: "blessed" },
  ];

  for (const rec of expected) {
    const def = byId.get(rec.id);
    assert(def, `effect def '${rec.id}' should exist`);
    assert(def.operation === "none", `${rec.id} should use operation 'none'`);
    assert(Array.isArray(def.keys), `${rec.id} should define keys`);
    for (const key of rec.keys) {
      assert(def.keys.includes(key), `${rec.id} should include key '${key}'`);
    }
    assert(Array.isArray(def.statuses), `${rec.id} should define statuses`);
    assert(def.statuses.includes(rec.status), `${rec.id} should project status '${rec.status}'`);
  }
});
