import { assertEquals } from "jsr:@std/assert";
import { makeRulesDispatcher } from "../src/main/input/rulesDispatch.js";
import { CastSpellIntent } from "../src/rules/components/Intents/CastSpellIntent.js";

Deno.test("rulesDispatch: castActiveSpell forwards target tile coordinates", () => {
  const addCalls = [];
  const tickCalls = [];
  const world = {
    add: (...args) => addCalls.push(args),
    tick: (...args) => tickCalls.push(args),
    get: () => null,
  };

  const dispatch = makeRulesDispatcher(world, () => 99);
  dispatch({
    type: "rules.castActiveSpell",
    payload: { spellId: "blink", targetId: 99, x: 12.8, y: 7.1 },
  });

  assertEquals(addCalls.length, 1);
  assertEquals(addCalls[0]?.[0], 99);
  assertEquals(addCalls[0]?.[1], CastSpellIntent);
  assertEquals(addCalls[0]?.[2], { spellId: "blink", targetId: 99, x: 12, y: 7 });
  assertEquals(tickCalls, [[1]]);
});

Deno.test("rulesDispatch: castActiveSpell without spellId delegates to ui event", () => {
  const addCalls = [];
  const tickCalls = [];
  const world = {
    add: (...args) => addCalls.push(args),
    tick: (...args) => tickCalls.push(args),
    get: () => null,
  };
  const dispatch = makeRulesDispatcher(world, () => 42);

  let emitted = 0;
  const onCast = () => { emitted += 1; };
  globalThis.addEventListener("ui:castActiveSpell", onCast);
  try {
    dispatch({
      type: "rules.castActiveSpell",
      payload: {},
    });
  } finally {
    globalThis.removeEventListener("ui:castActiveSpell", onCast);
  }

  assertEquals(emitted, 1);
  assertEquals(addCalls.length, 0);
  assertEquals(tickCalls.length, 0);
});
