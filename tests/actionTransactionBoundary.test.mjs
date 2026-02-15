import { assertEquals } from "jsr:@std/assert";

const ALLOWED_IMPORTERS = new Set([
  "src/rules/utils/actionContexts.js",
]);

async function listJsFiles(dir) {
  const out = [];
  for await (const entry of Deno.readDir(dir)) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      out.push(...await listJsFiles(full));
      continue;
    }
    if (entry.isFile && full.endsWith(".js")) out.push(full);
  }
  return out;
}

Deno.test("ActionTransaction boundary: only RuleActionContext imports mutations module", async () => {
  const root = Deno.cwd();
  const files = await listJsFiles(`${root}/src/rules`);
  const offenders = [];

  for (const absPath of files) {
    const relPath = absPath.slice(root.length + 1).replaceAll("\\", "/");
    const text = await Deno.readTextFile(absPath);
    const importsMutations = /(?:import|export)\s[\s\S]*?from\s*['"][^'"]*interaction\/mutations\.js['"]/m.test(text);
    if (!importsMutations) continue;
    if (ALLOWED_IMPORTERS.has(relPath)) continue;
    offenders.push(relPath);
  }

  assertEquals(
    offenders,
    [],
    `Only action contexts may import interaction/mutations.js. Offenders: ${offenders.join(", ")}`,
  );
});

Deno.test("no legacy MutationQueue symbol remains in rules code", async () => {
  const root = Deno.cwd();
  const files = await listJsFiles(`${root}/src/rules`);
  const offenders = [];

  for (const absPath of files) {
    const relPath = absPath.slice(root.length + 1).replaceAll("\\", "/");
    const text = await Deno.readTextFile(absPath);
    if (text.includes("MutationQueue")) offenders.push(relPath);
  }

  assertEquals(
    offenders,
    [],
    `Legacy symbol MutationQueue must not appear in src/rules. Offenders: ${offenders.join(", ")}`,
  );
});
