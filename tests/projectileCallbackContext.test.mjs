import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Resistances } from "../src/rules/components/Resistences.js";
import { Status } from "../src/rules/components/Status.js";
import { resolveResistance } from "../src/rules/utils/dealDamage.js";
import { ProjectileImpactCallbackContext } from "../src/rules/data/callbacks/projectile.js";

Deno.test("ProjectileImpactCallbackContext exposes stats facade and deferred resolution hooks", () => {
  const world = new World({ seed: 9001 });

  const attacker = world.create();
  world.add(attacker, Equipment, { accuracyDerived: 4, damagePowerDerived: 4, evadeDerived: 0 });

  const defender = world.create();
  world.add(defender, Equipment, { accuracyDerived: 0, damagePowerDerived: 0, evadeDerived: 2 });
  world.add(defender, Resistances, { kinetic: { DR: 3, bluntMult: 1.0, slashMult: 1.0, pierceMult: 1.0 } });
  world.add(defender, Status, {
    statuses: [{ type: "stoneskin", duration: 4, potency: 2, stacks: 1 }],
  });

  const ctx = new ProjectileImpactCallbackContext(world, {
    phase: "projectile-actor-impact",
    attacker,
    defender,
    ammoId: 77,
    damage: 7,
    rng: () => 0.5,
  });

  const atk = ctx.stats.attacker("ranged");
  const def = ctx.stats.defender("ranged");
  assert(atk, "attacker snapshot should be available");
  assert(def, "defender snapshot should be available");
  assertEquals(atk.attackBonus, 5);
  assertEquals(def.armorClass, 14);
  assertEquals(ctx.stats.resolveDamage(defender, 10, "physical"), resolveResistance(world, defender, 10, "physical"));
  assertEquals(ctx.stats.defenderMitigation(10, "physical").prevented, 3);
  assertEquals(ctx.status.hasStatus(defender, "stoneskin"), true);
  assertEquals(ctx.status.defenderHasStatus("stoneskin"), true);

  let deferredRan = false;
  ctx.deferResolved((resolvedCtx) => {
    if (resolvedCtx.applied && !resolvedCtx.killed) deferredRan = true;
  });
  ctx.resolveDamageResult({ applied: true, killed: false, amount: 6, reason: "applied" });
  ctx.flushResolved();
  assert(deferredRan, "deferred projectile callback should run after damage result is attached");
});
