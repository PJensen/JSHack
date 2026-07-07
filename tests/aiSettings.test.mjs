import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { DEFAULT_AI_ENDPOINT, readAISettings, writeAISettings } from "../src/shared/aiSettings.js";

function withStorage(fn) {
  const original = globalThis.localStorage;
  const store = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem(key) {
        return store.has(key) ? store.get(key) : null;
      },
      setItem(key, value) {
        store.set(String(key), String(value));
      },
      removeItem(key) {
        store.delete(String(key));
      },
    },
  });
  try {
    fn();
  } finally {
    if (original === undefined) {
      delete globalThis.localStorage;
    } else {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: original,
      });
    }
  }
}

Deno.test("AI settings expose disabled configurable defaults", () => {
  withStorage(() => {
    assertEquals(readAISettings(), {
      enabled: false,
      endpoint: DEFAULT_AI_ENDPOINT,
      apiKey: "",
      model: "",
    });
  });
});

Deno.test("AI settings persist transport-level configuration", () => {
  withStorage(() => {
    writeAISettings({
      enabled: true,
      endpoint: "http://127.0.0.1:1234/v1/chat/completions",
      apiKey: "secret",
      model: "local-test",
    });
    assertEquals(readAISettings(), {
      enabled: true,
      endpoint: "http://127.0.0.1:1234/v1/chat/completions",
      apiKey: "secret",
      model: "local-test",
    });
  });
});
