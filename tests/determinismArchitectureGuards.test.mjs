import { assertEquals } from "jsr:@std/assert";
import { join } from "jsr:@std/path";

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function listJsFiles(dir) {
  const out = [];
  for await (const entry of Deno.readDir(dir)) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory) {
      out.push(...await listJsFiles(fullPath));
      continue;
    }
    if (!entry.isFile) continue;
    if (!fullPath.endsWith(".js")) continue;
    out.push(fullPath);
  }
  return out;
}

Deno.test("rules layer does not use Math.random or Date.now", async () => {
  const root = Deno.cwd();
  const rulesDir = join(root, "src", "rules");
  const files = await listJsFiles(rulesDir);
  const offenders = [];

  for (let i = 0; i < files.length; i++) {
    const absPath = files[i];
    const relPath = absPath.slice(root.length + 1);
    const text = await Deno.readTextFile(absPath);
    if (text.includes("Math.random(")) offenders.push(`${relPath}::Math.random(`);
    if (text.includes("Date.now(")) offenders.push(`${relPath}::Date.now(`);
  }

  assertEquals(offenders, [], `Rules layer must stay deterministic. Offenders: ${offenders.join(", ")}`);
});
