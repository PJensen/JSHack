import { assertEquals } from "jsr:@std/assert";
import { makeRulesDispatcher } from "../src/main/input/rulesDispatch.js";
import { InteractIntent } from "../src/rules/components/Intents/InteractIntent.js";

Deno.test("rulesDispatch: altarOffer queues InteractIntent offer mode", () => {
  const addCalls = [];
  const tickCalls = [];
  const world = {
    add: (...args) => addCalls.push(args),
    tick: (...args) => tickCalls.push(args),
    emit: () => { throw new Error("altarOffer should not emit directly"); },
    destroy: () => { throw new Error("altarOffer should not destroy directly"); },
  };

  const dispatch = makeRulesDispatcher(world, () => 41);
  dispatch({ type: "rules.altarOffer", payload: { altarId: 12, itemId: 77 } });

  assertEquals(addCalls.length, 1);
  assertEquals(addCalls[0]?.[0], 41);
  assertEquals(addCalls[0]?.[1], InteractIntent);
  assertEquals(addCalls[0]?.[2], { targetId: 12, mode: "offer", itemId: 77 });
  assertEquals(tickCalls, [[1]]);
});

Deno.test("rulesDispatch: altarOffer ignores invalid payloads", () => {
  const addCalls = [];
  const tickCalls = [];
  const world = {
    add: (...args) => addCalls.push(args),
    tick: (...args) => tickCalls.push(args),
  };

  const dispatch = makeRulesDispatcher(world, () => 7);
  dispatch({ type: "rules.altarOffer", payload: { altarId: 0, itemId: 9 } });
  dispatch({ type: "rules.altarOffer", payload: { altarId: 2, itemId: 0 } });
  dispatch({ type: "rules.altarOffer", payload: { altarId: -1, itemId: 4 } });
  dispatch({ type: "rules.altarOffer", payload: { altarId: 3, itemId: -2 } });
  dispatch({ type: "rules.altarOffer", payload: { altarId: 3, itemId: 2.5 } });
  dispatch({ type: "rules.altarOffer", payload: { altarId: 1.1, itemId: 2 } });

  assertEquals(addCalls.length, 0);
  assertEquals(tickCalls.length, 0);
});
