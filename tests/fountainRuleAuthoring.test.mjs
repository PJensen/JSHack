import "./helpers/installContentCatalog.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { fountainDrinkRule } from "../src/content/interactables/fountain/index.js";
import { FountainState } from "../src/rules/components/FountainState.js";
import { FountainOutcomeApplied } from "../src/rules/components/FountainOutcomeApplied.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Position } from "../src/rules/components/Position.js";
import { FountainDrinkResolved } from "../src/events/FountainDrinkResolved.js";
import { defineVerbRule, executeVerbRule } from "../src/rules/kernel/verbRule.js";

function fixture() {
  const world = new World({ seed: 41 });
  world.step = 7;
  const actor = world.create();
  world.add(actor, Vitality, { maxHp: 40, hp: 20 });
  world.add(actor, Position, { x: 1, y: 1 });
  const fountain = world.create();
  world.add(fountain, Position, { x: 2, y: 1 });
  world.add(fountain, FountainState, {
    initialized: true,
    chargesRemaining: 3,
    maxCharges: 3,
    primaryEffect: "heal",
    cooldownTurns: 221,
    dryUntilStep: -1,
  });
  return { world, actor, fountain };
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
