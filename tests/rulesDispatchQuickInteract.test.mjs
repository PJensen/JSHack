import { assertEquals } from "jsr:@std/assert";
import { makeRulesDispatcher } from "../src/main/input/rulesDispatch.js";
import { Position } from "../src/rules/components/Position.js";
import { Interactable } from "../src/rules/components/Interactable.js";
import { InteractIntent } from "../src/rules/components/Intents/InteractIntent.js";

Deno.test("rulesDispatch: quickInteract targets adjacent door and ticks once", () => {
  const addCalls = [];
  const tickCalls = [];
  const actorId = 11;
  const doorId = 22;
  const world = {
    add: (...args) => addCalls.push(args),
    tick: (...args) => tickCalls.push(args),
    get: (id, comp) => {
      if (id === actorId && comp === Position) return { x: 10, y: 10 };
      return null;
    },
    query: (...components) => {
      if (components[0] === Position && components[1] === Interactable) {
        return [[doorId, { x: 11, y: 10 }, { action: "toggleDoor" }]];
      }
      return [];
    },
  };

  const dispatch = makeRulesDispatcher(world, () => actorId);
  dispatch({ type: "rules.quickInteract", payload: {} });

  assertEquals(addCalls.length, 1);
  assertEquals(addCalls[0]?.[0], actorId);
  assertEquals(addCalls[0]?.[1], InteractIntent);
  assertEquals(addCalls[0]?.[2], { targetId: doorId });
  assertEquals(tickCalls, [[1]]);
});

Deno.test("rulesDispatch: quickInteract does nothing with no adjacent door", () => {
  const addCalls = [];
  const tickCalls = [];
  const actorId = 5;
  const world = {
    add: (...args) => addCalls.push(args),
    tick: (...args) => tickCalls.push(args),
    get: (id, comp) => {
      if (id === actorId && comp === Position) return { x: 0, y: 0 };
      return null;
    },
    query: (...components) => {
      if (components[0] === Position && components[1] === Interactable) {
        return [[99, { x: 2, y: 0 }, { action: "toggleDoor" }]];
      }
      return [];
    },
  };

  const dispatch = makeRulesDispatcher(world, () => actorId);
  dispatch({ type: "rules.quickInteract", payload: {} });

  assertEquals(addCalls.length, 0);
  assertEquals(tickCalls.length, 0);
});
