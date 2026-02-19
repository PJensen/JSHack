import { assertEquals } from "jsr:@std/assert";

const COMBAT_FILES = Object.freeze([
  "src/rules/systems/combatSystem.js",
  "src/rules/systems/rangedAttackSystem.js",
]);

const FORBIDDEN_TOKENS = Object.freeze([
  "statusStrength(",
  "HUNGER_COMBAT_LEVELS",
  "'stoneskin'",
  "\"stoneskin\"",
  "'weakened'",
  "\"weakened\"",
  "'cursed'",
  "\"cursed\"",
  "'blessed'",
  "\"blessed\"",
  "'disease'",
  "\"disease\"",
]);

Deno.test("combat hit systems consume stat pipeline resolver (no inline status-name checks)", async () => {
  const root = Deno.cwd();
  const offenders = [];

  for (let i = 0; i < COMBAT_FILES.length; i++) {
    const relPath = COMBAT_FILES[i];
    const absPath = `${root}/${relPath}`;
    const text = await Deno.readTextFile(absPath);

    for (let t = 0; t < FORBIDDEN_TOKENS.length; t++) {
      const token = FORBIDDEN_TOKENS[t];
      if (text.includes(token)) offenders.push(`${relPath}::${token}`);
    }

    if (!text.includes("resolveCombatSnapshot(")) {
      offenders.push(`${relPath}::missing resolveCombatSnapshot usage`);
    }
  }

  assertEquals(
    offenders,
    [],
    `Combat hit systems must stay stat-pipeline-only. Offenders: ${offenders.join(", ")}`,
  );
});
