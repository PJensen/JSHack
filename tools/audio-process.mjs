#!/usr/bin/env deno run --allow-read --allow-write --allow-run

async function runTask(name, cmd) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`→ ${name}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const process = new Deno.Command("sh", {
    args: ["-c", cmd],
  });

  const { code } = await process.output();
  if (code !== 0) {
    throw new Error(`${name} failed with code ${code}`);
  }
}

async function main() {
  const basePath = new URL(".", import.meta.url).pathname;
  const denv = `export PATH="$HOME/.deno/bin:$PATH"`;

  try {
    await runTask(
      "Trim Silence",
      `${denv} && deno run --allow-read --allow-write --allow-run ${basePath}audio-trim-silence.mjs`
    );

    await runTask(
      "Normalize & Compress",
      `${denv} && deno run --allow-read --allow-write --allow-run ${basePath}audio-normalize-compress.mjs`
    );

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✓ Audio processing complete`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  } catch (err) {
    console.error(`\n✗ ${err.message}`);
    Deno.exit(1);
  }
}

await main();
