import { assertEquals } from "jsr:@std/assert";
import { join } from "jsr:@std/path";

async function filesUnder(dir) {
  const out = [];
  for await (const entry of Deno.readDir(dir)) {
    const path = join(dir, entry.name);
    if (entry.isDirectory) out.push(...await filesUnder(path));
    else if (entry.isFile && path.endsWith(".js")) out.push(path);
  }
  return out;
}

Deno.test("ordinary healing cannot bypass applyHealing", async () => {
  const root = Deno.cwd();
  const allowed = new Set([
    "src/rules/utils/applyHealing.js",
    "src/rules/utils/deathModes.js",
  ]);
  const offenders = [];
  for (const abs of await filesUnder(join(root, "src"))) {
    const rel = abs.slice(root.length + 1);
    if (allowed.has(rel)) continue;
    const text = await Deno.readTextFile(abs);
    if (/\.hp\s*=\s*Math\.min\s*\(|\.hp\s*\+=/.test(text)) offenders.push(rel);
  }
  assertEquals(offenders, [], "HP restoration must use the canonical applyHealing pipeline.");
});

Deno.test("rules do not consume healed presentation receipts", async () => {
  const root = Deno.cwd();
  const offenders = [];
  for (const abs of await filesUnder(join(root, "src/rules"))) {
    const text = await Deno.readTextFile(abs);
    if (/world\.on\s*\(\s*["']healed["']/.test(text)) offenders.push(abs.slice(root.length + 1));
  }
  assertEquals(offenders, [], "Rules reactions must consume HealingApplied records.");
});
