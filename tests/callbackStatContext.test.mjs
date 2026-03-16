import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { CombatCallbackContext } from "../src/rules/data/callbacks/combat.js";
import { executeInteraction } from "../src/rules/interaction/runtime/actionRuntime.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Resistances } from "../src/rules/components/Resistences.js";
import { Status } from "../src/rules/components/Status.js";
import { resolveResistance } from "../src/rules/utils/dealDamage.js";

Deno.test("CombatCallbackContext exposes deterministic stats facade", () => {
  const world = new World({ seed: 8801 });

  const attacker = world.create();
  world.add(attacker, Equipment, { accuracyDerived: 4, damagePowerDerived: 4, evadeDerived: 0 });

  const defender = world.create();
  world.add(defender, Equipment, { accuracyDerived: 0, damagePowerDerived: 0, evadeDerived: 2 });
  world.add(defender, Resistances, { kinetic: { DR: 3, bluntMult: 1.0, slashMult: 1.0, pierceMult: 1.0 } });
  world.add(defender, Status, {
    statuses: [{ type: "stoneskin", duration: 4, potency: 2, stacks: 1 }],
  });

  const ctx = new CombatCallbackContext(world, { attacker, defender, damage: 7 });

  const atk = ctx.stats.attacker("melee");
  const def = ctx.stats.defender("melee");

  assert(atk, "attacker snapshot should be available");
  assert(def, "defender snapshot should be available");
  assertEquals(atk.attackBonus, 5);
  assertEquals(def.armorClass, 14);
  assertEquals(ctx.stats.attackBonus(attacker, "melee"), 5);
  assertEquals(ctx.stats.armorClass(defender, "melee"), 14);
  assertEquals(ctx.stats.resolveDamage(defender, 10, "physical"), resolveResistance(world, defender, 10, "physical"));
  assertEquals(ctx.stats.mitigation(defender, 10, "physical").finalAmount, 7);
  assertEquals(ctx.stats.defenderMitigation(10, "physical").prevented, 3);
  assertEquals(ctx.status.defenderHasStatus("stoneskin"), true);
  assertEquals(ctx.status.hasStatus(defender, "stoneskin"), true);
});

Deno.test("interaction runtime callback context exposes stats/query/helpers stat views", () => {
  const world = new World({ seed: 8802 });

  const actor = world.create();
  world.add(actor, Equipment, { accuracyDerived: 2, damagePowerDerived: 2, evadeDerived: 3 });
  world.add(actor, ActiveEffects, {
    effects: [{ key: "hangover", turnsLeft: 4, potency: 1, stacks: 1 }],
  });

  const primary = world.create();

  const target = world.create();
  world.add(target, Equipment, { accuracyDerived: 0, damagePowerDerived: 0, evadeDerived: 1 });
  world.add(target, Resistances, {
    thermal: { burnMult: 0.6 },
    kinetic: { DR: 0, bluntMult: 1.0, slashMult: 1.0, pierceMult: 1.0 },
    chemical: { acidMult: 1.0, baseMult: 1.0, solventMult: 1.0, toxMult: 1.0 },
    electric: { ohms: Infinity, fibrillationA: 0.03 },
    radiation: { alpha: 1.0, beta: 1.0, gamma: 1.0, neutron: 1.0 },
  });
  world.add(target, Status, {
    statuses: [{ type: "stoneskin", duration: 5, potency: 2, stacks: 1 }],
  });

  const result = executeInteraction(world, {
    verb: "test:stats",
    actor,
    primary,
    target,
    pipeline: (ctx) => {
      const actorSnapshot = ctx.stats.actor("melee");
      const targetSnapshot = ctx.stats.target("ranged");
      const helperSnapshot = ctx.helpers.combatSnapshot(actor, "melee");
      const querySnapshot = ctx.query.combatSnapshot(target, "ranged");

      return {
        payload: {
          actorAttackBonus: actorSnapshot?.attackBonus,
          targetArmorClass: targetSnapshot?.armorClass,
          helperAttackBonus: helperSnapshot?.attackBonus,
          helperArmorClass: ctx.helpers.armorClass(target, "ranged"),
          queryArmorClass: querySnapshot?.armorClass,
          helperCombatStat: ctx.helpers.combatStat(target, "armorClass", "ranged"),
          queryCombatStat: ctx.query.combatStat(target, "armorClass", "ranged"),
          statsResolveDamage: ctx.stats.resolveDamage(target, 10, "fire"),
          helperResolveDamage: ctx.helpers.resolveDamage(target, 10, "fire"),
          queryResolveDamage: ctx.query.resolveDamage(target, 10, "fire"),
          statsMitigation: ctx.stats.mitigation(target, 10, "fire"),
          helperMitigation: ctx.helpers.mitigation(target, 10, "fire"),
          queryMitigation: ctx.query.mitigation(target, 10, "fire"),
          statusActorConfused: ctx.status.actorHasStatus("confused"),
          queryActorConfused: ctx.query.hasStatus(actor, "confused"),
          helperActorConfused: ctx.helpers.hasStatus(actor, "confused"),
          helperActorHangover: ctx.helpers.hasEffect(actor, "hangover"),
          statusTargetStoneskin: ctx.status.hasStatus(target, "stoneskin"),
          actorDerivedStatuses: (ctx.status.actor()?.statuses || []).map((s) => s.type),
        },
      };
    },
  });

  assertEquals(result.ok, true);
  assertEquals(result.canceled, false);
  assertEquals(result.payload.actorAttackBonus, 3);
  assertEquals(result.payload.targetArmorClass, 13);
  assertEquals(result.payload.helperAttackBonus, 3);
  assertEquals(result.payload.helperArmorClass, 13);
  assertEquals(result.payload.queryArmorClass, 13);
  assertEquals(result.payload.helperCombatStat, 13);
  assertEquals(result.payload.queryCombatStat, 13);
  assertEquals(result.payload.statsResolveDamage, 6);
  assertEquals(result.payload.helperResolveDamage, 6);
  assertEquals(result.payload.queryResolveDamage, 6);
  assertEquals(result.payload.statsMitigation.finalAmount, 6);
  assertEquals(result.payload.helperMitigation.prevented, 4);
  assertEquals(result.payload.queryMitigation.ratio, 0.4);
  assertEquals(result.payload.statusActorConfused, true);
  assertEquals(result.payload.queryActorConfused, true);
  assertEquals(result.payload.helperActorConfused, true);
  assertEquals(result.payload.helperActorHangover, true);
  assertEquals(result.payload.statusTargetStoneskin, true);
  assert(result.payload.actorDerivedStatuses.includes("confused"), "active-effect-derived statuses should include confused");
});
