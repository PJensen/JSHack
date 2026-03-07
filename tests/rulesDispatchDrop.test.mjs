import { assertEquals } from "jsr:@std/assert";
import { makeRulesDispatcher } from "../src/main/input/rulesDispatch.js";
import { DropIntent } from "../src/rules/components/Intents/DropIntent.js";

Deno.test("rulesDispatch: dropItem adds DropIntent and ticks once", () => {
  const addCalls = [];
  const tickCalls = [];
  const world = {
    add: (...args) => addCalls.push(args),
    tick: (...args) => tickCalls.push(args),
    get: () => null,
  };

  const dispatch = makeRulesDispatcher(world, () => 42);
  dispatch({ type: "rules.dropItem", payload: { itemId: 17 } });

  assertEquals(addCalls.length, 1);
  assertEquals(addCalls[0]?.[0], 42);
  assertEquals(addCalls[0]?.[1], DropIntent);
  assertEquals(addCalls[0]?.[2], { itemId: 17 });
  assertEquals(tickCalls, [[1]]);
});

Deno.test("rulesDispatch: dropItem forwards count when provided", () => {
  const addCalls = [];
  const tickCalls = [];
  const world = {
    add: (...args) => addCalls.push(args),
    tick: (...args) => tickCalls.push(args),
    get: () => null,
  };

  const dispatch = makeRulesDispatcher(world, () => 7);
  dispatch({ type: "rules.dropItem", payload: { itemId: 9, count: 3 } });

  assertEquals(addCalls.length, 1);
  assertEquals(addCalls[0]?.[2], { itemId: 9, count: 3 });
  assertEquals(tickCalls, [[1]]);
});

Deno.test("rulesDispatch: dropItem ignores invalid item ids", () => {
  const addCalls = [];
  const tickCalls = [];
  const world = {
    add: (...args) => addCalls.push(args),
    tick: (...args) => tickCalls.push(args),
    get: () => null,
  };

  const dispatch = makeRulesDispatcher(world, () => 7);
  dispatch({ type: "rules.dropItem", payload: { itemId: 0 } });
  dispatch({ type: "rules.dropItem", payload: { itemId: -1 } });
  dispatch({ type: "rules.dropItem", payload: { itemId: 1.5 } });

  assertEquals(addCalls.length, 0);
  assertEquals(tickCalls.length, 0);
});
