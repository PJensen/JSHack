import { assertEquals } from "jsr:@std/assert";
import { join } from "jsr:@std/path";
import { APPLY_PAYLOADS } from "../src/rules/content/items/applyPayloads.js";
import {
  USE_ITEM_MATCHER_PAYLOADS,
  USE_ITEM_PAYLOADS,
} from "../src/rules/content/items/usePayloads.js";
import {
  validateApplyPayloads,
  validateUseItemPayloads,
  validateUseMatcherPayloads,
} from "../src/rules/data/validate.js";

const PIPELINES = Object.freeze([
  "src/rules/interaction/verbs/applyPipeline.js",
  "src/rules/interaction/verbs/usePipeline.js",
  "src/rules/interaction/verbs/throwPipeline.js",
  "src/rules/systems/drinkSystem.js",
  "src/rules/systems/throwSystem.js",
  "src/rules/content/items/usePayloads.js",
  "src/rules/content/items/throwPayloads.js",
]);
const UI_ENTRY_FILES = Object.freeze([
  "src/main.js",
]);
const RUNTIME_ENTRY_FILES = Object.freeze([
  "src/main/scheduler.js",
]);
const PAYLOAD_CONTENT_FILES = Object.freeze([
  "src/rules/data/itemCatalog.js",
  "src/rules/content/items/itemHooks.js",
  "src/rules/content/items/usePayloads.js",
  "src/rules/content/items/throwPayloads.js",
  "src/rules/content/items/applyPayloads.js",
]);

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

const FORBIDDEN_TOKENS = Object.freeze([
  "data/applyDefs.js",
  "data/itemUseDefs.js",
  "findApplyDef",
  "findItemUseDef",
  "getDrinkPayloadByIdentity",
  "content/items/drinkPayloads.js",
  "createConsumableScriptOnUse",
  "ApplyActionContext",
  "ItemApplyActionContext",
  "ItemUseActionContext",
  "ctx._world",
]);

Deno.test("interaction runtime paths do not reference legacy def/context adapters", async () => {
  const root = Deno.cwd();
  const offenders = [];

  for (let i = 0; i < PIPELINES.length; i++) {
    const relPath = PIPELINES[i];
    const absPath = `${root}/${relPath}`;
    const text = await Deno.readTextFile(absPath);
    for (let t = 0; t < FORBIDDEN_TOKENS.length; t++) {
      const token = FORBIDDEN_TOKENS[t];
      if (!text.includes(token)) continue;
      offenders.push(`${relPath}::${token}`);
    }
  }

  assertEquals(
    offenders,
    [],
    `Interaction pipelines must stay hook-native. Offenders: ${offenders.join(", ")}`,
  );
});

Deno.test("apply/use payload registries validate", () => {
  assertEquals(validateApplyPayloads(APPLY_PAYLOADS), true);
  assertEquals(validateUseItemPayloads(USE_ITEM_PAYLOADS), true);
  assertEquals(validateUseMatcherPayloads(USE_ITEM_MATCHER_PAYLOADS), true);
});

Deno.test("UI entrypoints do not import legacy apply/use def modules", async () => {
  const root = Deno.cwd();
  const offenders = [];
  const forbidden = [
    "rules/data/applyDefs.js",
    "rules/data/itemUseDefs.js",
  ];

  for (let i = 0; i < UI_ENTRY_FILES.length; i++) {
    const relPath = UI_ENTRY_FILES[i];
    const absPath = `${root}/${relPath}`;
    const text = await Deno.readTextFile(absPath);
    for (let t = 0; t < forbidden.length; t++) {
      const token = forbidden[t];
      if (!text.includes(token)) continue;
      offenders.push(`${relPath}::${token}`);
    }
  }

  assertEquals(offenders, [], `UI must resolve through hook/payload registries. Offenders: ${offenders.join(", ")}`);
});

Deno.test("runtime scheduler does not import legacy consumable script registrations", async () => {
  const root = Deno.cwd();
  const offenders = [];
  const forbidden = [
    "rules/scripts/consumables.js",
  ];

  for (let i = 0; i < RUNTIME_ENTRY_FILES.length; i++) {
    const relPath = RUNTIME_ENTRY_FILES[i];
    const absPath = `${root}/${relPath}`;
    const text = await Deno.readTextFile(absPath);
    for (let t = 0; t < forbidden.length; t++) {
      const token = forbidden[t];
      if (!text.includes(token)) continue;
      offenders.push(`${relPath}::${token}`);
    }
  }

  assertEquals(offenders, [], `Runtime scheduler must not import legacy consumable scripts: ${offenders.join(", ")}`);
});

Deno.test("payload and hook content files do not use ctx._world escape hatch", async () => {
  const root = Deno.cwd();
  const offenders = [];

  for (let i = 0; i < PAYLOAD_CONTENT_FILES.length; i++) {
    const relPath = PAYLOAD_CONTENT_FILES[i];
    const absPath = `${root}/${relPath}`;
    const text = await Deno.readTextFile(absPath);
    if (text.includes("ctx._world")) offenders.push(relPath);
  }

  assertEquals(offenders, [], `Payload/hook files must not use ctx._world: ${offenders.join(", ")}`);
});

Deno.test("active source files do not import quarentine legacy data", async () => {
  const root = Deno.cwd();
  const srcDir = join(root, "src");
  const files = await listJsFiles(srcDir);
  const offenders = [];

  for (let i = 0; i < files.length; i++) {
    const absPath = files[i];
    const relPath = absPath.slice(root.length + 1);
    if (relPath.startsWith("src/rules/data/quarentine/")) continue;
    const text = await Deno.readTextFile(absPath);
    if (
      text.includes("rules/data/quarentine/")
      || text.includes("data/quarentine/")
    ) offenders.push(relPath);
  }

  assertEquals(offenders, [], `Quarentine files must stay unreferenced by active source: ${offenders.join(", ")}`);
});
