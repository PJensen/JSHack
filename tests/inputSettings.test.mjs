import { assertEquals } from "jsr:@std/assert";
import { readInputMode, writeInputMode } from "../src/display/input/inputSettings.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

function withMockLocalStorage(store, fn) {
  const hasOriginal = Object.prototype.hasOwnProperty.call(globalThis, "localStorage");
  const original = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    value: store,
    configurable: true,
    writable: true,
  });
  try {
    fn();
  } finally {
    if (hasOriginal) {
      Object.defineProperty(globalThis, "localStorage", {
        value: original,
        configurable: true,
        writable: true,
      });
    } else {
      delete globalThis.localStorage;
    }
  }
}

Deno.test("inputSettings defaults to tap-and-hold walk mode", () => {
  const store = memoryStorage();
  withMockLocalStorage(store, () => {
    assertEquals(readInputMode(), "walk");
  });
});

Deno.test("inputSettings persists walk mode across reads", () => {
  const store = memoryStorage();
  withMockLocalStorage(store, () => {
    writeInputMode("walk");
    assertEquals(readInputMode(), "walk");
  });
});
