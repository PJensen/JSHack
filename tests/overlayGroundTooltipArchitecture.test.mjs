import { assert } from "jsr:@std/assert";

Deno.test("ground stack tooltip stays visible after requesting pickup", async () => {
  const overlayPath = new URL("../src/display/ui/overlay.js", import.meta.url);
  const utilsPath = new URL("../src/display/ui/overlayUtils.js", import.meta.url);
  const overlayText = await Deno.readTextFile(overlayPath);
  const utilsText = await Deno.readTextFile(utilsPath);
  const text = overlayText + "\n" + utilsText;

  const stackStart = text.indexOf("if (mode === 'stack')");
  assert(stackStart >= 0, "expected stack mode section in overlay renderer");

  // Find the tip.onclick handler within the stack block (before the next mode check)
  const nextModeCheck = text.indexOf("if (mode === ", stackStart + 1);
  const onclickStart = text.indexOf("tip.onclick", stackStart);
  assert(onclickStart >= 0 && onclickStart < nextModeCheck, "expected tip.onclick handler in stack section");

  const onclickEnd = text.indexOf("};", onclickStart);
  const onclickBody = text.slice(onclickStart, onclickEnd + 2);
  assert(
    !onclickBody.includes("tip.style.display = 'none'"),
    "stack tooltip click handler should not hide tooltip; item:pickup refresh handles remaining stack",
  );
});
