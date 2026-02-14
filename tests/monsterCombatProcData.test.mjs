import { assert } from "jsr:@std/assert";
import {
  MONSTER_COMBAT_PROC_ACTION_IDS,
  MONSTER_COMBAT_PROC_DEFS,
  MONSTER_COMBAT_PROC_EMIT_PAYLOAD_IDS,
  MONSTER_COMBAT_PROC_TRIGGER_IDS,
} from "../src/rules/data/monsterCombatProcs.js";
import { validateMonsterCombatProcDefs } from "../src/rules/data/validate.js";

Deno.test("monster combat proc data validates with known enums", () => {
  const ok = validateMonsterCombatProcDefs(MONSTER_COMBAT_PROC_DEFS, {
    triggerIds: MONSTER_COMBAT_PROC_TRIGGER_IDS,
    actionIds: MONSTER_COMBAT_PROC_ACTION_IDS,
    emitPayloadIds: MONSTER_COMBAT_PROC_EMIT_PAYLOAD_IDS,
  });
  assert(ok === true, "monster combat proc defs should validate");
});

Deno.test("monster combat proc data rejects unknown action kind", () => {
  const defs = structuredClone(MONSTER_COMBAT_PROC_DEFS);
  defs[0].action.kind = "unknown_action";

  let threw = false;
  try {
    validateMonsterCombatProcDefs(defs, {
      triggerIds: MONSTER_COMBAT_PROC_TRIGGER_IDS,
      actionIds: MONSTER_COMBAT_PROC_ACTION_IDS,
      emitPayloadIds: MONSTER_COMBAT_PROC_EMIT_PAYLOAD_IDS,
    });
  } catch {
    threw = true;
  }
  assert(threw, "validator should reject unknown combat proc action kinds");
});

