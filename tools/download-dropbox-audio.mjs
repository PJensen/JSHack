#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write

const DEFAULT_URL = "https://www.dropbox.com/scl/fo/j0545e4yzpk4l2bptxhxv/AJkrGkOXMOrJt2atOgFAp5s/soundfx?dl=0&rlkey=1mys8lo70f30wysaej727rwrr&subfolder_nav_tracking=1";
const DEFAULT_OUT_DIR = "assets/audio";
const DEFAULT_FILE = "dropbox-soundfx.zip";

function parseArgs(argv) {
  const options = {
    url: DEFAULT_URL,
    outDir: DEFAULT_OUT_DIR,
    fileName: DEFAULT_FILE,
    overwrite: false,
    quiet: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = String(argv[i] || "");
    if (arg === "--url" && argv[i + 1]) {
      options.url = String(argv[++i]);
      continue;
    }
    if (arg === "--out" && argv[i + 1]) {
      options.outDir = String(argv[++i]);
      continue;
    }
    if (arg === "--file" && argv[i + 1]) {
      options.fileName = String(argv[++i]);
      continue;
    }
    if (arg === "--overwrite") {
      options.overwrite = true;
      continue;
    }
    if (arg === "--quiet") {
      options.quiet = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      Deno.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Download a shared Dropbox folder as a zip into ${DEFAULT_OUT_DIR}.

Usage:
  deno run --allow-net --allow-read --allow-write tools/download-dropbox-audio.mjs

Options:
  --url <shared-folder-url>  Override the Dropbox shared folder URL
  --out <dir>                Output directory (default: ${DEFAULT_OUT_DIR})
  --file <name>              Output zip filename (default: ${DEFAULT_FILE})
  --overwrite                Replace an existing zip file
  --quiet                    Reduce log output
  --help                     Show this help
`);
}

function log(options, message) {
  if (!options.quiet) console.log(message);
}

function buildDownloadUrl(inputUrl) {
  const url = new URL(inputUrl);
  url.searchParams.set("dl", "1");
  url.searchParams.delete("raw");
  return url.toString();
}

async function exists(path) {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

async function downloadToFile(url, outPath) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Dropbox download failed: HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new Error("Dropbox download did not return a response body");
  }

  const file = await Deno.open(outPath, { create: true, write: true, truncate: true });
  try {
    await response.body.pipeTo(file.writable);
  } finally {
    file.close();
  }
}

async function main() {
  const options = parseArgs(Deno.args);
  const baseUrl = new URL("../", import.meta.url);
  const outputDir = new URL(`${options.outDir.replace(/\/+$/u, "")}/`, baseUrl);
  const outputFile = new URL(options.fileName, outputDir);
  const downloadUrl = buildDownloadUrl(options.url);

  await Deno.mkdir(outputDir, { recursive: true });

  if (!options.overwrite && await exists(outputFile)) {
    console.log(`Skipping existing file: ${outputFile.pathname}`);
    return;
  }

  log(options, `Downloading: ${downloadUrl}`);
  await downloadToFile(downloadUrl, outputFile);
  console.log(`Saved zip: ${outputFile.pathname}`);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  });
}
