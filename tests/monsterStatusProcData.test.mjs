import { assert } from "jsr:@std/assert";
import { MONSTER_PROC_TRIGGER_IDS, MONSTER_STATUS_PROC_DEFS } from "../src/rules/data/monsterStatusProcs.js";
import { validateMonsterStatusProcDefs } from "../src/rules/data/validate.js";

Deno.test("monster status proc data validates with known triggers", () => {
  const ok = validateMonsterStatusProcDefs(
    MONSTER_STATUS_PROC_DEFS,
    { triggerIds: MONSTER_PROC_TRIGGER_IDS },
  );
  assert(ok === true, "monster status proc defs should validate");
});

Deno.test("monster status proc data rejects unknown trigger", () => {
  const defs = structuredClone(MONSTER_STATUS_PROC_DEFS);
  defs[0].trigger = "unknown_trigger";

  let threw = false;
  try {
    validateMonsterStatusProcDefs(defs, { triggerIds: MONSTER_PROC_TRIGGER_IDS });
  } catch {
    threw = true;
  }
  assert(threw, "validator should reject unknown monster proc triggers");
});

