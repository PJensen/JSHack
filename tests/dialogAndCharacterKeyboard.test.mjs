import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { createBubbleDialogController } from "../src/display/ui/bubbleDialog.js";

class FakeElement extends EventTarget {
  constructor() {
    super();
    this.style = {};
    this.children = [];
    this.textContent = "";
    this.innerHTML = "";
    this.offsetWidth = 280;
    this.offsetHeight = 120;
  }

  appendChild(child) { this.children.push(child); }
}

function keyboardEvent(key, code = key) {
  const event = new Event("keydown", { cancelable: true });
  Object.defineProperties(event, {
    key: { value: key },
    code: { value: code },
  });
  return event;
}

Deno.test("NPC bubble keyboard closes on Escape and accepts the first choice on Enter", () => {
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    addEventListener: globalThis.addEventListener,
  };
  const events = new EventTarget();
  const body = new FakeElement();
  globalThis.window = events;
  globalThis.document = {
    createElement: () => new FakeElement(),
    body,
  };
  globalThis.addEventListener = events.addEventListener.bind(events);

  try {
    const requested = [];
    events.addEventListener("ui:requestDialogChoice", (event) => requested.push(event.detail));
    events.addEventListener("ui:requestDialogClose", (event) => requested.push({ close: event.detail }));
    const controller = createBubbleDialogController({
      getPosition: () => ({ x: 1, y: 1 }),
      playerEntity: () => ({ id: 1, pos: { x: 1, y: 1 } }),
      canvas: new FakeElement(),
      getCam: () => ({ scale: 16 }),
      worldToScreen: () => [100, 100],
      getCanvasSetup: () => ({ cssW: 320, cssH: 240 }),
    });
    controller.open({
      sessionId: 7,
      choices: [{ id: "accept", label: "Accept" }, { id: "decline", label: "Decline" }],
    });

    events.dispatchEvent(keyboardEvent("Enter"));
    events.dispatchEvent(keyboardEvent("Escape"));

    assertEquals(requested, [
      { sessionId: 7, choiceId: "accept" },
      { close: { sessionId: 7 } },
    ]);
  } finally {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.addEventListener = previous.addEventListener;
  }
});

Deno.test("character menu remembers its active tab and Escape closes visible panels", async () => {
  const overlay = await Deno.readTextFile("src/display/ui/overlay.js");
  const main = await Deno.readTextFile("src/main.js");

  assertStringIncludes(overlay, "let lastCharacterMenuTab = 'character';");
  assertStringIncludes(overlay, "detail: { restoreLastTab: true }");
  assertStringIncludes(overlay, "if (e.key === 'Escape')");
  assertStringIncludes(overlay, "for (const p of document.querySelectorAll('.ui-panel'))");
  assertStringIncludes(main, "detail: { restoreLastTab: true }");
});
