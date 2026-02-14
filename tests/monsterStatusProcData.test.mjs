import { assert } from "jsr:@std/assert";
import {
  MONSTER_PROC_EVENT_SCHEMA_IDS,
  MONSTER_PROC_TARGET_IDS,
  MONSTER_PROC_TRIGGER_IDS,
  MONSTER_STATUS_PROC_DEFS,
} from "../src/rules/data/monsterStatusProcs.js";
import { validateMonsterStatusProcDefs } from "../src/rules/data/validate.js";

Deno.test("monster status proc data validates with known triggers", () => {
  const ok = validateMonsterStatusProcDefs(
    MONSTER_STATUS_PROC_DEFS,
    {
      triggerIds: MONSTER_PROC_TRIGGER_IDS,
      targetIds: MONSTER_PROC_TARGET_IDS,
      eventSchemaIds: MONSTER_PROC_EVENT_SCHEMA_IDS,
    },
  );
  assert(ok === true, "monster status proc defs should validate");
});

Deno.test("monster status proc data rejects unknown trigger", () => {
  const defs = MONSTER_STATUS_PROC_DEFS.map((def, i) => (i === 0 ? { ...def, trigger: "unknown_trigger" } : { ...def }));

  let threw = false;
  try {
    validateMonsterStatusProcDefs(defs, {
      triggerIds: MONSTER_PROC_TRIGGER_IDS,
      targetIds: MONSTER_PROC_TARGET_IDS,
      eventSchemaIds: MONSTER_PROC_EVENT_SCHEMA_IDS,
    });
  } catch {
    threw = true;
  }
  assert(threw, "validator should reject unknown monster proc triggers");
});
