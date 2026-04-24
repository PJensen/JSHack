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

async function getDuration(inputPath) {
  const cmd = [
    "/usr/bin/ffprobe",
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    inputPath,
  ];

  const result = await runCmd(cmd);
  if (result.status === 0) {
    return parseFloat(result.stdout.trim()).toFixed(2);
  }
  return "unknown";
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

  let processed = 0;
  let failed = 0;

  for (const file of audioFiles) {
    const inputPath = `${AUDIO_DIR}/${file.name}`;
    const ext = file.name.split(".").pop().toLowerCase();
    const tempPath = `${AUDIO_DIR}/.${file.name}.tmp`;

    try {
      console.log(`Processing: ${file.name}`);

      // Get duration
      console.log(`  → Getting duration...`);
      const duration = await getDuration(inputPath);

      // Normalize and compress
      console.log(`  → Normalizing to ${TARGET_LOUDNESS} LUFS at ${TARGET_BITRATE}...`);
      await normalizeAndCompress(inputPath, tempPath, ext);

      // Replace original with normalized version
      await Deno.rename(tempPath, inputPath);

      console.log(`  ✓ Done\n`);
      processed++;
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}\n`);
      await Deno.remove(tempPath).catch(() => {});
      failed++;
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Processed: ${processed}`);
  console.log(`Failed:    ${failed}`);
  console.log(`Total:     ${audioFiles.length}`);
}

await main();
