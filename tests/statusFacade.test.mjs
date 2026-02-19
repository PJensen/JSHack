import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { Status } from "../src/rules/components/Status.js";
import {
  createStatusFacade,
  effectStrength,
  hasAnyStatus,
  hasEffect,
  hasStatus,
  snapshotStatusState,
  statusStrength,
} from "../src/rules/utils/statusFacade.js";

Deno.test("status facade: derives semantic statuses from active effects", () => {
  const world = new World({ seed: 6101 });
  const actor = world.create();
  world.add(actor, ActiveEffects, {
    effects: [{ key: "hangover", turnsLeft: 4, potency: 2, stacks: 1 }],
  });

  assertEquals(hasEffect(world, actor, "hangover"), true);
  assertEquals(effectStrength(world, actor, "hangover"), 2);
  assertEquals(hasStatus(world, actor, "confused"), true);
  assertEquals(statusStrength(world, actor, "confused"), 2);
  assertEquals(hasAnyStatus(world, actor, ["burning", "confused"]), true);

  const snap = snapshotStatusState(world, actor);
  assert(snap, "snapshot should exist");
  assertEquals(snap.statuses.some((s) => s.type === "confused"), true);
});

Deno.test("status facade: status snapshot remains active-effect-derived while compatibility can read Status fallback", () => {
  const world = new World({ seed: 6102 });
  const actor = world.create();
  world.add(actor, Status, {
    statuses: [{ type: "hallucinating", duration: 3, potency: 1, stacks: 1 }],
  });

  assertEquals(hasStatus(world, actor, "hallucinating"), true);
  const snap = snapshotStatusState(world, actor);
  assert(snap, "snapshot should exist");
  assertEquals(snap.statuses.length, 0, "derived status list should come from ActiveEffects only");
  assertEquals(snap.allStatuses.some((s) => s.type === "hallucinating"), true);
});

Deno.test("status facade: active effects take precedence over mirrored Status entries", () => {
  const world = new World({ seed: 6103 });
  const actor = world.create();
  world.add(actor, ActiveEffects, {
    effects: [{ key: "poison", turnsLeft: 5, potency: 2, stacks: 1 }],
  });
  world.add(actor, Status, {
    statuses: [{ type: "poisoned", duration: 5, potency: 9, stacks: 1 }],
  });

  assertEquals(statusStrength(world, actor, "poisoned"), 2);
});

Deno.test("status facade: onset effects do not project statuses until active", () => {
  const world = new World({ seed: 6104 });
  const actor = world.create();
  world.add(actor, ActiveEffects, {
    effects: [{ key: "hangover", turnsLeft: 6, onsetLeft: 2, potency: 2, stacks: 1 }],
  });

  assertEquals(hasEffect(world, actor, "hangover"), false);
  assertEquals(hasStatus(world, actor, "confused"), false);
});

Deno.test("createStatusFacade: exposes anchored helpers for callbacks/runtime contexts", () => {
  const world = new World({ seed: 6105 });
  const actor = world.create();
  const target = world.create();

  world.add(actor, ActiveEffects, {
    effects: [{ key: "hangover", turnsLeft: 3, potency: 1, stacks: 1 }],
  });
  world.add(target, Status, {
    statuses: [{ type: "cursed", duration: 2, potency: 1, stacks: 1 }],
  });

  const facade = createStatusFacade(world, {
    actor: () => actor,
    target: () => target,
  });

  assertEquals(facade.actorHasStatus("confused"), true);
  assertEquals(facade.targetHasStatus("cursed"), true);
  assertEquals(facade.hasAnyStatus(target, ["blessed", "cursed"]), true);
  assertEquals(facade.effectStrength(actor, "hangover"), 1);
});
