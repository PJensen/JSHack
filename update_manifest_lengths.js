#!/usr/bin/env deno run --allow-read --allow-write --allow-run

// Update manifest.csv with actual audio file lengths using ffprobe

import { readTextFile, writeTextFile } from "https://deno.land/std/fs/mod.ts";

const AUDIO_DIR = "./assets/audio";
const MANIFEST = "./manifest.csv";

async function getAudioDuration(filePath) {
  try {
    const cmd = new Deno.Command("ffprobe", {
      args: [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1:csv=p=0",
        filePath,
      ],
      stdout: "piped",
    });
    const { stdout } = await cmd.output();
    const duration = parseFloat(new TextDecoder().decode(stdout).trim());
    return isNaN(duration) ? null : Math.round(duration * 100) / 100;
  } catch (e) {
    console.error(`Error getting duration for ${filePath}:`, e.message);
    return null;
  }
}

async function main() {
  const manifest = await readTextFile(MANIFEST);
  const lines = manifest.split("\n");
  const header = lines[0];
  const rows = lines.slice(1);

  const updated = [header];

  for (const line of rows) {
    if (!line.trim()) {
      updated.push(line);
      continue;
    }

    const parts = line.split(",");
    if (parts.length < 1) {
      updated.push(line);
      continue;
    }

    const filename = parts[0].trim();
    if (!filename || filename === "filename") {
      updated.push(line);
      continue;
    }

    const filePath = `${AUDIO_DIR}/${filename}`;
    const duration = await getAudioDuration(filePath);

    if (duration !== null) {
      parts[1] = String(duration);
      console.log(`${filename}: ${duration}s`);
    } else {
      console.log(`${filename}: skipped (duration unknown)`);
    }

    updated.push(parts.join(","));
  }

  await writeTextFile(MANIFEST, updated.join("\n"));
  console.log(`\nUpdated ${MANIFEST}`);
}

main().catch(console.error);
