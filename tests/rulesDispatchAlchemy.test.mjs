import { assertEquals } from "jsr:@std/assert";
import { makeRulesDispatcher } from "../src/main/input/rulesDispatch.js";
import { InteractIntent } from "../src/rules/components/Intents/InteractIntent.js";

Deno.test("rulesDispatch: brewAlchemy queues InteractIntent in brew mode", () => {
  const addCalls = [];
  const tickCalls = [];
  const world = {
    add: (...args) => addCalls.push(args),
    tick: (...args) => tickCalls.push(args),
    get: () => null,
  };

  const dispatch = makeRulesDispatcher(world, () => 77);
  dispatch({ type: "rules.brewAlchemy", payload: { benchId: 15, recipe: "Venom_Draft" } });

  assertEquals(addCalls.length, 1);
  assertEquals(addCalls[0]?.[0], 77);
  assertEquals(addCalls[0]?.[1], InteractIntent);
  assertEquals(addCalls[0]?.[2], { targetId: 15, mode: "brew", recipe: "venom_draft" });
  assertEquals(tickCalls, [[1]]);
});

Deno.test("rulesDispatch: brewAlchemy ignores invalid payloads", () => {
  const addCalls = [];
  const tickCalls = [];
  const world = {
    add: (...args) => addCalls.push(args),
    tick: (...args) => tickCalls.push(args),
    get: () => null,
  };

  const dispatch = makeRulesDispatcher(world, () => 9);
  dispatch({ type: "rules.brewAlchemy", payload: { benchId: 0, recipe: "venom_draft" } });
  dispatch({ type: "rules.brewAlchemy", payload: { benchId: -2, recipe: "venom_draft" } });
  dispatch({ type: "rules.brewAlchemy", payload: { benchId: 4, recipe: "" } });

  assertEquals(addCalls.length, 0);
  assertEquals(tickCalls.length, 0);
});
