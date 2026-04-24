#!/usr/bin/env deno run --allow-read --allow-write --allow-run

const AUDIO_DIR = "./assets/audio";
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

async function getLoudness(inputPath) {
  const cmd = [
    "/usr/bin/ffmpeg",
    "-i", inputPath,
    "-af", "ebur128=short=1",
    "-f", "null",
    "-",
  ];

  const result = await runCmd(cmd);
  const lufsMatch = result.stderr.match(/\[Parsed_ebur128.*?M:\s*([-\d.]+)\s*LUFS/);
  if (lufsMatch) {
    return parseFloat(lufsMatch[1]).toFixed(2);
  }
  return "unknown";
}

async function getBitrate(inputPath) {
  const cmd = [
    "/usr/bin/ffprobe",
    "-v", "error",
    "-select_streams", "a:0",
    "-show_entries", "stream=bit_rate",
    "-of", "default=noprint_wrappers=1:nokey=1",
    inputPath,
  ];

  const result = await runCmd(cmd);
  if (result.status === 0) {
    const kbps = Math.round(parseInt(result.stdout.trim()) / 1000);
    return kbps.toString();
  }
  return "unknown";
}

async function main() {
  const entries = Deno.readDirSync(AUDIO_DIR);
  const audioFiles = Array.from(entries)
    .filter(e => e.isFile && (e.name.endsWith(".mp3") || e.name.endsWith(".wav")))
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log(`Scanning ${audioFiles.length} audio files...\n`);

  const csvLines = [
    "filename,length_sec,loudness_lufs,bitrate_kbps",
  ];

  let scanned = 0;

  for (const file of audioFiles) {
    const inputPath = `${AUDIO_DIR}/${file.name}`;

    try {
      Deno.stdout.writeSync(new TextEncoder().encode(`[${scanned + 1}/${audioFiles.length}] ${file.name}...`));

      const duration = await getDuration(inputPath);
      const loudness = await getLoudness(inputPath);
      const bitrate = await getBitrate(inputPath);

      csvLines.push(`${file.name},${duration},${loudness},${bitrate}`);

      Deno.stdout.writeSync(new TextEncoder().encode(" ✓\n"));
      scanned++;
    } catch (err) {
      Deno.stdout.writeSync(new TextEncoder().encode(` ✗ ${err.message}\n`));
    }
  }

  // Write manifest
  await Deno.writeTextFile(MANIFEST_FILE, csvLines.join("\n") + "\n");

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Scanned: ${scanned}/${audioFiles.length}`);
  console.log(`Manifest saved to ${MANIFEST_FILE}`);
}

await main();
