import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { completeOpenAICompatibleChat } from "../src/cloud/llm/openAICompatible.js";

Deno.test("OpenAI-compatible chat client shapes requests and returns text", async () => {
  let captured = null;
  const result = await completeOpenAICompatibleChat({
    endpoint: "http://example.test/v1/chat/completions",
    apiKey: "abc",
    model: "local-test",
    messages: [{ role: "user", content: "Hello" }],
    temperature: 0.2,
    maxTokens: 32,
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        async json() {
          return { choices: [{ message: { content: " Hi there. " } }] };
        },
      };
    },
  });

  assertEquals(result, "Hi there.");
  assertEquals(captured.url, "http://example.test/v1/chat/completions");
  assertEquals(captured.init.method, "POST");
  assertEquals(captured.init.headers.Authorization, "Bearer abc");
  assertEquals(JSON.parse(captured.init.body), {
    model: "local-test",
    messages: [{ role: "user", content: "Hello" }],
    temperature: 0.2,
    max_tokens: 32,
  });
});

Deno.test("OpenAI-compatible chat client fails closed", async () => {
  const result = await completeOpenAICompatibleChat({
    endpoint: "http://example.test/v1/chat/completions",
    model: "local-test",
    messages: [{ role: "user", content: "Hello" }],
    fetchImpl: async () => ({ ok: false }),
  });

  assertEquals(result, null);
});
