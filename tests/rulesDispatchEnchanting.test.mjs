import { assertEquals } from "jsr:@std/assert";
import { makeRulesDispatcher } from "../src/main/input/rulesDispatch.js";
import { InteractIntent } from "../src/rules/components/Intents/InteractIntent.js";

Deno.test("rulesDispatch: craftEnchant queues InteractIntent in enchant mode", () => {
  const addCalls = [];
  const tickCalls = [];
  const world = {
    add: (...args) => addCalls.push(args),
    tick: (...args) => tickCalls.push(args),
    get: () => null,
  };

  const dispatch = makeRulesDispatcher(world, () => 77);
  dispatch({ type: "rules.craftEnchant", payload: { benchId: 15, recipe: "firestorm_script" } });

  assertEquals(addCalls.length, 1);
  assertEquals(addCalls[0]?.[0], 77);
  assertEquals(addCalls[0]?.[1], InteractIntent);
  assertEquals(addCalls[0]?.[2], { targetId: 15, mode: "enchant", recipe: "firestorm_script" });
  assertEquals(tickCalls, [[1]]);
});

Deno.test("rulesDispatch: craftEnchant ignores invalid payloads", () => {
  const addCalls = [];
  const tickCalls = [];
  const world = {
    add: (...args) => addCalls.push(args),
    tick: (...args) => tickCalls.push(args),
    get: () => null,
  };

  const dispatch = makeRulesDispatcher(world, () => 9);
  dispatch({ type: "rules.craftEnchant", payload: { benchId: 0, recipe: "firestorm_script" } });
  dispatch({ type: "rules.craftEnchant", payload: { benchId: -2, recipe: "firestorm_script" } });
  dispatch({ type: "rules.craftEnchant", payload: { benchId: 4, recipe: "" } });

  assertEquals(addCalls.length, 0);
  assertEquals(tickCalls.length, 0);
});
