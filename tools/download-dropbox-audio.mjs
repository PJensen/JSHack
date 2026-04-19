#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-run

const DEFAULT_URL = "https://www.dropbox.com/scl/fo/j0545e4yzpk4l2bptxhxv/AJkrGkOXMOrJt2atOgFAp5s/soundfx?dl=0&rlkey=1mys8lo70f30wysaej727rwrr&subfolder_nav_tracking=1";
const DEFAULT_OUT_DIR = "assets/audio";

function parseArgs(argv) {
  const options = {
    url: DEFAULT_URL,
    outDir: DEFAULT_OUT_DIR,
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
  console.log(`Download WAV files from a shared Dropbox folder into ${DEFAULT_OUT_DIR}.

Usage:
  deno run --allow-net --allow-read --allow-write --allow-run tools/download-dropbox-audio.mjs

Options:
  --url <shared-folder-url>  Override the Dropbox shared folder URL
  --out <dir>                Output directory (default: ${DEFAULT_OUT_DIR})
  --overwrite                Replace existing files in the output directory
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

async function ensureCommand(name) {
  try {
    const command = new Deno.Command(name, {
      args: ["-v"],
      stdout: "null",
      stderr: "null",
    });
    await command.output();
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(`Required command not found: ${name}`);
    }
    throw error;
  }
}

async function downloadZip(url, zipPath) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Dropbox download failed: HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new Error("Dropbox download did not return a response body");
  }

  const file = await Deno.open(zipPath, { create: true, truncate: true, write: true });
  try {
    await response.body.pipeTo(file.writable);
  } finally {
    file.close();
  }
}

async function listZipEntries(zipPath) {
  const command = new Deno.Command("unzip", {
    args: ["-Z1", zipPath],
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  if (!output.success) {
    throw new Error(new TextDecoder().decode(output.stderr).trim() || "Failed to inspect zip archive");
  }
  return new TextDecoder()
    .decode(output.stdout)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isWavPath(entry) {
  return entry.toLowerCase().endsWith(".wav") && !entry.endsWith("/");
}

async function extractZipFile(zipPath, entry, outPath) {
  const args = ["-p", zipPath, entry];
  const command = new Deno.Command("unzip", {
    args,
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  if (!output.success) {
    throw new Error(`Failed to extract ${entry}: ${new TextDecoder().decode(output.stderr).trim()}`);
  }

  await Deno.mkdir(new URL(".", outPath), { recursive: true });
  await Deno.writeFile(outPath, output.stdout);
}

async function main() {
  const options = parseArgs(Deno.args);
  await ensureCommand("unzip");

  const outputDir = new URL(`${options.outDir.replace(/\/+$/u, "")}/`, import.meta.resolve("../"));
  const tempDir = await Deno.makeTempDir({ prefix: "jshack-dropbox-audio-" });
  const zipPath = `${tempDir}/dropbox-audio.zip`;
  const downloadUrl = buildDownloadUrl(options.url);

  try {
    log(options, `Downloading: ${downloadUrl}`);
    await downloadZip(downloadUrl, zipPath);

    const entries = await listZipEntries(zipPath);
    const wavEntries = entries.filter(isWavPath);
    if (!wavEntries.length) {
      throw new Error("No .wav files found in the downloaded Dropbox archive");
    }

    const seenNames = new Set();
    let written = 0;
    let skipped = 0;

    await Deno.mkdir(outputDir, { recursive: true });

    for (const entry of wavEntries) {
      const name = entry.split("/").pop() || entry;
      const lowerName = name.toLowerCase();
      if (seenNames.has(lowerName)) {
        throw new Error(`Duplicate wav filename in archive: ${name}`);
      }
      seenNames.add(lowerName);

      const outPath = new URL(name, outputDir);
      if (!options.overwrite) {
        try {
          await Deno.stat(outPath);
          skipped += 1;
          log(options, `Skipping existing file: ${name}`);
          continue;
        } catch (error) {
          if (!(error instanceof Deno.errors.NotFound)) throw error;
        }
      }

      await extractZipFile(zipPath, entry, outPath);
      written += 1;
      log(options, `Saved: ${name}`);
    }

    console.log(`Finished. wrote=${written} skipped=${skipped} total_wavs=${wavEntries.length}`);
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  });
}
