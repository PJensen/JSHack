import { assert } from "jsr:@std/assert";

Deno.test("combatSystem uses shared legacy affix dispatch helpers", async () => {
  const path = new URL("../src/rules/systems/combatSystem.js", import.meta.url);
  const text = await Deno.readTextFile(path);
  assert(
    text.includes("legacyAffixDispatch.js"),
    "combatSystem should route legacy affix hooks through shared helper code",
  );
  assert(
    !text.includes("AFFIX_DEFS"),
    "combatSystem should not walk affix definitions directly anymore",
  );
  assert(
    !text.includes("ScriptVerb.AffixOnBeforeHit") && !text.includes("ScriptVerb.AffixOnHit"),
    "combatSystem should not dispatch legacy affix scripts inline anymore",
  );
});
