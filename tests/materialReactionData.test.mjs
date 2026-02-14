import { assert } from "jsr:@std/assert";
import { MATERIAL_REACTION_OUTCOME_IDS, MATERIAL_REACTION_RULES } from "../src/rules/data/materialReactions.js";
import { validateMaterialReactionRules } from "../src/rules/data/validate.js";

Deno.test("material reaction data validates with known outcomes", () => {
  const ok = validateMaterialReactionRules(
    MATERIAL_REACTION_RULES,
    { outcomeIds: MATERIAL_REACTION_OUTCOME_IDS },
  );
  assert(ok === true, "material reaction validation should pass");
});

Deno.test("material reaction data rejects unknown outcomes", () => {
  const rules = structuredClone(MATERIAL_REACTION_RULES);
  rules[0].reactions[0].outcome = "unknown_outcome";

  let threw = false;
  try {
    validateMaterialReactionRules(rules, { outcomeIds: MATERIAL_REACTION_OUTCOME_IDS });
  } catch {
    threw = true;
  }
  assert(threw, "validator should reject unknown reaction outcomes");
});

