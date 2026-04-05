import { assert } from "jsr:@std/assert";

async function* walkJsFiles(root) {
  for await (const entry of Deno.readDir(root)) {
    const full = `${root}/${entry.name}`;
    if (entry.isDirectory) {
      yield* walkJsFiles(full);
      continue;
    }
    if (entry.isFile && full.endsWith(".js")) yield full;
  }
}

function importSpecifiers(source) {
  const specs = [];
  const re = /^\s*import\s+(?:[^'"]+from\s+)?["']([^"']+)["']/gm;
  for (let m = re.exec(source); m; m = re.exec(source)) specs.push(m[1]);
  return specs;
}

function refsRules(spec) {
  return spec.includes("/rules/") || spec.startsWith("../rules/") || spec.startsWith("./rules/");
}

function refsDisplay(spec) {
  return spec.includes("/display/") || spec.startsWith("../display/") || spec.startsWith("./display/");
}

Deno.test("separation: rules layer does not import display layer", async () => {
  const violations = [];
  for await (const file of walkJsFiles("src/rules")) {
    const src = await Deno.readTextFile(file);
    for (const spec of importSpecifiers(src)) {
      if (refsDisplay(spec)) violations.push(`${file} -> ${spec}`);
    }
  }
  assert(violations.length === 0, `rules/display boundary violations:\n${violations.join("\n")}`);
});

Deno.test("separation: display layer does not import rules layer", async () => {
  const violations = [];
  for await (const file of walkJsFiles("src/display")) {
    const src = await Deno.readTextFile(file);
    // spirit is exempt from this rule since it's a special case that straddles the boundary (it has display-specific code but also needs to reference rules for things like spell effects)
    if (file.includes("spirit")) continue;
    for (const spec of importSpecifiers(src)) {
      if (refsRules(spec)) violations.push(`${file} -> ${spec}`);
    }
  }
  assert(violations.length === 0, `display/rules boundary violations:\n${violations.join("\n")}`);
});
