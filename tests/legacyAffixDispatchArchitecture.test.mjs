import { assert } from "jsr:@std/assert";

Deno.test("combat runtime routes affix behavior through proc topology instead of legacy script dispatch", async () => {
  const combatPath = new URL("../src/rules/systems/combatSystem.js", import.meta.url);
  const combatText = await Deno.readTextFile(combatPath);
  assert(
    combatText.includes("affixTopology.js"),
    "combatSystem should use affix topology helpers",
  );
  assert(
    combatText.includes("procApplication.js"),
    "combatSystem should apply proc accumulator outputs",
  );
  assert(
    !combatText.includes("runLegacyAffixScripts"),
    "combatSystem should not dispatch legacy affix scripts anymore",
  );

  const damagePath = new URL("../src/rules/utils/dealDamage.js", import.meta.url);
  const damageText = await Deno.readTextFile(damagePath);
  assert(
    damageText.includes("evaluateEquippedAffixProcs"),
    "dealDamage should evaluate affix procs directly",
  );
  assert(
    !damageText.includes("runLegacyOnDamagedReactions"),
    "dealDamage should not route onDamaged through legacy affix dispatch",
  );
});
