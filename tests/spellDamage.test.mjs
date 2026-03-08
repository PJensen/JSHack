import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { Brain } from "../src/rules/components/Brain.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { effectSystem } from "../src/rules/systems/effectSystem.js";
import { runSpellScript } from "../src/rules/scripts/spells.js";
import { getSpell } from "../src/rules/data/spells.js";
import { scaleSpellDamage } from "../src/rules/utils/spellDamage.js";

function makeCaster(world, { x = 1, y = 1, intelligence = 10, critChanceDerived = 0, critMultDerived = 0 } = {}) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Brain, { learnedSpellIds: [], intelligence });
  world.add(id, Equipment, { critChanceDerived, critMultDerived });
  world.add(id, Faction, { key: "player" });
  world.add(id, Vitality, { hp: 30, maxHp: 30 });
  return id;
}

function makeTarget(world, { x = 2, y = 1, hp = 40, faction = "enemy" } = {}) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Faction, { key: faction });
  world.add(id, Vitality, { hp, maxHp: hp });
  return id;
}

Deno.test("scaleSpellDamage preserves baseline damage and rewards extra intelligence", () => {
  const world = new World({ seed: 0xC0FFEE });
  const baseline = makeCaster(world, { intelligence: 10 });
  const smart = makeCaster(world, { intelligence: 20 });

  assertEquals(scaleSpellDamage(world, baseline, 10), 10);
  assert(scaleSpellDamage(world, smart, 10) > 10, "extra INT should increase spell damage");
});

Deno.test("destruction spell damage can crit using crit-derived stats", () => {
  const world = new World({ seed: 0xFACE });
  const caster = makeCaster(world, { intelligence: 10, critChanceDerived: 1.0 });
  const target = makeTarget(world, { x: 4, y: 1, hp: 40 });
  const events = [];
  world.on("damaged", (event) => events.push(event));

  runSpellScript(world, caster, getSpell("shadow_bolt"), {});

  assertEquals(events.length, 1);
  assertEquals(events[0].cause, "spell:shadow_bolt");
  assertEquals(events[0].critical, true);
  assert(events[0].amount >= 16, `crit should at least double the 8-damage baseline, got ${events[0].amount}`);
  assertEquals(world.get(target, Vitality).hp, 40 - events[0].amount);
});

Deno.test("agony DOT inherits spell crit rules on tick", () => {
  const world = new World({ seed: 0xBEEF });
  const caster = makeCaster(world, { intelligence: 18, critChanceDerived: 1.0 });
  const target = makeTarget(world, { x: 2, y: 1, hp: 40 });
  const events = [];
  world.on("damaged", (event) => events.push(event));

  world.add(target, ActiveEffects, {
    effects: [{
      key: "agony",
      turnsLeft: 3,
      potency: 1,
      stacks: 1,
      startedAtTurn: world.step,
      sourceId: caster,
      spellId: "agony",
    }],
  });

  effectSystem(world);

  assert(events.length >= 1, "Agony tick should emit damage");
  assertEquals(events[0].cause, "spell:agony");
  assertEquals(events[0].critical, true);
  assert(events[0].amount >= 2, `crit Agony tick should exceed baseline damage, got ${events[0].amount}`);
});
