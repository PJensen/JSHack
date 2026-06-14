import { assert, assertMatch } from "jsr:@std/assert";

Deno.test("Void Hole opens tile targeting before casting", async () => {
  const mainText = await Deno.readTextFile(new URL("../src/main.js", import.meta.url));
  const configStart = mainText.indexOf("const TARGETED_SPELL_CONFIG");
  const configEnd = mainText.indexOf("function getTargetedSpellConfig", configStart);
  assert(configStart >= 0 && configEnd > configStart, "TARGETED_SPELL_CONFIG should be present in main.js");

  const configText = mainText.slice(configStart, configEnd);
  assertMatch(configText, /\bvoid_hole\s*:\s*Object\.freeze\s*\(/);
  assertMatch(configText, /\bvoid_hole\s*:\s*Object\.freeze\s*\(\s*\{[\s\S]*?requiresLOS\s*:\s*true/);
});
