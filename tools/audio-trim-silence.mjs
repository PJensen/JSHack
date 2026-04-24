#!/usr/bin/env deno run --allow-read --allow-write --allow-run

import { basename } from "https://deno.land/std@0.208.0/path/mod.ts";

const AUDIO_DIR = "./assets/audio";
const SILENCE_THRESHOLD = -50; // dB below full scale
const SILENCE_DURATION = 0.1; // 100ms

async function runCmd(cmd) {
  const process = new Deno.Command("sh", {
    args: ["-c", cmd.join(" ")],
    stdout: "piped",
    stderr: "piped",
    env: { PATH: "/usr/local/bin:/usr/bin:/bin" },
  });

  const { code, stdout, stderr } = await process.output();

  return {
    status: code,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
}

async function trimSilence(inputPath, outputPath) {
  // ffmpeg silenceremove: removes silence from beginning and end
  // silence: threshold (dB), duration in seconds
  const ext = inputPath.split(".").pop().toLowerCase();
  const isWav = ext === "wav";
  const cmd = [
    "/usr/bin/ffmpeg",
    "-i", inputPath,
    "-af", `silenceremove=start_periods=1:start_duration=${SILENCE_DURATION}:start_threshold=${SILENCE_THRESHOLD}dB,silenceremove=stop_periods=-1:stop_duration=${SILENCE_DURATION}:stop_threshold=${SILENCE_THRESHOLD}dB`,
    "-f", isWav ? "wav" : "mp3",
  ];

  if (isWav) {
    cmd.push("-acodec", "pcm_s16le");
  } else {
    cmd.push("-acodec", "libmp3lame", "-b:a", "256k");
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
    const backupPath = `${AUDIO_DIR}/${file.name.replace(/\.(\w+)$/, "_orig.$1")}`;
    const tempPath = `${AUDIO_DIR}/.${file.name}.tmp`;

    try {
      console.log(`Processing: ${file.name}`);

      // Skip if already backed up (already processed)
      const backupExists = await Deno.stat(backupPath).catch(() => null);
      if (backupExists) {
        console.log(`  → Already processed (backup exists), skipping\n`);
        continue;
      }

      // Process to temp file
      await trimSilence(inputPath, tempPath);

      // Backup original, move temp to original
      await Deno.rename(inputPath, backupPath);
      await Deno.rename(tempPath, inputPath);

      console.log(`  ✓ Done\n`);
      processed++;
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}\n`);
      // Clean up temp if it exists
      await Deno.remove(tempPath).catch(() => {});
      failed++;
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Processed: ${processed}`);
  console.log(`Failed:    ${failed}`);
  console.log(`Total:     ${audioFiles.length}`);
  console.log(`\nBackups saved as *_orig.{mp3,wav}`);
}

await main();
