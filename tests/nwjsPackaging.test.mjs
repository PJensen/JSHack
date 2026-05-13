import {
  buildNwManifest,
  parseArgs,
  shouldSkipPath,
} from "../packaging/nwjs/wrap.mjs";

Deno.test("NW.js packaging parses wrapper options", () => {
  const options = parseArgs([
    "--out",
    "tmp/nw",
    "--runtime=/opt/nwjs",
    "--app-name",
    "JSHack Desktop",
    "--no-clean",
  ]);

  if (options.out !== "tmp/nw") {
    throw new Error(`Unexpected out: ${options.out}`);
  }
  if (options.runtime !== "/opt/nwjs") {
    throw new Error(`Unexpected runtime: ${options.runtime}`);
  }
  if (options.appName !== "JSHack Desktop") {
    throw new Error(`Unexpected appName: ${options.appName}`);
  }
  if (options.clean !== false) {
    throw new Error("Expected no-clean to disable cleanup");
  }
});

Deno.test("NW.js manifest keeps browser entry canonical", () => {
  const manifest = buildNwManifest({
    appName: "JSHack Desktop",
    version: "1.2.3",
  });

  if (manifest.main !== "index.html") {
    throw new Error(`Unexpected main: ${manifest.main}`);
  }
  if (manifest.window.title !== "JSHack Desktop") {
    throw new Error(`Unexpected title: ${manifest.window.title}`);
  }
  if (manifest.version !== "1.2.3") {
    throw new Error(`Unexpected version: ${manifest.version}`);
  }
  if (!manifest["chromium-args"]) {
    throw new Error("Expected NW.js chromium-args key");
  }
});

Deno.test("NW.js staging skips repository metadata", () => {
  if (!shouldSkipPath("src/lib/ecs-js/.git/config")) {
    throw new Error("Expected vendored .git metadata to be skipped");
  }
  if (!shouldSkipPath("assets/audio/dropbox-soundfx.zip")) {
    throw new Error("Expected source asset archives to be skipped");
  }
  if (shouldSkipPath("src/rules/data/items.js")) {
    throw new Error("Expected source files to be staged");
  }
});
