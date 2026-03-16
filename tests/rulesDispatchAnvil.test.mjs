import { assertEquals } from "jsr:@std/assert";
import { makeRulesDispatcher } from "../src/main/input/rulesDispatch.js";

Deno.test("rulesDispatch: forgeAtAnvil queues InteractIntent in forge mode", () => {
  const addCalls = [];
  const tickCalls = [];
  const world = {
    add: (...args) => addCalls.push(args),
    tick: (...args) => tickCalls.push(args),
    get: () => null,
  };

  const dispatch = makeRulesDispatcher(world, () => 11);
  dispatch({ type: "rules.forgeAtAnvil", payload: { anvilId: 15, recipe: "Warhammer" } });

  assertEquals(addCalls.length, 1);
  assertEquals(addCalls[0]?.[0], 11);
  assertEquals(addCalls[0]?.[2], { targetId: 15, mode: "forge", recipe: "warhammer" });
  assertEquals(tickCalls.length, 1);
  assertEquals(tickCalls[0]?.[0], 1);
});

Deno.test("rulesDispatch: forgeAtAnvil ignores invalid payloads", () => {
  const addCalls = [];
  const tickCalls = [];
  const world = {
    add: (...args) => addCalls.push(args),
    tick: (...args) => tickCalls.push(args),
    get: () => null,
  };

  const dispatch = makeRulesDispatcher(world, () => 11);
  dispatch({ type: "rules.forgeAtAnvil", payload: { anvilId: 0, recipe: "warhammer" } });
  dispatch({ type: "rules.forgeAtAnvil", payload: { anvilId: -2, recipe: "warhammer" } });
  dispatch({ type: "rules.forgeAtAnvil", payload: { anvilId: 4, recipe: "" } });

  assertEquals(addCalls.length, 0);
  assertEquals(tickCalls.length, 0);
});
