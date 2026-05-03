import "./helpers/installContentMonsters.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { Brain } from "../src/rules/components/Brain.js";
import { getMonster } from "../src/rules/data/monsters.js";
import { CombatCallbackContext } from "../src/rules/data/callbacks/combat.js";
import { runCallbackList } from "../src/rules/interaction/dispatch.js";

Deno.test("spider poison proc is short and low-potency when it triggers", () => {
  const hooks = getMonster("spider")?.hooks?.onHit;
  assert(Array.isArray(hooks) && hooks.length > 0, "spider onHit hooks should exist");

  let found = false;
  for (let seed = 0; seed < 4096; seed++) {
    const world = new World({ seed });
    const attacker = world.create();
    const defender = world.create();

    const ctx = new CombatCallbackContext(world, { attacker, defender, damage: 4 });
    runCallbackList(hooks, ctx);

    const ae = world.get(defender, ActiveEffects);
    const poison = ae?.effects?.find((e) => e.key === "poison");
    if (!poison) continue;

    assertEquals(Number(poison.turnsLeft), 3, "spider poison should last 3 turns");
    assertEquals(Number(poison.potency), 1, "spider poison potency should remain 1");
    found = true;
    break;
  }

  assert(found, "expected at least one deterministic seed to trigger spider poison");
});

Deno.test("troll smash on-hit applies regen to attacker", () => {
  const world = new World({ seed: 123 });
  const attacker = world.create();
  const defender = world.create();

  const hooks = getMonster("troll")?.hooks?.onHit;
  assert(Array.isArray(hooks) && hooks.length > 0, "troll onHit hooks should exist");

  const ctx = new CombatCallbackContext(world, { attacker, defender, damage: 5 });
  runCallbackList(hooks, ctx);

  const ae = world.get(attacker, ActiveEffects);
  assert(ae && Array.isArray(ae.effects), "attacker should gain active effects");
  assert(ae.effects.some((e) => e.key === "regen"), "regen effect should be applied to attacker");
});

Deno.test("lich drain on-damaged can emit phylactery event with defender actor", () => {
  const hooks = getMonster("lich")?.hooks?.onDamaged;
  assert(Array.isArray(hooks) && hooks.length > 0, "lich onDamaged hooks should exist");

  let found = false;
  for (let seed = 0; seed < 2048; seed++) {
    const world = new World({ seed });
    const attacker = world.create();
    const defender = world.create();
    let payload = null;

    world.on("proc:phylactery", (evt) => { payload = evt; });

    const ctx = new CombatCallbackContext(world, { attacker, defender, damage: 4 });
    runCallbackList(hooks, ctx);

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
  const hooks = getMonster("floating_eye")?.hooks?.onHit;
  assert(Array.isArray(hooks) && hooks.length > 0, "floating eye onHit hooks should exist");

  let found = false;
  for (let seed = 0; seed < 4096; seed++) {
    const world = new World({ seed });
    const attacker = world.create();
    const defender = world.create();
    world.add(defender, Brain, { learnedSpellIds: ["fireball", "heal"] });
    let payload = null;

    world.on("proc:mindwipe", (evt) => { payload = evt; });

    const ctx = new CombatCallbackContext(world, { attacker, defender, damage: 7 });
    runCallbackList(hooks, ctx);

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
