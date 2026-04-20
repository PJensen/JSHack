#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write

const DEFAULT_URL = "https://www.dropbox.com/scl/fo/j0545e4yzpk4l2bptxhxv/AJkrGkOXMOrJt2atOgFAp5s/soundfx?dl=0&rlkey=1mys8lo70f30wysaej727rwrr&subfolder_nav_tracking=1";
const DEFAULT_OUT_DIR = "assets/audio";
const DEFAULT_FILE = "dropbox-soundfx.zip";
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

function parseArgs(argv) {
  const options = {
    url: DEFAULT_URL,
    outDir: DEFAULT_OUT_DIR,
    fileName: DEFAULT_FILE,
    overwrite: false,
    dryRun: false,
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
    if (arg === "--dry-run") {
      options.dryRun = true;
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
  console.log(`Download a shared Dropbox folder zip into ${DEFAULT_OUT_DIR}, extract it into a temp folder there, and move only top-level .wav files into ${DEFAULT_OUT_DIR}.

Usage:
  deno run --allow-net --allow-read --allow-write tools/download-dropbox-audio.mjs

Options:
  --url <shared-folder-url>  Override the Dropbox shared folder URL
  --out <dir>                Output directory (default: ${DEFAULT_OUT_DIR})
  --file <name>              Output zip filename (default: ${DEFAULT_FILE})
  --overwrite                Replace an existing zip file and wav outputs
  --dry-run                  Show what would be downloaded and moved without writing
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

async function removeIfExists(path) {
  try {
    await Deno.remove(path);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
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
    try {
      file.close();
    } catch (error) {
      if (!(error instanceof Deno.errors.BadResource)) throw error;
    }
  }
}

function fileUrlToPath(url) {
  return decodeURIComponent(url.pathname);
}

function readU16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes, offset) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function decodeBytes(bytes) {
  return new TextDecoder().decode(bytes);
}

function findEndOfCentralDirectory(bytes) {
  const minOffset = Math.max(0, bytes.length - 0xffff - 22);
  for (let offset = bytes.length - 22; offset >= minOffset; offset--) {
    if (readU32(bytes, offset) === EOCD_SIGNATURE) return offset;
  }
  throw new Error("Invalid zip: end of central directory not found");
}

function listZipEntries(bytes) {
  const eocdOffset = findEndOfCentralDirectory(bytes);
  const totalEntries = readU16(bytes, eocdOffset + 10);
  const centralOffset = readU32(bytes, eocdOffset + 16);
  const entries = [];
  let offset = centralOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (readU32(bytes, offset) !== CENTRAL_SIGNATURE) {
      throw new Error("Invalid zip: central directory entry missing");
    }

    const compressionMethod = readU16(bytes, offset + 10);
    const compressedSize = readU32(bytes, offset + 20);
    const uncompressedSize = readU32(bytes, offset + 24);
    const fileNameLength = readU16(bytes, offset + 28);
    const extraLength = readU16(bytes, offset + 30);
    const commentLength = readU16(bytes, offset + 32);
    const localHeaderOffset = readU32(bytes, offset + 42);
    const fileNameBytes = bytes.subarray(offset + 46, offset + 46 + fileNameLength);
    const fileName = decodeBytes(fileNameBytes);

    entries.push({
      fileName,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

async function extractTopLevelWavs(zipFile, tempDir) {
  const bytes = new Uint8Array(await Deno.readFile(zipFile));
  const entries = listZipEntries(bytes);
  const wavs = [];

  for (const entry of entries) {
    if (entry.fileName.endsWith("/")) continue;
    if (!entry.fileName.toLowerCase().endsWith(".wav")) continue;
    if (entry.fileName.includes("/")) continue;

    const localOffset = entry.localHeaderOffset;
    if (readU32(bytes, localOffset) !== LOCAL_SIGNATURE) {
      throw new Error(`Invalid zip: local header missing for ${entry.fileName}`);
    }

    const localNameLength = readU16(bytes, localOffset + 26);
    const localExtraLength = readU16(bytes, localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(dataOffset, dataOffset + entry.compressedSize);

    let data;
    if (entry.compressionMethod === 0) {
      data = compressed;
    } else if (entry.compressionMethod === 8) {
      data = await inflateRaw(compressed);
    } else {
      throw new Error(`Unsupported zip compression method ${entry.compressionMethod} for ${entry.fileName}`);
    }

    if (data.length !== entry.uncompressedSize) {
      throw new Error(`Zip size mismatch for ${entry.fileName}`);
    }

    const outPath = `${tempDir}/${entry.fileName}`;
    await Deno.writeFile(outPath, data);
    wavs.push(entry.fileName);
  }

  wavs.sort((a, b) => a.localeCompare(b));
  return wavs;
}

async function listTopLevelWavs(tempDir) {
  const names = [];
  for await (const entry of Deno.readDir(tempDir)) {
    if (!entry.isFile) continue;
    if (!entry.name.toLowerCase().endsWith(".wav")) continue;
    names.push(entry.name);
  }
  names.sort((a, b) => a.localeCompare(b));
  return names;
}

async function moveTopLevelWavs(tempDir, outputDir, overwrite, options) {
  let moved = 0;
  let skipped = 0;

  for (const name of await listTopLevelWavs(tempDir)) {
    const fromPath = `${tempDir}/${name}`;
    const toUrl = new URL(name, outputDir);
    const toPath = fileUrlToPath(toUrl);

    if (!overwrite && await exists(toUrl)) {
      skipped += 1;
      log(options, `Skipping existing wav: ${name}`);
      continue;
    }

    if (overwrite && await exists(toUrl)) {
      await Deno.remove(toUrl);
    }

    await Deno.rename(fromPath, toPath);
    moved += 1;
    log(options, `Moved wav: ${name}`);
  }

  return { moved, skipped };
}

async function main() {
  const options = parseArgs(Deno.args);
  const baseUrl = new URL("../", import.meta.url);
  const outputDir = new URL(`${options.outDir.replace(/\/+$/u, "")}/`, baseUrl);
  const outputFile = new URL(options.fileName, outputDir);
  const downloadUrl = buildDownloadUrl(options.url);

  await Deno.mkdir(outputDir, { recursive: true });

  const tempDir = await Deno.makeTempDir({
    dir: fileUrlToPath(outputDir),
    prefix: "dropbox-audio-",
  });

  try {
    if (!options.dryRun) {
      await removeIfExists(outputFile);
      log(options, `Removed previous zip: ${outputFile.pathname}`);
    }

    if (options.dryRun) {
      console.log(`Would download: ${downloadUrl}`);
      console.log(`Would write zip: ${outputFile.pathname}`);
      console.log(`Would extract into: ${tempDir}`);

      const probeZip = new URL("__dry_run_probe__.zip", outputDir);
      await downloadToFile(downloadUrl, probeZip);
      try {
        const wavs = await extractTopLevelWavs(fileUrlToPath(probeZip), tempDir);
        if (!wavs.length) {
          console.log("Would move: no top-level .wav files found");
        } else {
          for (const name of wavs) {
            const target = new URL(name, outputDir);
            const alreadyExists = await exists(target);
            if (alreadyExists && !options.overwrite) {
              console.log(`Would skip existing wav: ${target.pathname}`);
            } else {
              console.log(`Would move wav: ${tempDir}/${name} -> ${target.pathname}`);
            }
          }
        }
      } finally {
        await Deno.remove(probeZip).catch(() => {});
      }
      return;
    }

    log(options, `Downloading: ${downloadUrl}`);
    await downloadToFile(downloadUrl, outputFile);
    log(options, `Saved zip: ${outputFile.pathname}`);

    log(options, `Extracting into: ${tempDir}`);
    await extractTopLevelWavs(fileUrlToPath(outputFile), tempDir);

    const { moved, skipped } = await moveTopLevelWavs(tempDir, outputDir, options.overwrite, options);
    console.log(`Finished. moved=${moved} skipped=${skipped} zip=${outputFile.pathname}`);
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
