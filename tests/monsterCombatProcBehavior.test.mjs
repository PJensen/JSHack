import "./helpers/installContentMonsters.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { getMonster } from "../src/rules/data/monsters.js";
import { CombatCallbackContext } from "../src/rules/data/callbacks/combat.js";
import { runCallbackList } from "../src/rules/interaction/dispatch.js";

Deno.test("demon hellfire retaliation proc is applied on damaged", () => {
  const world = new World({ seed: 500 });
  let retaliated = 0;

  const hooks = getMonster("demon")?.hooks?.onDamaged;
  assert(Array.isArray(hooks) && hooks.length > 0, "demon onDamaged hooks should exist");

  const frame = {
    attacker: 1,
    defender: 2,
    damage: 10,
    retaliate: (amount) => { retaliated += amount; },
  };
  const ctx = new CombatCallbackContext(world, frame);
  runCallbackList(hooks, ctx);

  assertEquals(retaliated, 2);
});

Deno.test("orc rage proc can add flat damage for some deterministic seed", () => {
  const hooks = getMonster("orc")?.hooks?.onBeforeHit;
  assert(Array.isArray(hooks) && hooks.length > 0, "orc onBeforeHit hooks should exist");

  let found = false;
  for (let seed = 0; seed < 512; seed++) {
    const world = new World({ seed });
    const frame = { attacker: 1, defender: 2, damage: 10 };
    const ctx = new CombatCallbackContext(world, frame);
    runCallbackList(hooks, ctx);
    if (frame.damage === 12) {
      found = true;
      break;
    }
  }
  assert(found, "expected at least one deterministic seed to trigger orc rage");
});

Deno.test("wraith touch proc can drain expected amount for some deterministic seed", () => {
  const hooks = getMonster("wraith")?.hooks?.onHit;
  assert(Array.isArray(hooks) && hooks.length > 0, "wraith onHit hooks should exist");

  let found = false;
  for (let seed = 0; seed < 1024; seed++) {
    const world = new World({ seed });
    let healed = 0;
    const frame = {
      attacker: 1,
      defender: 2,
      damage: 9,
      healAttacker: (amount) => { healed += amount; },
    };
    const ctx = new CombatCallbackContext(world, frame);
    runCallbackList(hooks, ctx);
    if (healed === 3) {
      found = true;
      break;
    }
  }
  assert(found, "expected at least one deterministic seed to trigger wraith drain");
});
