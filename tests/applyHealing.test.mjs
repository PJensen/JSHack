import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { HealingApplied } from "../src/rules/components/HealingApplied.js";
import { HealingModifiers } from "../src/rules/components/HealingModifiers.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { applyHealing } from "../src/rules/utils/applyHealing.js";

function actor(world, hp = 5, maxHp = 20) {
  const id = world.create();
  world.add(id, Vitality, { hp, maxHp });
  return id;
}

Deno.test("applyHealing applies, clamps, records, and emits the actual amount", () => {
  const world = new World({ seed: 1 });
  const source = actor(world, 20, 20);
  const target = actor(world, 17, 20);
  const events = [];
  world.on("healed", (event) => events.push(event));

  const result = applyHealing(world, { target, source, amount: 12, cause: "test" });

  assertEquals(result, { applied: true, amount: 3, rawAmount: 12, resolvedAmount: 12, reason: "applied" });
  assertEquals(world.get(target, Vitality).hp, 20);
  assertEquals(events.length, 1);
  assertEquals(events[0].amount, 3);
  const records = [...world.query(HealingApplied)];
  assertEquals(records.length, 1);
  assertEquals(records[0][1].target, target);
  assertEquals(records[0][1].hpBefore, 17);
  assertEquals(records[0][1].hpAfter, 20);
});

Deno.test("applyHealing combines outgoing, incoming, and suppression modifiers", () => {
  const world = new World({ seed: 2 });
  const source = actor(world, 20, 20);
  const target = actor(world, 1, 20);
  world.add(source, HealingModifiers, { outgoingMultiplier: 1.5, incomingMultiplier: 1, suppression: 0 });
  world.add(target, HealingModifiers, { outgoingMultiplier: 1, incomingMultiplier: 0.5, suppression: 0.5 });

  const result = applyHealing(world, { target, source, amount: 20 });

  assertEquals(result.resolvedAmount, 7);
  assertEquals(result.amount, 7);
  assertEquals(world.get(target, Vitality).hp, 8);
});

Deno.test("applyHealing supports complete suppression and bypass", () => {
  const world = new World({ seed: 3 });
  const target = actor(world, 4, 20);
  world.add(target, HealingModifiers, { outgoingMultiplier: 1, incomingMultiplier: 1, suppression: 1 });

  const blocked = applyHealing(world, { target, amount: 10 });
  assertEquals(blocked.reason, "suppressed");
  assertEquals(world.get(target, Vitality).hp, 4);
  assertEquals([...world.query(HealingApplied)].length, 0);

  const bypassed = applyHealing(world, { target, amount: 10, bypassModifiers: true });
  assert(bypassed.applied);
  assertEquals(world.get(target, Vitality).hp, 14);
});

Deno.test("applyHealing rejects dead targets and does not resurrect", () => {
  const world = new World({ seed: 4 });
  const target = actor(world, 0, 20);
  const result = applyHealing(world, { target, amount: 10 });
  assertEquals(result.reason, "no-vitality");
  assertEquals(world.get(target, Vitality).hp, 0);
});
