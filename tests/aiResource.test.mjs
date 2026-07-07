import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { World } from "../src/lib/ecs-js/index.js";
import { experimentalAIExtension } from "../src/main/resources/AI.js";
import { AIResource } from "../src/rules/resources/AI.js";
import { writeAISettings } from "../src/shared/aiSettings.js";

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
    },
  });
  try {
    return fn();
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

Deno.test("AI resource returns null when disabled", async () => {
  await withStorage(async () => {
    writeAISettings({ enabled: false });
    const world = new World();
    world.install(experimentalAIExtension);
    const AI = world.resource(AIResource);
    const result = await AI.complete({
      messages: [{ role: "user", content: "Say hello" }],
      temperature: 0.7,
      maxTokens: 8,
    });
    assertEquals(result, null);
  });
});

Deno.test("AI resource reads configured endpoint, key, and model", async () => {
  await withStorage(async () => {
    writeAISettings({
      enabled: true,
      endpoint: "http://example.test/v1/chat/completions",
      apiKey: "test-key",
      model: "npc-smalltalk",
    });

    const originalFetch = globalThis.fetch;
    let captured = null;
    globalThis.fetch = async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        async json() {
          return { choices: [{ message: { content: "Mind the old well." } }] };
        },
      };
    };

    try {
      const world = new World();
      world.install(experimentalAIExtension);
      const AI = world.resource(AIResource);
      const result = await AI.complete({
        messages: [{ role: "user", content: "Give a townfolk line." }],
        temperature: 0.9,
        maxTokens: 12,
      });

      assertEquals(result, "Mind the old well.");
      assertEquals(captured.url, "http://example.test/v1/chat/completions");
      assertEquals(captured.init.headers.Authorization, "Bearer test-key");
      assertEquals(JSON.parse(captured.init.body), {
        model: "npc-smalltalk",
        messages: [{ role: "user", content: "Give a townfolk line." }],
        temperature: 0.9,
        max_tokens: 12,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
