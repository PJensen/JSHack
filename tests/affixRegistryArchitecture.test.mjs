import { assertEquals } from "jsr:@std/assert";

const RUNTIME_FILES = Object.freeze([
  "src/rules/utils/passiveBonuses.js",
  "src/rules/utils/legacyAffixDispatch.js",
  "src/rules/data/lootResolver.js",
  "src/main/wiring/itemName.js",
  "src/main/ui/hudFeeds.js",
]);

Deno.test("runtime affix consumers go through affix registry accessors", async () => {
  const root = Deno.cwd();
  const offenders = [];

  for (let i = 0; i < RUNTIME_FILES.length; i++) {
    const relPath = RUNTIME_FILES[i];
    const absPath = `${root}/${relPath}`;
    const text = await Deno.readTextFile(absPath);
    if (text.includes("AFFIX_DEFS")) offenders.push(relPath);
  }

  assertEquals(
    offenders,
    [],
    `Runtime affix consumers should not read AFFIX_DEFS directly. Offenders: ${offenders.join(", ")}`,
  );
});
