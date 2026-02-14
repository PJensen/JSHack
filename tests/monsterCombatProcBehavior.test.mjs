import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ScriptVerb, runScript } from "../src/rules/scripting.js";
import "../src/rules/scripts/monsters.js";

Deno.test("demon hellfire retaliation proc is applied on damaged", () => {
  const world = new World({ seed: 500 });
  let retaliated = 0;

  runScript("monster:demonHellfire", ScriptVerb.AffixOnDamaged, world, {
    attacker: 1,
    defender: 2,
    retaliate: (amount) => { retaliated += amount; },
  });

  assertEquals(retaliated, 2);
});

Deno.test("orc rage proc can add flat damage for some deterministic seed", () => {
  let found = false;
  for (let seed = 0; seed < 512; seed++) {
    const world = new World({ seed });
    const ctx = { attacker: 1, defender: 2, damage: 10 };
    runScript("monster:orcRage", ScriptVerb.AffixOnBeforeHit, world, ctx);
    if (ctx.damage === 12) {
      found = true;
      break;
    }
  }
  assert(found, "expected at least one deterministic seed to trigger orc rage");
});

Deno.test("wraith touch proc can drain expected amount for some deterministic seed", () => {
  let found = false;
  for (let seed = 0; seed < 1024; seed++) {
    const world = new World({ seed });
    let healed = 0;
    runScript("monster:wraithTouch", ScriptVerb.AffixOnHit, world, {
      attacker: 1,
      defender: 2,
      damage: 9,
      healAttacker: (amount) => { healed += amount; },
    });
    if (healed === 3) {
      found = true;
      break;
    }
  }
  assert(found, "expected at least one deterministic seed to trigger wraith drain");
});

