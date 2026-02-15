import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { ActiveEffects } from '../src/rules/components/ActiveEffects.js';
import { RuleActionContext } from '../src/rules/utils/actionContexts.js';
import { runCallbackList } from '../src/rules/interaction/dispatch.js';

function makeWorld() {
  return new World({ seed: 1 });
}

// ── RuleActionContext cancellation ────────────────────────────────

Deno.test("cancel() prevents commit from applying mutations", () => {
  const world = makeWorld();
  const e = world.create();
  world.add(e, Vitality, { maxHp: 20, hp: 20 });

  const ctx = new RuleActionContext(world);
  ctx.damage(e, 10, "test");
  ctx.pushEffect(e, { key: "poison", turnsLeft: 5, potency: 2 });
  ctx.cancel({ code: "BLIND", message: "You can't read while blind." });

  assert(ctx.cancelled);
  const applied = ctx.commit();
  assertEquals(applied.length, 0);
  assertEquals(world.get(e, Vitality).hp, 20, "hp unchanged");
  assert(!world.get(e, ActiveEffects), "no effects applied");
});

Deno.test("fail() sets FAIL code", () => {
  const world = makeWorld();
  const ctx = new RuleActionContext(world);
  ctx.fail("You can't do that.", { consumesTurn: true });

  assert(ctx.cancelled);
  assertEquals(ctx.cancelReason.code, "FAIL");
  assertEquals(ctx.cancelReason.message, "You can't do that.");
  assertEquals(ctx.cancelReason.consumesTurn, true);
});

Deno.test("prevent() sets soft veto without blocking commit", () => {
  const world = makeWorld();
  const e = world.create();
  world.add(e, Vitality, { maxHp: 20, hp: 20 });

  const ctx = new RuleActionContext(world);
  ctx.damage(e, 3, "test");
  ctx.prevent("consume:item");

  assert(!ctx.cancelled, "prevent does not cancel");
  assert(ctx.isPrevented("consume:item"));
  assert(!ctx.isPrevented("other"));

  ctx.commit();
  assertEquals(world.get(e, Vitality).hp, 17, "damage still applied");
});

Deno.test("uncancelled commit applies all queued mutations", () => {
  const world = makeWorld();
  const e = world.create();
  world.add(e, Vitality, { maxHp: 20, hp: 20 });

  const ctx = new RuleActionContext(world);
  ctx.damage(e, 5, "fire");
  ctx.heal(e, 2);
  ctx.pushEffect(e, { key: "regen", turnsLeft: 3, potency: 1 });

  const applied = ctx.commit();
  assertEquals(applied.length, 3);
  assertEquals(world.get(e, Vitality).hp, 17); // 20 - 5 + 2
  const ae = world.get(e, ActiveEffects);
  assertEquals(ae.effects.length, 1);
  assertEquals(ae.effects[0].key, "regen");
});

// ── Callback list + cancellation integration ─────────────────────

Deno.test("callback list: first pushes effect, second cancels — no effects in world", () => {
  const world = makeWorld();
  const e = world.create();
  world.add(e, Vitality, { maxHp: 20, hp: 20 });

  const ctx = new RuleActionContext(world);
  const cb1 = (ctx) => {
    ctx.pushEffect(e, { key: "poison", turnsLeft: 5, potency: 2 });
  };
  const cb2 = (ctx) => {
    ctx.cancel({ code: "IMMUNE", message: "Poison resistant!" });
  };
  const cb3 = (ctx) => {
    ctx.damage(e, 99, "should not happen");
  };

  const ran = runCallbackList([cb1, cb2, cb3], ctx);

  assert(!ran, "returns false (cancelled)");
  assert(ctx.cancelled);
  ctx.commit();
  assertEquals(world.get(e, Vitality).hp, 20, "no damage");
  assert(!world.get(e, ActiveEffects), "no effects");
});

Deno.test("callback list: no cancel — effects committed", () => {
  const world = makeWorld();
  const e = world.create();
  world.add(e, Vitality, { maxHp: 20, hp: 20 });

  const ctx = new RuleActionContext(world);
  const cb1 = (ctx) => {
    ctx.pushEffect(e, { key: "regen", turnsLeft: 3, potency: 1 });
  };
  const cb2 = (ctx) => {
    ctx.damage(e, 4, "fire");
  };

  runCallbackList([cb1, cb2], ctx);
  ctx.commit();

  assertEquals(world.get(e, Vitality).hp, 16);
  assertEquals(world.get(e, ActiveEffects).effects.length, 1);
});

// ── Reflective entity proxy ──────────────────────────────────────

Deno.test("entity proxy reads component fields lazily", () => {
  const world = makeWorld();
  const e = world.create();
  world.add(e, Vitality, { maxHp: 30, hp: 25 });

  const ctx = new RuleActionContext(world);
  const proxy = ctx._proxy(e);

  assertEquals(proxy.hp, 25);
  assertEquals(proxy.maxHp, 30);
  assertEquals(proxy.id, e);
});

Deno.test("entity proxy throws on write", () => {
  const world = makeWorld();
  const e = world.create();
  world.add(e, Vitality, { maxHp: 10, hp: 10 });

  const ctx = new RuleActionContext(world);
  const proxy = ctx._proxy(e);

  let threw = false;
  try { proxy.hp = 0; } catch { threw = true; }
  assert(threw, "write should throw TypeError");
  assertEquals(world.get(e, Vitality).hp, 10, "hp unchanged");
});

Deno.test("entity proxy returns undefined for missing components", () => {
  const world = makeWorld();
  const e = world.create();

  const ctx = new RuleActionContext(world);
  const proxy = ctx._proxy(e);

  assertEquals(proxy.hp, undefined);
  assertEquals(proxy.identity, undefined);
});
