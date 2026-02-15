import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { ActiveEffects } from '../src/rules/components/ActiveEffects.js';
import { ActionTransaction, applyMutation } from '../src/rules/interaction/mutations.js';

function makeWorld() {
  return new World({ seed: 1 });
}

Deno.test("enqueue damage: world unchanged until commit", () => {
  const world = makeWorld();
  const e = world.create();
  world.add(e, Vitality, { maxHp: 20, hp: 20 });

  const q = new ActionTransaction();
  q.enqueue({ type: "damage", entityId: e, amount: 5, source: "test" });

  const vit = world.get(e, Vitality);
  assert(vit.hp === 20, "hp unchanged before commit");
  assertEquals(q.length, 1);
});

Deno.test("commit damage: Vitality.hp reduced", () => {
  const world = makeWorld();
  const e = world.create();
  world.add(e, Vitality, { maxHp: 20, hp: 20 });

  const q = new ActionTransaction();
  q.enqueue({ type: "damage", entityId: e, amount: 7, source: "test" });
  const applied = q.commit(world);

  const vit = world.get(e, Vitality);
  assertEquals(vit.hp, 13);
  assertEquals(applied.length, 1);
});

Deno.test("commit heal: hp clamped to maxHp", () => {
  const world = makeWorld();
  const e = world.create();
  world.add(e, Vitality, { maxHp: 10, hp: 3 });

  const q = new ActionTransaction();
  q.enqueue({ type: "heal", entityId: e, amount: 100 });
  q.commit(world);

  assertEquals(world.get(e, Vitality).hp, 10);
});

Deno.test("commit pushEffect: ActiveEffects.effects has entry", () => {
  const world = makeWorld();
  const e = world.create();

  const q = new ActionTransaction();
  q.enqueue({ type: "pushEffect", entityId: e, effect: { key: "poison", turnsLeft: 5, potency: 2 } });
  q.commit(world);

  const ae = world.get(e, ActiveEffects);
  assert(ae && Array.isArray(ae.effects), "ActiveEffects created");
  assertEquals(ae.effects.length, 1);
  assertEquals(ae.effects[0].key, "poison");
  assertEquals(ae.effects[0].stacks, 1);
});

Deno.test("commit multiple ops: all applied in order", () => {
  const world = makeWorld();
  const e = world.create();
  world.add(e, Vitality, { maxHp: 20, hp: 20 });

  const q = new ActionTransaction();
  q.enqueue({ type: "damage", entityId: e, amount: 5, source: "a" });
  q.enqueue({ type: "heal", entityId: e, amount: 2 });
  q.enqueue({ type: "damage", entityId: e, amount: 3, source: "b" });
  q.commit(world);

  // 20 - 5 + 2 - 3 = 14
  assertEquals(world.get(e, Vitality).hp, 14);
});

Deno.test("cancel: commit returns empty, world unchanged", () => {
  const world = makeWorld();
  const e = world.create();
  world.add(e, Vitality, { maxHp: 20, hp: 20 });

  const q = new ActionTransaction();
  q.enqueue({ type: "damage", entityId: e, amount: 10, source: "test" });
  q.cancel("blind");

  assert(q.cancelled === true);
  const applied = q.commit(world);
  assertEquals(applied.length, 0);
  assertEquals(world.get(e, Vitality).hp, 20);
});

Deno.test("cancel with structured reason", () => {
  const q = new ActionTransaction();
  q.cancel({ code: "WELDED_WEAPON", message: "You cannot let go!", consumesTurn: true });
  assert(q.cancelled);
  assertEquals(q.cancelReason.code, "WELDED_WEAPON");
  assertEquals(q.cancelReason.consumesTurn, true);
});

Deno.test("discard: returns discarded ops, world unchanged", () => {
  const world = makeWorld();
  const e = world.create();
  world.add(e, Vitality, { maxHp: 20, hp: 20 });

  const q = new ActionTransaction();
  q.enqueue({ type: "damage", entityId: e, amount: 5, source: "test" });
  const discarded = q.discard();

  assertEquals(discarded.length, 1);
  assertEquals(q.length, 0);
  assertEquals(world.get(e, Vitality).hp, 20);
});

Deno.test("applyMutation damage emits died when hp reaches 0", () => {
  const world = makeWorld();
  const e = world.create();
  world.add(e, Vitality, { maxHp: 10, hp: 3 });

  const events = [];
  world.on("died", (ev) => events.push(ev));
  applyMutation(world, { type: "damage", entityId: e, amount: 5, source: "lethal" });

  assertEquals(world.get(e, Vitality).hp, 0);
  assert(events.length >= 1, "died event emitted");
  assertEquals(events[0].id, e);
});
