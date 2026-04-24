#!/usr/bin/env deno run --allow-read --allow-write --allow-run

const AUDIO_DIR = "./assets/audio";
const TARGET_LOUDNESS = -16; // LUFS
const TARGET_BITRATE = "128k";
const MANIFEST_FILE = "manifest.csv";

async function runCmd(cmd) {
  const process = new Deno.Command("sh", {
    args: ["-c", cmd.join(" ")],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await process.output();

  return {
    status: code,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
}

async function getFileSizeKb(path) {
  try {
    const stat = await Deno.stat(path);
    return (stat.size / 1024).toFixed(1);
  } catch {
    return "0";
  }
}

async function measureLoudness(inputPath) {
  const cmd = [
    "/usr/bin/ffmpeg",
    "-i", inputPath,
    "-af", "ebur128=short=1",
    "-f", "null",
    "-",
  ];

  const result = await runCmd(cmd);

  // Parse LUFS from stderr (ebur128 outputs to stderr)
  const match = result.stderr.match(/Loudness.*?LUFS/);
  if (match) {
    const lufsMatch = result.stderr.match(/\[Parsed_ebur128.*?M:\s*([-\d.]+)\s*LUFS/);
    if (lufsMatch) {
      return parseFloat(lufsMatch[1]).toFixed(2);
    }
  }
  return "unknown";
}

async function normalizeAndCompress(inputPath, outputPath, ext) {
  const isWav = ext === "wav";
  const cmd = [
    "/usr/bin/ffmpeg",
    "-i", inputPath,
    "-af", `loudnorm=I=${TARGET_LOUDNESS}:TP=-1.5:LRA=11`,
    "-f", isWav ? "wav" : "mp3",
  ];

  if (isWav) {
    cmd.push("-acodec", "pcm_s16le");
  } else {
    cmd.push("-acodec", "libmp3lame", "-b:a", TARGET_BITRATE);
  }

  cmd.push("-y", outputPath);

  const result = await runCmd(cmd);
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed: ${result.stderr}`);
  }
}

async function main() {
  const entries = Deno.readDirSync(AUDIO_DIR);
  const audioFiles = Array.from(entries)
    .filter(e => e.isFile && (e.name.endsWith(".mp3") || e.name.endsWith(".wav")))
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log(`Found ${audioFiles.length} audio files\n`);

  const csvLines = [
    "filename,original_bitrate_kbps,original_loudness_lufs,normalized_loudness_lufs,new_bitrate_kbps,size_before_kb,size_after_kb,status",
  ];

  let processed = 0;
  let failed = 0;

  for (const file of audioFiles) {
    const inputPath = `${AUDIO_DIR}/${file.name}`;
    const ext = file.name.split(".").pop().toLowerCase();
    const tempPath = `${AUDIO_DIR}/.${file.name}.tmp`;

    try {
      console.log(`Processing: ${file.name}`);

      // Get original loudness
      console.log(`  → Measuring loudness...`);
      const origLoudness = await measureLoudness(inputPath);
      const origSize = await getFileSizeKb(inputPath);

      // Normalize and compress
      console.log(`  → Normalizing to ${TARGET_LOUDNESS} LUFS at ${TARGET_BITRATE}...`);
      await normalizeAndCompress(inputPath, tempPath, ext);

      // Get new file size
      const newSize = await getFileSizeKb(tempPath);

      // Replace original with normalized version
      await Deno.rename(tempPath, inputPath);

      const origBitrate = ext === "wav" ? "PCM" : "256";
      const newBitrate = ext === "wav" ? "PCM" : "128";

      csvLines.push(
        `${file.name},${origBitrate},${origLoudness},${TARGET_LOUDNESS},${newBitrate},${origSize},${newSize},success`
      );

      console.log(`  ✓ Done (${origSize} KB → ${newSize} KB)\n`);
      processed++;
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}\n`);
      await Deno.remove(tempPath).catch(() => {});
      csvLines.push(`${file.name},unknown,unknown,${TARGET_LOUDNESS},unknown,0,0,failed`);
      failed++;
    }
  }

  // Write manifest
  await Deno.writeTextFile(MANIFEST_FILE, csvLines.join("\n") + "\n");

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Processed: ${processed}`);
  console.log(`Failed:    ${failed}`);
  console.log(`Total:     ${audioFiles.length}`);
  console.log(`\nManifest saved to ${MANIFEST_FILE}`);
}

await main();
