Deno.test("quick chip dismiss button is anchored to top-right corner", async () => {
  const path = new URL("../src/display/ui/hud.js", import.meta.url);
  const text = await Deno.readTextFile(path);

  if (!(text.includes("position: 'absolute'") &&
      text.includes("top: '6px'") &&
      text.includes("right: '8px'"))) {
    throw new Error("quick chip dismiss button should be absolutely positioned at the chip top-right");
  }

  if (!text.includes("chip.appendChild(x);")) {
    throw new Error("dismiss button should be attached directly to the quick chip container");
  }
});
