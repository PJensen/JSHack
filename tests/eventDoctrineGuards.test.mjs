import { assert, assertEquals } from "jsr:@std/assert";
import { join } from "jsr:@std/path";

const SOURCE_DIRS = Object.freeze(["src/rules", "src/content"]);
const LEGACY_DIED_RULE_LISTENER_ALLOWLIST = Object.freeze([
  "src/rules/systems/deitySystem.js",
]);

async function listJsFiles(dir) {
  const out = [];
  for await (const entry of Deno.readDir(dir)) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory) {
      out.push(...await listJsFiles(fullPath));
      continue;
    }
    if (entry.isFile && fullPath.endsWith(".js")) out.push(fullPath);
  }
  return out;
}

async function sourceFiles() {
  const root = Deno.cwd();
  const files = [];
  for (const relDir of SOURCE_DIRS) {
    files.push(...await listJsFiles(join(root, relDir)));
  }
  return files.map((absPath) => absPath.slice(root.length + 1));
}

async function read(relPath) {
  return await Deno.readTextFile(join(Deno.cwd(), relPath));
}

Deno.test("rules do not consume damaged as a rule-mutation event", async () => {
  const offenders = [];
  for (const relPath of await sourceFiles()) {
    const text = await read(relPath);
    if (/world\.on\s*\(\s*['"]damaged['"]/.test(text)) offenders.push(relPath);
  }

  assertEquals(
    offenders,
    [],
    "`damaged` is a receipt. Rules/content must consume DamageApplied records instead.",
  );
});

Deno.test("legacy died rule listeners stay ratcheted while domains migrate", async () => {
  const offenders = [];
  for (const relPath of await sourceFiles()) {
    const text = await read(relPath);
    if (!/world\.on\s*\(\s*['"]died['"]/.test(text)) continue;
    if (!LEGACY_DIED_RULE_LISTENER_ALLOWLIST.includes(relPath)) offenders.push(relPath);
  }

  assertEquals(
    offenders,
    [],
    "`died` is a receipt. New or migrated rules domains must consume DeathApplied records instead.",
  );
});

Deno.test("canonical death producer emits typed receipt and records rules fact", async () => {
  const text = await read("src/rules/utils/dealDamage.js");

  assert(
    text.includes("new Died("),
    "dealDamage should formalize the death observation receipt as Died.",
  );
  assert(
    text.includes("recordDeathApplied("),
    "dealDamage should create DeathApplied for scheduled rules consumers.",
  );
  assert(
    text.includes("world.emit(diedEvent)"),
    "dealDamage should emit the typed Died receipt.",
  );
  assert(
    text.includes("world.emit('died', diedEvent.toLegacyPayload())"),
    "dealDamage should keep the legacy died receipt only as compatibility output.",
  );
});

Deno.test("new death payload code uses shared grid-point normalization", async () => {
  const checked = [
    "src/events/Died.js",
    "src/rules/utils/deathApplied.js",
    "src/shared/events/statusEvent.js",
  ];
  const offenders = [];

  for (const relPath of checked) {
    const text = await read(relPath);
    if (!text.includes("normalizeGridPoint")) offenders.push(`${relPath}::missing normalizeGridPoint`);
    if (/function\s+normalizePoint\b/.test(text)) offenders.push(`${relPath}::local normalizePoint`);
  }

  assertEquals(
    offenders,
    [],
    "Death/status payload code should reuse shared point normalization, not local copies.",
  );
});
