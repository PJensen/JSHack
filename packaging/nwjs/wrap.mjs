// @ts-check

const ROOT = new URL("../../", import.meta.url);
const DEFAULT_OUT = "dist/nwjs";
const APP_DIR_NAME = "app";
const PACKAGE_NW_DIR_NAME = "package.nw";

const STAGED_PATHS = Object.freeze([
  "index.html",
  "manifest.json",
  "sw.js",
  "icon.svg",
  "logo.jpg",
  "VERSION",
  "src",
  "assets",
]);

const SKIPPED_NAMES = new Set([
  ".git",
  ".github",
  ".DS_Store",
  ".gitignore",
  "Thumbs.db",
  "node_modules",
  "play_all_wavs.sh",
]);

const SKIPPED_SUFFIXES = Object.freeze([
  ".zip",
  "_orig.mp3",
  "_orig.wav",
]);

export function parseArgs(args) {
  const options = {
    out: DEFAULT_OUT,
    runtime: "",
    appName: "JSHack",
    clean: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--out") {
      options.out = requireValue(args, ++i, arg);
    } else if (arg.startsWith("--out=")) {
      options.out = arg.slice("--out=".length);
    } else if (arg === "--runtime") {
      options.runtime = requireValue(args, ++i, arg);
    } else if (arg.startsWith("--runtime=")) {
      options.runtime = arg.slice("--runtime=".length);
    } else if (arg === "--app-name") {
      options.appName = requireValue(args, ++i, arg);
    } else if (arg.startsWith("--app-name=")) {
      options.appName = arg.slice("--app-name=".length);
    } else if (arg === "--no-clean") {
      options.clean = false;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function requireValue(args, index, flag) {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function buildNwManifest({ appName = "JSHack", version = "" } = {}) {
  const manifest = {
    name: appName.toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").replace(
      /^-+|-+$/g,
      "",
    ) || "jshack",
    version: sanitizeVersion(version),
    main: "index.html",
    description:
      "A browser roguelike packaged as a thin NW.js desktop wrapper.",
    window: {
      title: appName,
      icon: "icon.svg",
      width: 1280,
      height: 720,
      min_width: 360,
      min_height: 640,
      resizable: true,
    },
    "chromium-args": "--disable-features=ElasticOverscroll",
  };
  return manifest;
}

function sanitizeVersion(version) {
  const clean = String(version || "").trim();
  return /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(clean) ? clean : "0.0.0";
}

export function shouldSkipPath(pathPart) {
  if (!pathPart) return false;
  const parts = pathPart.split(/[\\/]+/).filter(Boolean);
  return parts.some((part) => {
    if (SKIPPED_NAMES.has(part)) return true;
    return SKIPPED_SUFFIXES.some((suffix) => part.endsWith(suffix));
  });
}

async function main(args) {
  const options = parseArgs(args);
  if (options.help) {
    printHelp();
    return;
  }

  const outDir = resolveFromRoot(options.out);
  const appDir = joinPath(outDir, APP_DIR_NAME);
  const version = await readTextIfExists(resolveFromRoot("VERSION"));
  const manifest = buildNwManifest({ appName: options.appName, version });

  if (options.clean) {
    await Deno.remove(outDir, { recursive: true }).catch((err) => {
      if (!(err instanceof Deno.errors.NotFound)) throw err;
    });
  }

  await ensureDir(appDir);
  for (const rel of STAGED_PATHS) {
    await copyPath(resolveFromRoot(rel), joinPath(appDir, rel), rel);
  }
  await writeJson(joinPath(appDir, "package.json"), manifest);

  console.log(`NW.js app staged at ${fromCwd(appDir)}`);

  if (options.runtime) {
    const bundleDir = joinPath(outDir, "runtime");
    await copyPath(resolveMaybeRelative(options.runtime), bundleDir, "");
    const packageDir = joinPath(bundleDir, PACKAGE_NW_DIR_NAME);
    await Deno.remove(packageDir, { recursive: true }).catch((err) => {
      if (!(err instanceof Deno.errors.NotFound)) throw err;
    });
    await copyPath(appDir, packageDir, "");
    console.log(`NW.js runtime bundle staged at ${fromCwd(bundleDir)}`);
  }
}

function printHelp() {
  console.log(`Usage: deno task wrap:nwjs [options]

Stages JSHack as a thin NW.js app without changing the browser runtime.

Options:
  --out <dir>        Output directory. Default: ${DEFAULT_OUT}
  --runtime <dir>    Optional unpacked NW.js runtime directory to copy and fill with package.nw
  --app-name <name>  Desktop window/app name. Default: JSHack
  --no-clean         Do not delete the output directory before staging
  -h, --help         Show this help
`);
}

async function copyPath(src, dest, rel) {
  if (shouldSkipPath(rel)) return;
  const info = await Deno.lstat(src);
  if (info.isSymlink) {
    await ensureDir(dirname(dest));
    const target = await Deno.readLink(src);
    await Deno.remove(dest).catch((err) => {
      if (!(err instanceof Deno.errors.NotFound)) throw err;
    });
    await Deno.symlink(target, dest).catch(async () => {
      const resolved = target.startsWith("/")
        ? target
        : joinPath(dirname(src), target);
      await copyPath(resolved, dest, rel);
    });
    return;
  }
  if (info.isDirectory) {
    await ensureDir(dest);
    for await (const entry of Deno.readDir(src)) {
      const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (shouldSkipPath(nextRel)) continue;
      await copyPath(
        joinPath(src, entry.name),
        joinPath(dest, entry.name),
        nextRel,
      );
    }
    return;
  }
  if (!info.isFile) return;
  await ensureDir(dirname(dest));
  await Deno.copyFile(src, dest);
}

async function writeJson(path, value) {
  await ensureDir(dirname(path));
  await Deno.writeTextFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function readTextIfExists(path) {
  try {
    return await Deno.readTextFile(path);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return "";
    throw err;
  }
}

async function ensureDir(path) {
  await Deno.mkdir(path, { recursive: true });
}

function resolveFromRoot(rel) {
  return new URL(rel, ROOT).pathname;
}

function resolveMaybeRelative(path) {
  if (path.startsWith("/")) return path;
  return joinPath(Deno.cwd(), path);
}

function joinPath(...parts) {
  const joined = parts
    .filter((part) => part !== "")
    .join("/")
    .replace(/\/+/g, "/");
  return joined === "" ? "/" : joined;
}

function dirname(path) {
  const clean = path.replace(/\/+$/, "");
  const index = clean.lastIndexOf("/");
  return index <= 0 ? "/" : clean.slice(0, index);
}

function fromCwd(path) {
  const cwd = Deno.cwd().replace(/\/+$/, "");
  return path.startsWith(`${cwd}/`) ? path.slice(cwd.length + 1) : path;
}

if (import.meta.main) {
  main(Deno.args).catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    Deno.exit(1);
  });
}
