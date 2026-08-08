import { assert, assertEquals } from "jsr:@std/assert";
import { createSpeechBubbleLayer } from "../src/display/ui/speechBubbleLayer.js";
import {
  DIALOG_LAYER_Z_INDEX,
  SPEECH_BUBBLE_LAYER_Z_INDEX,
} from "../src/display/ui/overlayUtils.js";

class FakeContext {
  calls = [];
  save() { this.calls.push("save"); }
  restore() { this.calls.push("restore"); }
  setTransform() { this.calls.push("setTransform"); }
  clearRect() { this.calls.push("clearRect"); }
}

class FakeCanvas {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.style = {};
    this.attributes = {};
    this.ctx = new FakeContext();
  }
  getContext() { return this.ctx; }
  setAttribute(name, value) { this.attributes[name] = value; }
}

Deno.test("speech bubble layer stays above ordinary UI and below interactive dialogs", () => {
  const children = [];
  const documentRef = {
    body: { appendChild: (child) => children.push(child) },
    createElement: () => new FakeCanvas(),
  };
  const sourceCanvas = {
    width: 640,
    height: 400,
    offsetWidth: 320,
    offsetHeight: 200,
    getBoundingClientRect: () => ({ left: 12, top: 18, width: 320, height: 200 }),
  };
  const layer = createSpeechBubbleLayer({ sourceCanvas, documentRef });
  let drew = false;

  layer.render(() => { drew = true; });

  assertEquals(children, [layer.canvas]);
  assertEquals(layer.canvas.width, 640);
  assertEquals(layer.canvas.height, 400);
  assertEquals(layer.canvas.style.left, "12px");
  assertEquals(layer.canvas.style.top, "18px");
  assertEquals(layer.canvas.style.width, "320px");
  assertEquals(layer.canvas.style.height, "200px");
  assertEquals(layer.canvas.style.pointerEvents, "none");
  assertEquals(layer.canvas.style.zIndex, String(SPEECH_BUBBLE_LAYER_Z_INDEX));
  assertEquals(SPEECH_BUBBLE_LAYER_Z_INDEX < DIALOG_LAYER_Z_INDEX, true);
  assertEquals(layer.ctx.calls, ["save", "setTransform", "clearRect", "restore"]);
  assertEquals(drew, true);
});

Deno.test("speech bubble layer exceeds every literal app z-index", async () => {
  let highestOrdinaryZIndex = 0;
  const scan = async (path) => {
    for await (const entry of Deno.readDir(path)) {
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory) {
        if (entry.name !== "lib") await scan(child);
        continue;
      }
      if (!entry.name.endsWith(".js")) continue;
      const source = await Deno.readTextFile(child);
      for (const match of source.matchAll(/zIndex\s*(?::|=)\s*["']?(\d+)/g)) {
        highestOrdinaryZIndex = Math.max(highestOrdinaryZIndex, Number(match[1]));
      }
    }
  };

  await scan("src");
  const html = await Deno.readTextFile("index.html");
  for (const match of html.matchAll(/z-index\s*:\s*(\d+)/g)) {
    highestOrdinaryZIndex = Math.max(highestOrdinaryZIndex, Number(match[1]));
  }

  assert(
    SPEECH_BUBBLE_LAYER_Z_INDEX > highestOrdinaryZIndex,
    `speech layer ${SPEECH_BUBBLE_LAYER_Z_INDEX} must exceed ordinary app layer ${highestOrdinaryZIndex}`,
  );
});
