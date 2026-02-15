import { assert, assertEquals } from "jsr:@std/assert";
import { runCallbackList } from '../src/rules/interaction/dispatch.js';

Deno.test("all callbacks execute when no cancel", () => {
  const calls = [];
  const ctx = { cancelled: false };
  const result = runCallbackList([
    () => calls.push("a"),
    () => calls.push("b"),
    () => calls.push("c"),
  ], ctx);

  assert(result === true);
  assertEquals(calls, ["a", "b", "c"]);
});

Deno.test("short-circuits on cancel: remaining callbacks skipped", () => {
  const calls = [];
  const ctx = { _cancelled: false };
  Object.defineProperty(ctx, "cancelled", { get() { return ctx._cancelled; } });

  const result = runCallbackList([
    () => calls.push("a"),
    () => { calls.push("cancel"); ctx._cancelled = true; },
    () => calls.push("never"),
  ], ctx);

  assert(result === false);
  assertEquals(calls, ["a", "cancel"]);
});

Deno.test("empty array returns true", () => {
  const result = runCallbackList([], { cancelled: false });
  assert(result === true);
});

Deno.test("non-array returns true", () => {
  assert(runCallbackList(undefined, { cancelled: false }) === true);
  assert(runCallbackList(null, { cancelled: false }) === true);
});

Deno.test("already-cancelled context: no callbacks run", () => {
  const calls = [];
  const result = runCallbackList([
    () => calls.push("nope"),
  ], { cancelled: true });

  assert(result === false);
  assertEquals(calls, []);
});

Deno.test("non-function entries skipped", () => {
  const calls = [];
  const result = runCallbackList([
    () => calls.push("a"),
    "not a function",
    42,
    () => calls.push("b"),
  ], { cancelled: false });

  assert(result === true);
  assertEquals(calls, ["a", "b"]);
});
