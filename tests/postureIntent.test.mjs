import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { SetPostureIntent } from "../src/rules/components/Intents/SetPostureIntent.js";
import { COMBAT_POSTURES } from "../src/rules/components/CombatPosture.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { makeRulesDispatcher } from "../src/main/input/rulesDispatch.js";
import { postureIntentSystem } from "../src/rules/systems/postureIntentSystem.js";
import { getPostureState } from "../src/rules/utils/posture.js";

Deno.test("postureIntentSystem cycles posture in canonical order", () => {
  const world = new World({ seed: 0x991 });
  const actor = world.create();
  world.add(actor, Vitality, { hp: 10, maxHp: 10 });

  world.add(actor, SetPostureIntent, { mode: "cycle" });
  postureIntentSystem(world);
  assertEquals(getPostureState(world, actor)?.stance, COMBAT_POSTURES.aggressive);

  world.add(actor, SetPostureIntent, { mode: "cycle" });
  postureIntentSystem(world);
  assertEquals(getPostureState(world, actor)?.stance, COMBAT_POSTURES.guarded);

  world.add(actor, SetPostureIntent, { mode: "cycle" });
  postureIntentSystem(world);
  assertEquals(getPostureState(world, actor)?.stance, COMBAT_POSTURES.balanced);
});

Deno.test("rulesDispatch emits SetPostureIntent and ticks for rules.cyclePosture", () => {
  const world = new World({ seed: 0x992 });
  const actor = world.create();
  world.add(actor, Vitality, { hp: 10, maxHp: 10 });
  let ticks = 0;
  world.tick = (dt) => { ticks += Number(dt || 0); };

  const dispatch = makeRulesDispatcher(world, () => actor);
  dispatch({ type: "rules.cyclePosture", payload: {} });

  assertEquals(world.has(actor, SetPostureIntent), true);
  assertEquals(ticks, 1);
});
