import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { getMonster, getMonsterLootTable } from "../src/rules/data/monsters.js";
import { CombatCallbackContext, drainAndWeakenOnHit } from "../src/rules/data/callbacks/combat.js";

Deno.test("wight uses dedicated loot table for satisfying kill rewards", () => {
  const wight = getMonster("wight");
  assert(wight, "wight should exist");
  assertEquals(getMonsterLootTable(wight), "drop:wight");
});

Deno.test("drainAndWeakenOnHit enforces cooldown windows and emits windup", () => {
  const world = new World({ seed: 0xC0FFEE });
  const attacker = world.create();
  const defender = world.create();
  world.add(attacker, Vitality, { maxHp: 20, hp: 10 });
  world.add(defender, Vitality, { maxHp: 20, hp: 20 });

  let procCount = 0;
  let windupCount = 0;
  world.on("test:wight:proc", () => { procCount++; });
  world.on("test:wight:windup", () => { windupCount++; });

  const cb = drainAndWeakenOnHit({
    chancePct: 100,
    cooldownTurns: 3,
    divisor: 2,
    weakenedTurns: 4,
    weakenedPotency: 1,
    procEvent: "test:wight:proc",
    windupEvent: "test:wight:windup",
  });

  function runNow() {
    const ctx = new CombatCallbackContext(world, {
      attacker,
      defender,
      damage: 10,
      healAttacker: (amount) => {
        const vit = world.get(attacker, Vitality);
        vit.hp = Math.min(vit.maxHp, vit.hp + (amount | 0));
      },
    });
    cb(ctx);
  }

  runNow(); // step 0 proc
  assertEquals(procCount, 1);
  assertEquals(world.get(attacker, Vitality).hp, 15);
  assert(world.get(defender, ActiveEffects)?.effects?.some((e) => e.key === "weakened"), "first proc should apply weakened");

  world.step += 1;
  runNow(); // step 1 cooldown
  world.step += 1;
  runNow(); // step 2 cooldown + windup
  assertEquals(procCount, 1, "cooldown should block proc");
  assertEquals(windupCount, 1, "one-turn-remaining window should emit windup");

  world.step += 1;
  runNow(); // step 3 ready again
  assertEquals(procCount, 2, "proc should fire when cooldown expires");
  assertEquals(world.get(attacker, Vitality).hp, 20, "second proc should heal again (capped)");
});
