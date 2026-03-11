import { assertEquals, assertStrictEquals } from "jsr:@std/assert";
import { World, attach } from "../src/lib/ecs-js/index.js";
import { BaseStats } from "../src/rules/components/BaseStats.js";
import { DerivedExpression } from "../src/rules/components/DerivedExpression.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import {
  defineDerivedStatVirtuals,
  explainDerivedStats,
  getDamageProfileVirtual,
  getResolvedStatsVirtual,
  resolveDerivedStats,
} from "../src/rules/utils/derivedStats.js";
import { installVirtuals } from "../src/rules/utils/inventoryVirtuals.js";

function makeEntity(world, Comp, value = {}) {
  const id = world.create();
  world.add(id, Comp, value);
  return id;
}

Deno.test("resolveDerivedStats walks equipped hierarchy and applies stage ordering", () => {
  const world = new World({ seed: 0xC0FFEE });
  const actor = world.create();
  const weapon = world.create();
  const ruby = world.create();
  const sapphire = world.create();
  const emerald = world.create();
  const battleFocus = world.create();

  world.add(actor, BaseStats, {
    strength: 8,
    intelligence: 6,
    dexterity: 10,
    vitality: 7,
    staminaRegen: 2,
    critChance: 0.05,
    critMultiplier: 1.75,
    baseDamageMin: 4,
    baseDamageMax: 8,
  });
  world.add(actor, Equipment, { weapon });

  attach(world, ruby, weapon);
  attach(world, sapphire, weapon);
  attach(world, emerald, weapon);
  attach(world, battleFocus, actor);

  attach(world, makeEntity(world, DerivedExpression, {
    target: "baseDamageMin",
    kind: "addConst",
    value: 2,
    stage: "base",
    priority: 10,
  }), ruby);

  attach(world, makeEntity(world, DerivedExpression, {
    target: "intelligence",
    kind: "addConst",
    value: 4,
    stage: "base",
    priority: 10,
  }), sapphire);

  attach(world, makeEntity(world, DerivedExpression, {
    target: "critChance",
    kind: "addStatScale",
    source: "dexterity",
    factor: 0.005,
    stage: "derived",
    priority: 20,
  }), emerald);

  attach(world, makeEntity(world, DerivedExpression, {
    target: "critChance",
    kind: "minConst",
    value: 0.12,
    stage: "final",
    priority: 30,
  }), battleFocus);

  const stats = resolveDerivedStats(world, actor);
  assertEquals(stats.intelligence, 10);
  assertEquals(stats.baseDamageMin, 6);
  assertEquals(stats.baseDamageMax, 8);
  assertEquals(stats.critChance, 0.12);
  assertEquals(stats.critMultiplier, 1.75);

  const explained = explainDerivedStats(world, actor);
  assertEquals(
    explained.trace.map((entry) => `${entry.stage}:${entry.target}:${entry.kind}`),
    [
      "base:baseDamageMin:addConst",
      "base:intelligence:addConst",
      "derived:critChance:addStatScale",
      "final:critChance:minConst",
    ],
  );
});

Deno.test("derived stat virtuals project cached stat and damage views", () => {
  const world = new World({ seed: 0xA77A77 });
  installVirtuals(world);
  defineDerivedStatVirtuals(world);

  const actor = world.create();
  world.add(actor, BaseStats, {
    critChance: 0.2,
    critMultiplier: 2,
    baseDamageMin: 3,
    baseDamageMax: 7,
  });

  const ResolvedStats = getResolvedStatsVirtual(world);
  const DamageProfile = getDamageProfileVirtual(world);

  const statsA = world.vget(actor, ResolvedStats);
  const statsB = world.vget(actor, ResolvedStats);
  assertStrictEquals(statsA, statsB);

  const damage = world.vget(actor, DamageProfile);
  assertEquals(damage, {
    min: 3,
    max: 7,
    critChance: 0.2,
    critMultiplier: 2,
  });
});
