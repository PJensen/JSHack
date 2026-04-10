import { assertEquals } from "jsr:@std/assert";
import { createTurnSchedule } from "../src/rules/utils/turnSchedule.js";

Deno.test("turnSchedule: drains due entries in deterministic order", () => {
  const q = createTurnSchedule({ maxLevel: 10 });
  q.schedule("b", 5, "B");
  q.schedule("a", 5, "A");
  q.schedule("c", 3, "C");

  const out = [];
  q.drainDue(5, (key, value, dueTurn) => {
    out.push([key, value, dueTurn]);
  });

  assertEquals(out, [
    ["c", "C", 3],
    ["a", "A", 5],
    ["b", "B", 5],
  ]);
  assertEquals(q.size, 0);
});

Deno.test("turnSchedule: reschedule and cancel maintain uniqueness by key", () => {
  const q = createTurnSchedule();
  q.schedule("task", 10, 1);
  q.schedule("task", 2, 2);
  q.schedule("other", 2, 3);
  q.cancel("other");

  const out = [];
  q.drainDue(10, (key, value) => out.push([key, value]));
  assertEquals(out, [["task", 2]]);
  assertEquals(q.size, 0);
});
