import { assert } from "jsr:@std/assert";

Deno.test("ground stack tooltip stays visible after requesting pickup", async () => {
  const path = new URL("../src/display/ui/overlay.js", import.meta.url);
  const text = await Deno.readTextFile(path);
  const stackSection = text.match(/if \(mode === 'stack'\) \{[\s\S]*?\n\s*return;\n\s*\}/);
  assert(stackSection, "expected stack tooltip section in overlay renderer");
  assert(
    !stackSection[0].includes("tip.style.display = 'none';"),
    "stack tooltip click handler should not hide tooltip; item:pickup refresh handles remaining stack",
  );
});
