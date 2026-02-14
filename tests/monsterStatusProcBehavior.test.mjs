import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { Brain } from "../src/rules/components/Brain.js";
import { ScriptVerb, runScript } from "../src/rules/scripting.js";
import "../src/rules/scripts/monsters.js";

Deno.test("troll smash on-hit applies regen to attacker", () => {
  const world = new World({ seed: 123 });
  const attacker = world.create();
  const defender = world.create();

  runScript("monster:trollSmash", ScriptVerb.AffixOnHit, world, {
    attacker,
    defender,
    damage: 5,
  });

  const ae = world.get(attacker, ActiveEffects);
  assert(ae && Array.isArray(ae.effects), "attacker should gain active effects");
  assert(ae.effects.some((e) => e.key === "regen"), "regen effect should be applied to attacker");
});

Deno.test("lich drain on-damaged can emit phylactery event with defender actor", () => {
  let found = false;
  for (let seed = 0; seed < 2048; seed++) {
    const world = new World({ seed });
    const attacker = world.create();
    const defender = world.create();
    let payload = null;

    world.on("proc:phylactery", (evt) => { payload = evt; });

    runScript("monster:lichDrain", ScriptVerb.AffixOnDamaged, world, {
      attacker,
      defender,
      damage: 4,
    });

    const ae = world.get(defender, ActiveEffects);
    if (ae && Array.isArray(ae.effects) && ae.effects.some((e) => e.key === "regen")) {
      assert(payload && payload.actor === defender, "phylactery payload should use defender as actor");
      found = true;
      break;
    }
  }

  assert(found, "expected at least one deterministic seed to trigger phylactery regen");
});

Deno.test("mind flayer on-hit callback can wipe spells and apply mindwipe", () => {
  let found = false;
  for (let seed = 0; seed < 4096; seed++) {
    const world = new World({ seed });
    const attacker = world.create();
    const defender = world.create();
    world.add(defender, Brain, { learnedSpellIds: ["fireball", "heal"] });
    let payload = null;

    world.on("proc:mindwipe", (evt) => { payload = evt; });

    runScript("monster:mindflayerBlast", ScriptVerb.AffixOnHit, world, {
      attacker,
      defender,
      damage: 7,
    });

    const ae = world.get(defender, ActiveEffects);
    if (ae && Array.isArray(ae.effects) && ae.effects.some((e) => e.key === "mindwipe")) {
      const brain = world.get(defender, Brain);
      assert(brain, "defender brain should exist");
      assertEquals(Array.isArray(brain.learnedSpellIds), true);
      assertEquals(brain.learnedSpellIds.length, 0);
      assert(payload && payload.actor === attacker && payload.target === defender, "mindwipe payload should include attacker and defender");
      assert(Number.isInteger(payload.affectedDepth), "mindwipe payload should include affectedDepth");
      found = true;
      break;
    }
  }

  assert(found, "expected at least one deterministic seed to trigger mindwipe");
});
