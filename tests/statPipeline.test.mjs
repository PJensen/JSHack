import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Status } from "../src/rules/components/Status.js";
import { resolveCombatSnapshot } from "../src/rules/utils/resolveCombatSnapshot.js";

/**
 * @param {World} world
 * @param {{attackDerived?:number, defenseDerived?:number, statuses?:Array<any>}} [opts]
 */
function makeActor(world, opts = {}) {
  const id = world.create();
  world.add(id, Equipment, {
    attackDerived: Number(opts.attackDerived || 0),
    defenseDerived: Number(opts.defenseDerived || 0),
  });
  if (Array.isArray(opts.statuses)) {
    world.add(id, Status, { statuses: opts.statuses });
  }
  return id;
}

Deno.test("resolveCombatSnapshot(melee): preserves status parity with stoneskin", () => {
  const world = new World({ seed: 7 });

  const attacker = makeActor(world, {
    attackDerived: 4,
    statuses: [
      { type: "disease", duration: 5, potency: 1, stacks: 2 },
      { type: "hungry", duration: 5, potency: 3, stacks: 1 },
      { type: "weakened", duration: 5, potency: 2, stacks: 1 },
      { type: "cursed", duration: 5, potency: 1, stacks: 1 },
      { type: "blessed", duration: 5, potency: 2, stacks: 1 },
    ],
  });
  const defender = makeActor(world, {
    defenseDerived: 1,
    statuses: [
      { type: "disease", duration: 5, potency: 1, stacks: 1 },
      { type: "famished", duration: 5, potency: 2, stacks: 1 },
      { type: "weakened", duration: 5, potency: 1, stacks: 1 },
      { type: "cursed", duration: 5, potency: 1, stacks: 1 },
      { type: "blessed", duration: 5, potency: 3, stacks: 1 },
      { type: "stoneskin", duration: 5, potency: 2, stacks: 1 },
    ],
  });

  const atk = resolveCombatSnapshot(world, attacker, { mode: "melee" });
  const def = resolveCombatSnapshot(world, defender, { mode: "melee" });

  assertEquals(atk.attackBonus, 0, "melee attack bonus should clamp to zero");
  assertEquals(atk.damageFlatBonus, 2, "flat damage should still derive from equipment attack");
  assert(atk.modifiers.some((m) => m.source === "rule:attackFloor"), "attack floor breadcrumb expected");

  assertEquals(def.armorClass, 11, "melee armor class should include stoneskin and status penalties");
  assert(def.modifiers.some((m) => m.source === "status:stoneskin" && m.value === 2), "stoneskin modifier expected");
});

Deno.test("resolveCombatSnapshot(ranged): ignores non-stoneskin status modifiers", () => {
  const world = new World({ seed: 9 });

  const attacker = makeActor(world, {
    attackDerived: 4,
    statuses: [
      { type: "disease", duration: 5, potency: 4, stacks: 1 },
      { type: "starving", duration: 5, potency: 4, stacks: 1 },
      { type: "weakened", duration: 5, potency: 4, stacks: 1 },
      { type: "cursed", duration: 5, potency: 4, stacks: 1 },
      { type: "blessed", duration: 5, potency: 4, stacks: 1 },
    ],
  });
  const defender = makeActor(world, {
    defenseDerived: 2,
    statuses: [
      { type: "disease", duration: 5, potency: 4, stacks: 1 },
      { type: "wasting", duration: 5, potency: 4, stacks: 1 },
      { type: "weakened", duration: 5, potency: 4, stacks: 1 },
      { type: "cursed", duration: 5, potency: 4, stacks: 1 },
      { type: "blessed", duration: 5, potency: 4, stacks: 1 },
      { type: "stoneskin", duration: 5, potency: 3, stacks: 1 },
    ],
  });

  const atk = resolveCombatSnapshot(world, attacker, { mode: "ranged" });
  const def = resolveCombatSnapshot(world, defender, { mode: "ranged" });

  assertEquals(atk.attackBonus, 5, "ranged to-hit should stay 1 + attackDerived");
  assertEquals(def.armorClass, 15, "ranged AC should include defense + stoneskin only");
  assert(!atk.modifiers.some((m) => m.source.startsWith("status:") && m.stat === "attack"), "ranged attack should ignore status penalties/bonuses");
  assert(def.modifiers.some((m) => m.source === "status:stoneskin"), "ranged defense still consumes stoneskin");
});

Deno.test("resolveCombatSnapshot: modifier ordering is deterministic", () => {
  const world = new World({ seed: 11 });
  const actor = makeActor(world, {
    attackDerived: 2,
    defenseDerived: 1,
    statuses: [
      { type: "blessed", duration: 5, potency: 1, stacks: 1 },
      { type: "stoneskin", duration: 5, potency: 2, stacks: 1 },
    ],
  });

  const snapA = resolveCombatSnapshot(world, actor, { mode: "melee" });
  const snapB = resolveCombatSnapshot(world, actor, { mode: "melee" });

  assertEquals(snapA.modifiers, snapB.modifiers);
  assertEquals(
    snapA.modifiers.map((m) => `${m.stat}:${m.source}:${m.value}`),
    [
      "attack:base:1",
      "attack:equipment:attackDerived:2",
      "attack:status:blessed:1",
      "defense:base:10",
      "defense:equipment:defenseDerived:1",
      "defense:status:blessed:1",
      "defense:status:stoneskin:2",
    ],
  );
});
