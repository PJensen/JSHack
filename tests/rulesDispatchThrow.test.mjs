import { assertEquals } from "jsr:@std/assert";
import { makeRulesDispatcher } from "../src/main/input/rulesDispatch.js";
import { ThrowIntent } from "../src/rules/components/Intents/ThrowIntent.js";

Deno.test("rulesDispatch: throwItem forwards target tile coordinates", () => {
  const addCalls = [];
  const tickCalls = [];
  const world = {
    add: (...args) => addCalls.push(args),
    tick: (...args) => tickCalls.push(args),
    get: () => null,
  };

  const dispatch = makeRulesDispatcher(world, () => 77);
  dispatch({
    type: "rules.throwItem",
    payload: { itemId: 11, targetId: 99, x: 14.9, y: 3.2 },
  });

  assertEquals(addCalls.length, 1);
  assertEquals(addCalls[0]?.[0], 77);
  assertEquals(addCalls[0]?.[1], ThrowIntent);
  assertEquals(addCalls[0]?.[2], { itemId: 11, targetId: 99, x: 14, y: 3 });
  assertEquals(tickCalls, [[1]]);
});

Deno.test("rulesDispatch: throwItem ignores invalid item ids", () => {
  const addCalls = [];
  const tickCalls = [];
  const world = {
    add: (...args) => addCalls.push(args),
    tick: (...args) => tickCalls.push(args),
    get: () => null,
  };

  const dispatch = makeRulesDispatcher(world, () => 7);
  dispatch({ type: "rules.throwItem", payload: { itemId: 0 } });
  dispatch({ type: "rules.throwItem", payload: { itemId: -1 } });
  dispatch({ type: "rules.throwItem", payload: { itemId: 1.5 } });

  assertEquals(addCalls.length, 0);
  assertEquals(tickCalls.length, 0);
});

Deno.test("rulesDispatch: input lock blocks throw intents", () => {
  const addCalls = [];
  const tickCalls = [];
  const world = {
    add: (...args) => addCalls.push(args),
    tick: (...args) => tickCalls.push(args),
    get: () => null,
  };

  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, "window");
  const prevWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    value: { __JSHACK_INPUT_LOCKED: true },
    configurable: true,
    writable: true,
  });

  try {
    const dispatch = makeRulesDispatcher(world, () => 42);
    dispatch({ type: "rules.throwItem", payload: { itemId: 5, x: 9, y: 9 } });
  } finally {
    if (hadWindow) {
      Object.defineProperty(globalThis, "window", {
        value: prevWindow,
        configurable: true,
        writable: true,
      });
    } else {
      delete globalThis.window;
    }
  }

  assertEquals(addCalls.length, 0);
  assertEquals(tickCalls.length, 0);
});
