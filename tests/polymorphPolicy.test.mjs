import "./helpers/installContentCatalog.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { PolymorphProfile } from "../src/rules/components/PolymorphProfile.js";
import { Traits } from "../src/rules/components/Traits.js";
import { getCatalogItem } from "../src/rules/data/itemCatalog.js";
import { getMonster } from "../src/rules/data/monsters.js";
import { getPassiveBonuses } from "../src/rules/utils/passiveBonuses.js";
import {
  getPolymorphControl,
  getPolymorphResistance,
  resolvePolymorphAttempt,
} from "../src/rules/utils/polymorphPolicy.js";

function makeActor(world) {
  const actor = world.create();
  world.add(actor, Equipment);
  return actor;
}

function makeRing(world, bonuses = { polymorphControl: 1 }) {
  const ring = world.create();
  world.add(ring, NamedIdentity, { name: "Ring of Polymorph Control", identity: "ring_polymorph_control" });
  world.add(ring, ItemInfo, {
    type: "equip",
    slot: "ring",
    weight: 0.05,
    value: 0,
    description: "",
    count: 1,
    rarity: 4,
    rarityName: "epic",
    bonuses,
    affixes: [],
  });
  return ring;
}

function makeTarget(world, identity = "rat") {
  const target = world.create();
  world.add(target, NamedIdentity, { name: identity, identity });
  return target;
}

Deno.test("polymorph policy: no trait or equipment means no control", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world);

  const control = getPolymorphControl(world, actor);

  assertEquals(control.hasControl, false);
  assertEquals(control.controlScore, 0);
  assertEquals(control.sources.length, 0);
});

Deno.test("polymorph policy: permanent trait grants control", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world);
  world.add(actor, Traits, { polymorph_control: true });

  const control = getPolymorphControl(world, actor);

  assertEquals(control.hasControl, true);
  assertEquals(control.controlScore, 1);
  assert(control.sources.includes("trait:polymorph_control"));
});

Deno.test("polymorph policy: equipped ring bonus grants control through passive bonuses", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world);
  const ring = makeRing(world);
  world.get(actor, Equipment).ring1 = ring;

  const passive = getPassiveBonuses(world, actor);
  const control = getPolymorphControl(world, actor);

  assertEquals(passive.polymorphControlDerived, 1);
  assertEquals(control.hasControl, true);
  assertEquals(control.controlScore, 1);
  assert(control.sources.includes("ring_polymorph_control"));
});

Deno.test("ring of polymorph control content defines the passive control bonus", () => {
  const ring = getCatalogItem("ring_polymorph_control");

  assert(ring, "ring should be registered in the item catalog");
  assertEquals(ring.name, "Ring of Polymorph Control");
  assertEquals(ring.type, "equip");
  assertEquals(ring.slot, "ring");
  assertEquals(ring.bonuses?.polymorphControl, 1);
});

Deno.test("polymorph resistance reads static monster authoring data", () => {
  const world = new World({ seed: 1 });
  const dragon = makeTarget(world, "dragon");

  const resistance = getPolymorphResistance(world, dragon);

  assertEquals(getMonster("dragon")?.polymorphResistance, 0.65);
  assertEquals(resistance.resistanceScore, 0.65);
  assertEquals(resistance.stabilityScore, 2);
  assertEquals(resistance.failureMode, "resist");
  assert(resistance.sources.includes("monster:dragon"));
});

Deno.test("polymorph profile component overrides monster authoring resistance", () => {
  const world = new World({ seed: 1 });
  const dragon = makeTarget(world, "dragon");
  world.add(dragon, PolymorphProfile, { resistance: 0.2, stability: 3, failureMode: "fumble" });

  const resistance = getPolymorphResistance(world, dragon);

  assertEquals(resistance.resistanceScore, 0.2);
  assertEquals(resistance.stabilityScore, 3);
  assertEquals(resistance.failureMode, "fumble");
  assert(resistance.sources.includes("component:polymorph_profile"));
});

Deno.test("polymorph attempt can fail when target resists", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world);
  const dragon = makeTarget(world, "dragon");
  world.rand = () => 0.1;

  const attempt = resolvePolymorphAttempt(world, {
    actorId: actor,
    targetId: dragon,
    requestedIdentity: "rat",
    source: "test",
    controlled: false,
  });

  assertEquals(attempt.success, false);
  assertEquals(attempt.failureReason, "resisted");
  assertEquals(attempt.resisted, true);
});

Deno.test("controlled polymorph can fumble high-risk requested forms", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world);
  const ring = makeRing(world);
  world.get(actor, Equipment).ring1 = ring;
  const target = makeTarget(world, "rat");
  const rolls = [0.0, 0.0];
  world.rand = () => rolls.shift() ?? 0;

  const attempt = resolvePolymorphAttempt(world, {
    actorId: actor,
    targetId: target,
    requestedIdentity: "dragon",
    source: "test",
    controlled: true,
  });

  assertEquals(attempt.success, true);
  assertEquals(attempt.failureReason, "fumbled");
  assertEquals(attempt.fumbled, true);
  assert(attempt.targetIdentity !== "dragon", "fumbled control should choose a different form");
});
