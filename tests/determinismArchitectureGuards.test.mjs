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

const DETERMINISTIC_DIRS = Object.freeze([
  "src/rules",
  "src/bridge",
  "src/shared/math",
  "src/shared/events",
]);

const FORBIDDEN_RANDOM_APIS = Object.freeze([
  "Math.random(",
  "Date.now(",
  "new Date(",
  "performance.now(",
  "globalThis.crypto",
  "getRandomValues(",
]);

Deno.test("deterministic layers avoid non-deterministic random/time APIs", async () => {
  const root = Deno.cwd();
  const offenders = [];

  for (let d = 0; d < DETERMINISTIC_DIRS.length; d++) {
    const relDir = DETERMINISTIC_DIRS[d];
    const files = await listJsFiles(join(root, relDir));
    for (let i = 0; i < files.length; i++) {
      const absPath = files[i];
      const relPath = absPath.slice(root.length + 1);
      const text = await Deno.readTextFile(absPath);
      for (let t = 0; t < FORBIDDEN_RANDOM_APIS.length; t++) {
        const token = FORBIDDEN_RANDOM_APIS[t];
        if (text.includes(token)) offenders.push(`${relPath}::${token}`);
      }
    }
  }

  assertEquals(
    offenders,
    [],
    `Deterministic layers must stay random/time-source pure. Offenders: ${offenders.join(", ")}`,
  );
});
