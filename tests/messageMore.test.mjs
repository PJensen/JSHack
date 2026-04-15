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

Deno.test("two messages activate --More-- and advance works", async () => {
  const { q, displayed, getClearCount } = makeHarness();
  q.beginBatch();
  const clearBefore = getClearCount();
  q.push({ text: "Msg1", type: "combat" });
  q.push({ text: "Msg2", type: "combat" });
  // Microtask fires
  await Promise.resolve();
  await Promise.resolve();
  assertEquals(q.isActive(), true, "should be gating after 2 messages");
  // First displayed message is Msg1 with hasMore=true
  const last = displayed[displayed.length - 1];
  assertEquals(last.message.text, "Msg1");
  assertEquals(last.hasMore, true);

  // Advance to Msg2
  q.advance();
  const next = displayed[displayed.length - 1];
  assertEquals(next.message.text, "Msg2");
  assertEquals(next.hasMore, false);
  assertEquals(q.isActive(), false, "should unlock after last message");
});

Deno.test("three messages require two advances", async () => {
  const { q, displayed } = makeHarness();
  q.beginBatch();
  q.push({ text: "A", type: "default" });
  q.push({ text: "B", type: "default" });
  q.push({ text: "C", type: "default" });
  await Promise.resolve();
  await Promise.resolve();
  assertEquals(q.isActive(), true);
  assertEquals(displayed[displayed.length - 1].message.text, "A");

  q.advance(); // → B
  assertEquals(displayed[displayed.length - 1].message.text, "B");
  assertEquals(displayed[displayed.length - 1].hasMore, true);
  assertEquals(q.isActive(), true);

  q.advance(); // → C (last)
  assertEquals(displayed[displayed.length - 1].message.text, "C");
  assertEquals(displayed[displayed.length - 1].hasMore, false);
  assertEquals(q.isActive(), false);
});

Deno.test("beginBatch flushes stale queue", async () => {
  const { q, displayed } = makeHarness();
  q.beginBatch();
  q.push({ text: "Old1", type: "default" });
  q.push({ text: "Old2", type: "default" });
  await Promise.resolve();
  await Promise.resolve();
  assertEquals(q.isActive(), true);

  // New action before advancing — stale queue flushed
  q.beginBatch();
  assertEquals(q.isActive(), false, "beginBatch should unlock");
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
