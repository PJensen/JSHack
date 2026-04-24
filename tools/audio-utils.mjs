export async function getProcessedFiles(manifestFile) {
  try {
    const content = await Deno.readTextFile(manifestFile);
    const lines = content.trim().split("\n").slice(1); // skip header
    return new Set(lines.map(line => line.split(",")[0]));
  } catch {
    return new Set();
  }
}
