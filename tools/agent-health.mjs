#!/usr/bin/env deno run --allow-read

async function collectFiles(root, out = []) {
  const st = await Deno.stat(root);
  if (st.isFile) {
    if (/\.(js|mjs|md)$/.test(root)) out.push(root);
    return out;
  }
  for await (const entry of Deno.readDir(root)) {
    const path = `${root.replace(/\/$/, "")}/${entry.name}`;
    if (path.includes("/.git/") || path.includes("/src/lib/")) continue;
    if (entry.isDirectory) await collectFiles(path, out);
    else if (entry.isFile && /\.(js|mjs|md)$/.test(entry.name)) out.push(path);
  }
  return out;
}

async function grep(files, re) {
  const rows = [];
  for (const file of files) {
    const text = await Deno.readTextFile(file).catch(() => "");
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) {
        re.lastIndex = 0;
        continue;
      }
      if (re.test(lines[i])) rows.push({ file, line: i + 1, text: trimmed });
      re.lastIndex = 0;
    }
  }
  return rows;
}

function layerOf(path) {
  if (path.startsWith("src/rules/")) return "rules";
  if (path.startsWith("src/display/")) return "display";
  if (path.startsWith("src/bridge/")) return "bridge";
  if (path.startsWith("src/shared/")) return "shared";
  return "other";
}

function normalizeImport(fromFile, spec) {
  if (!spec.startsWith(".")) return spec;
  const parts = fromFile.split("/").slice(0, -1);
  for (const part of spec.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

async function boundaryViolations(files) {
  const rows = [];
  const re = /\bimport(?:\s+[^"'()]+?\s+from\s+|\s*\(\s*)(["'])([^"']+)\1/g;
  for (const file of files) {
    const fromLayer = layerOf(file);
    const lines = (await Deno.readTextFile(file).catch(() => "")).split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(lines[i]))) {
        const target = normalizeImport(file, match[2]);
        const toLayer = layerOf(target);
        const bad = (fromLayer === "rules" && (toLayer === "display" || toLayer === "bridge")) ||
          (fromLayer === "display" && toLayer === "rules") ||
          (fromLayer === "shared" && toLayer !== "shared" && toLayer !== "other");
        if (bad) rows.push({ file, line: i + 1, text: `${fromLayer} -> ${toLayer}: ${match[2]}` });
      }
    }
  }
  return rows;
}

async function systemCounts() {
  const scheduler = await Deno.readTextFile("src/main/scheduler.js");
  const registered = [...scheduler.matchAll(/registerSystem\s*\(/g)].length;
  let files = 0;
  for await (const entry of Deno.readDir("src/rules/systems")) {
    if (entry.isFile && entry.name.endsWith(".js")) files += 1;
  }
  return { registered, files };
}

async function main() {
  const src = await collectFiles("src");
  const rules = src.filter((f) => f.startsWith("src/rules/"));
  const all = src.concat(await collectFiles("tools"), await collectFiles("docs"))
    .filter((file) => !file.endsWith("tools/agent-health.mjs"));
  const emitSafe = await grep(all, /\bemitSafe\b/);
  const rulesNondeterminism = await grep(rules, /\bMath\.random\b|\bDate\.now\b|\bsetTimeout\b|\bsetInterval\b|\bfetch\s*\(|\bawait\b|\bPromise\b/);
  const directSystemCalls = (await grep(rules.filter((f) => f.includes("/systems/")), /\b[A-Za-z_$][\w$]*System\s*\(\s*world\b/))
    .filter((row) => !/\bexport\s+function\s+[A-Za-z_$][\w$]*System\s*\(/.test(row.text));
  const boundaries = await boundaryViolations(src);
  const systems = await systemCounts();

  console.log("agent health");
  console.log(`files scanned: ${src.length}`);
  console.log(`systems: ${systems.registered} registered / ${systems.files} files`);
  console.log(`emitSafe refs: ${emitSafe.length}`);
  console.log(`rules nondeterminism hazards: ${rulesNondeterminism.length}`);
  console.log(`layer boundary violations: ${boundaries.length}`);
  console.log(`possible system-to-system calls: ${directSystemCalls.length}`);

  const sections = [
    ["emitSafe refs", emitSafe],
    ["rules nondeterminism hazards", rulesNondeterminism],
    ["layer boundary violations", boundaries],
    ["possible system-to-system calls", directSystemCalls],
  ];
  for (const [title, rows] of sections) {
    if (!rows.length) continue;
    console.log("");
    console.log(title + ":");
    for (const row of rows.slice(0, 30)) console.log(`  ${row.file}:${row.line} ${row.text}`);
    if (rows.length > 30) console.log(`  ... ${rows.length - 30} more`);
  }
}

await main();
