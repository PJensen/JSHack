import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Status } from "../src/rules/components/Status.js";
import { MoveIntent } from "../src/rules/components/Intents/MoveIntent.js";
import { WaitIntent } from "../src/rules/components/Intents/WaitIntent.js";
import { CastSpellIntent } from "../src/rules/components/Intents/CastSpellIntent.js";
import { makeRulesDispatcher } from "../src/main/input/rulesDispatch.js";

function makeActorWorld({ stunned = false } = {}) {
  const world = new World({ seed: 7 });
  const actor = world.create();
  if (stunned) {
    world.add(actor, Status, {
      statuses: [{ type: "stunned", duration: 2, potency: 1, stacks: 1 }],
    });
  }

  let tickCount = 0;
  world.tick = (dt) => {
    tickCount += Number(dt || 0);
  };

  return {
    world,
    actor,
    getTickCount: () => tickCount,
  };
}

Deno.test("rulesDispatch: stunned move input becomes wait", () => {
  const { world, actor, getTickCount } = makeActorWorld({ stunned: true });
  const dispatch = makeRulesDispatcher(world, () => actor);

  dispatch({ type: "rules.move", payload: { dx: 1, dy: 0 } });

  assertEquals(world.has(actor, MoveIntent), false);
  assertEquals(world.has(actor, WaitIntent), true);
  assertEquals(getTickCount(), 1);
});

Deno.test("rulesDispatch: stunned cast input becomes wait", () => {
  const { world, actor, getTickCount } = makeActorWorld({ stunned: true });
  const dispatch = makeRulesDispatcher(world, () => actor);

  dispatch({ type: "rules.castActiveSpell", payload: { spellId: "heal" } });

  assertEquals(world.has(actor, CastSpellIntent), false);
  assertEquals(world.has(actor, WaitIntent), true);
  assertEquals(getTickCount(), 1);
});

Deno.test("rulesDispatch: unstunned move input stays as move", () => {
  const { world, actor, getTickCount } = makeActorWorld({ stunned: false });
  const dispatch = makeRulesDispatcher(world, () => actor);

  dispatch({ type: "rules.move", payload: { dx: -1, dy: 0 } });

  assertEquals(world.has(actor, MoveIntent), true);
  assertEquals(world.has(actor, WaitIntent), false);
  assertEquals(getTickCount(), 1);
});
