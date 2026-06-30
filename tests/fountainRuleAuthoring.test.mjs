import "./helpers/installContentCatalog.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { fountainDrinkRule } from "../src/content/interactables/fountain/index.js";
import { fountainPurifyRule } from "../src/content/interactables/fountain/index.js";
import { getAuthoredInteractable } from "../src/rules/interaction/interactableRegistry.js";
import { FountainState } from "../src/rules/components/FountainState.js";
import { FountainOutcomeApplied } from "../src/rules/components/FountainOutcomeApplied.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Position } from "../src/rules/components/Position.js";
import { FountainDrinkResolved } from "../src/events/FountainDrinkResolved.js";
import { FountainPurified } from "../src/events/FountainPurified.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { LightEmitter } from "../src/rules/components/LightEmitter.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { addToInventory, inventoryItems } from "../src/rules/utils/inventoryFacade.js";
import { defineVerbRule, executeVerbRule } from "../src/rules/kernel/verbRule.js";

function fixture() {
  const world = new World({ seed: 41 });
  world.step = 7;
  const actor = world.create();
  world.add(actor, Vitality, { maxHp: 40, hp: 20 });
  world.add(actor, Position, { x: 1, y: 1 });
  world.add(actor, Inventory, { capacity: 10 });
  const fountain = world.create();
  world.add(fountain, Position, { x: 2, y: 1 });
  world.add(fountain, FountainState, {
    initialized: true,
    chargesRemaining: 3,
    maxCharges: 3,
    primaryEffect: "heal",
    blessed: false,
    cooldownTurns: 221,
    dryUntilStep: -1,
  });
  world.add(fountain, LightEmitter, {
    radius: 3.5,
    baseColor: "#78aadc",
    temporalPattern: "breathe",
    shadowSoftness: 6,
  });
  return { world, actor, fountain };
}

function addHolyWater(world, actor) {
  const item = world.create();
  world.add(item, NamedIdentity, { identity: "potion_holy_water", name: "Vial of Holy Water" });
  world.add(item, ItemInfo, { type: "potion", count: 1 });
  addToInventory(world, actor, item);
  return item;
}

Deno.test("fountain rule can force a named outcome and records an inspectable trace", () => {
  const { world, actor, fountain } = fixture();
  const result = executeVerbRule(world, fountainDrinkRule, {
    actor,
    primary: fountain,
    target: fountain,
    params: { forceOutcomeId: "nothing" },
  });

  assertEquals(result.ok, true);
  assertEquals(result.payload.outcomeId, "nothing");
  assert(result.breadcrumbs.some((entry) =>
    entry.step === "selected"
    && entry.data.candidateId === "nothing"
    && entry.data.forced === true
  ));
});

Deno.test("fountain mutations and facts commit before typed notification", () => {
  const { world, actor, fountain } = fixture();
  let observed = null;
  world.on(FountainDrinkResolved, () => {
    observed = {
      charges: world.get(fountain, FountainState).chargesRemaining,
      facts: [...world.query(FountainOutcomeApplied)].length,
    };
  });

  executeVerbRule(world, fountainDrinkRule, {
    actor,
    primary: fountain,
    target: fountain,
    params: { forceOutcomeId: "nothing" },
  });

  assertEquals(observed, { charges: 2, facts: 1 });
  const [, fact] = [...world.query(FountainOutcomeApplied)][0];
  assertEquals(fact.ruleId, "fountain.drink");
  assertEquals(fact.outcome, "nothing");
});

Deno.test("failed rule application discards queued mutations and facts", () => {
  const { world, actor, fountain } = fixture();
  const broken = defineVerbRule({
    id: "test.broken",
    verb: "drink",
    apply(ctx) {
      ctx.mutate.patchComponent(ctx.target, FountainState, { chargesRemaining: 0 });
      ctx.mutate.record(FountainOutcomeApplied, { actor, fountain, outcome: "broken" });
      throw new Error("deliberate failure");
    },
  });

  const result = executeVerbRule(world, broken, {
    actor,
    primary: fountain,
    target: fountain,
  });

  assertEquals(result.canceled, true);
  assertEquals(world.get(fountain, FountainState).chargesRemaining, 3);
  assertEquals([...world.query(FountainOutcomeApplied)].length, 0);
});

Deno.test("fountain actions expose purify only while carrying holy water", () => {
  const { world, actor, fountain } = fixture();
  const def = getAuthoredInteractable("fountain");
  assert(def, "fountain should be authored");

  assertEquals(
    def.actions(world, fountain, { actor }).map((entry) => entry.mode),
    ["drink", "dip"],
  );

  addHolyWater(world, actor);
  assertEquals(
    def.actions(world, fountain, { actor }).map((entry) => entry.mode),
    ["drink", "dip", "purify"],
  );

  world.set(fountain, FountainState, { ...world.get(fountain, FountainState), blessed: true });
  assertEquals(
    def.actions(world, fountain, { actor }).map((entry) => entry.mode),
    ["drink", "dip"],
  );
});

Deno.test("fountain purify consumes holy water and consecrates the fountain light", () => {
  const { world, actor, fountain } = fixture();
  const holyWater = addHolyWater(world, actor);
  const purified = [];
  world.on(FountainPurified, (event) => purified.push(event));

  const result = executeVerbRule(world, fountainPurifyRule, {
    actor,
    primary: fountain,
    target: fountain,
  });

  assertEquals(result.ok, true);
  assertEquals(result.payload.outcomeId, "purify");
  assertEquals(world.get(fountain, FountainState).blessed, true);
  assertEquals(inventoryItems(world, actor).includes(holyWater), false);
  const light = world.get(fountain, LightEmitter);
  assertEquals(light.temporalPattern, "holy");
  assertEquals(light.baseColor, "#fff0aa");
  assertEquals(purified.length, 1);
  assertEquals(purified[0].itemId, holyWater);
});

Deno.test("blessed fountain drinks grant blessing without spending charges", () => {
  const { world, actor, fountain } = fixture();
  const state = world.get(fountain, FountainState);
  world.set(fountain, FountainState, { ...state, blessed: true });
  const drinks = [];
  world.on(FountainDrinkResolved, (event) => drinks.push(event));

  const result = executeVerbRule(world, fountainDrinkRule, {
    actor,
    primary: fountain,
    target: fountain,
  });

  assertEquals(result.ok, true);
  assertEquals(result.payload.outcomeId, "blessing");
  assertEquals(world.get(fountain, FountainState).chargesRemaining, 3);
  assertEquals(drinks[0].effect, "blessing");
  const effects = world.get(actor, ActiveEffects)?.effects || [];
  assert(effects.some((effect) => effect.key === "blessed" && effect.turnsLeft === 80));
});
