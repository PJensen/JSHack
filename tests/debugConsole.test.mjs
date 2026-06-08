import { assertEquals } from "jsr:@std/assert";

import { initDebugConsole } from "../src/display/ui/debugConsole.js";

function createFakeElement(tagName) {
  let innerHTML = "";
  const listeners = new Map();
  return {
    tagName,
    style: {},
    dataset: {},
    children: [],
    textContent: "",
    className: "",
    value: "",
    autocomplete: "",
    spellcheck: false,
    type: "",
    focused: false,
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    addEventListener(type, handler) {
      const arr = listeners.get(type) || [];
      arr.push(handler);
      listeners.set(type, arr);
    },
    dispatch(type, event = {}) {
      const arr = listeners.get(type) || [];
      for (const handler of arr) handler(event);
    },
    focus() {
      this.focused = true;
    },
    blur() {
      this.focused = false;
    },
    get innerHTML() {
      return innerHTML;
    },
    set innerHTML(value) {
      innerHTML = value;
      this.children.length = 0;
    },
  };
}

Deno.test("debug console stays open on backdrop clicks and buffers hidden logs", () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;

  const windowListeners = new Map();
  const body = createFakeElement("body");
  const uiRoot = createFakeElement("div");
  body.appendChild(uiRoot);

  globalThis.document = {
    body,
    createElement(tagName) {
      return createFakeElement(tagName);
    },
    getElementById(id) {
      return id === "ui-root" ? uiRoot : null;
    },
  };
  globalThis.window = {
    addEventListener(type, handler) {
      const arr = windowListeners.get(type) || [];
      arr.push(handler);
      windowListeners.set(type, arr);
    },
  };
  globalThis.localStorage = {
    getItem() {
      return null;
    },
    setItem() {},
  };

  try {
    const world = { tick() {} };
    const api = initDebugConsole({ world, messageLog: { log() {} } });
    const panel = uiRoot.children[0];
    const container = panel.children[0];
    const output = container.children[1];
    const keydown = windowListeners.get("keydown")?.[0];

    api.log("  [sfx] before open", "debug");
    assertEquals(output.children.length, 1);
    assertEquals(panel.style.display, "none");

    keydown({
      code: "Backquote",
      preventDefault() {},
      stopPropagation() {},
    });
    assertEquals(panel.style.display, "block");

    panel.dispatch("pointerdown", {
      target: panel,
      preventDefault() {},
    });
    assertEquals(panel.style.display, "block");

    keydown({
      key: "Escape",
      preventDefault() {},
      stopImmediatePropagation() {},
    });
    assertEquals(panel.style.display, "none");

    api.log("  [sfx] while hidden", "debug");
    assertEquals(output.children.length, 2);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
  }
});