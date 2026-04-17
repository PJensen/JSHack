import { assertEquals } from "jsr:@std/assert@1";
import { createMessageMoreQueue } from "../src/display/ui/messageMore.js";

// Stub setInputLock — we're testing queue logic, not the lock flag.
// The import inside messageMore.js calls into inputLock.js which uses
// window/globalThis.  For headless Deno we just need it not to throw.
// We patch globalThis so the Symbol-keyed lock set can be created.
if (typeof globalThis.__JSHACK_INPUT_LOCKED === "undefined") {
  globalThis.__JSHACK_INPUT_LOCKED = false;
}

function makeHarness() {
  const displayed = [];
  let cleared = 0;
  const q = createMessageMoreQueue({
    onDisplay(message, hasMore) { displayed.push({ message, hasMore }); },
    onClear() { cleared++; },
  });
  return { q, displayed, getClearCount: () => cleared };
}

Deno.test("single message in a batch does NOT activate --More--", async () => {
  const { q, displayed, getClearCount } = makeHarness();
  q.beginBatch();
  q.push({ text: "Hello", type: "default" });
  // Microtask hasn't fired yet
  assertEquals(q.isActive(), false);
  // Let microtask run
  await Promise.resolve();
  await Promise.resolve(); // double-resolve for safety
  assertEquals(q.isActive(), false, "single message should not gate");
  assertEquals(getClearCount() >= 1, true, "onClear should have fired");
});

Deno.test("two messages: first is displayed, no gating (display-only mode)", async () => {
  const { q, displayed, getClearCount } = makeHarness();
  q.beginBatch();
  q.push({ text: "Msg1", type: "combat" });
  q.push({ text: "Msg2", type: "combat" });
  // Microtask fires
  await Promise.resolve();
  await Promise.resolve();
  // Display-only mode: never gates
  assertEquals(q.isActive(), false, "display-only mode never gates");
  // First message is displayed with hasMore flag
  const last = displayed[displayed.length - 1];
  assertEquals(last.message.text, "Msg1");
  assertEquals(last.hasMore, true);

  // advance() is a no-op in display-only mode
  q.advance();
  assertEquals(displayed[displayed.length - 1].message.text, "Msg1", "advance is a no-op");
});

Deno.test("three messages: first is displayed, advance is a no-op (display-only mode)", async () => {
  const { q, displayed } = makeHarness();
  q.beginBatch();
  q.push({ text: "A", type: "default" });
  q.push({ text: "B", type: "default" });
  q.push({ text: "C", type: "default" });
  await Promise.resolve();
  await Promise.resolve();
  assertEquals(q.isActive(), false, "display-only mode never gates");
  assertEquals(displayed[displayed.length - 1].message.text, "A");

  // advance() is a no-op — display stays on A
  q.advance();
  assertEquals(displayed[displayed.length - 1].message.text, "A");
  q.advance();
  assertEquals(displayed[displayed.length - 1].message.text, "A");
});

Deno.test("beginBatch flushes stale queue", async () => {
  const { q, displayed } = makeHarness();
  q.beginBatch();
  q.push({ text: "Old1", type: "default" });
  q.push({ text: "Old2", type: "default" });
  await Promise.resolve();
  await Promise.resolve();
  // display-only mode: never gating
  assertEquals(q.isActive(), false);

  // New action — stale queue flushed
  q.beginBatch();
  assertEquals(q.isActive(), false, "beginBatch should not gate");
  assertEquals(q.pending().length, 0, "queue should be empty");
});

Deno.test("advance with empty queue is a no-op", async () => {
  const { q, displayed, getClearCount } = makeHarness();
  q.beginBatch();
  q.push({ text: "Only", type: "default" });
  await Promise.resolve();
  await Promise.resolve();
  // Single message — no gating
  assertEquals(q.isActive(), false);
  const before = displayed.length;
  q.advance(); // should be no-op since not gating
  assertEquals(displayed.length, before, "no new display calls");
});
