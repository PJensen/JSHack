import { assert } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { AttackIntent } from "../src/rules/components/Intents/AttackIntent.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Position } from "../src/rules/components/Position.js";
import { Status } from "../src/rules/components/Status.js";
import { combatSystem } from "../src/rules/systems/combatSystem.js";

function runSingleMelee({
  seed,
  attackDerived,
  defenseDerived,
  attackerStatuses = null,
  defenderStatuses = null,
}) {
  const world = new World({ seed });

  const attacker = world.create();
  world.add(attacker, Vitality, { maxHp: 20, hp: 20 });
  world.add(attacker, Equipment, {
    attackDerived,
    defenseDerived: 0,
    naturalDamageDice: "1d8",
  });
  world.add(attacker, Position, { x: 5, y: 5 });
  if (attackerStatuses) world.add(attacker, Status, { statuses: attackerStatuses });

  const defender = world.create();
  world.add(defender, Vitality, { maxHp: 20, hp: 20 });
  world.add(defender, Equipment, {
    attackDerived: 0,
    defenseDerived,
  });
  world.add(defender, Position, { x: 5, y: 6 });
  if (defenderStatuses) world.add(defender, Status, { statuses: defenderStatuses });

  world.add(attacker, AttackIntent, { targetId: defender });
  combatSystem(world);

  return {
    defenderHp: world.get(defender, Vitality).hp,
  };
}

Deno.test("combatSystem: weakened attacker loses melee accuracy", () => {
  const baseline = runSingleMelee({
    seed: 5,
    attackDerived: 4,
    defenseDerived: 0,
  });
  const weakened = runSingleMelee({
    seed: 5,
    attackDerived: 4,
    defenseDerived: 0,
    attackerStatuses: [{ type: "weakened", duration: 5, potency: 2, stacks: 1 }],
  });

  assert(baseline.defenderHp < 20, "baseline hit should land");
  assert(weakened.defenderHp === 20, "weakened penalty should turn this hit into a miss");
});

Deno.test("combatSystem: cursed defender is easier to hit", () => {
  const baseline = runSingleMelee({
    seed: 9,
    attackDerived: 1,
    defenseDerived: 1,
  });
  const cursedDefender = runSingleMelee({
    seed: 9,
    attackDerived: 1,
    defenseDerived: 1,
    defenderStatuses: [{ type: "cursed", duration: 5, potency: 1, stacks: 1 }],
  });

  assert(baseline.defenderHp === 20, "baseline should miss");
  assert(cursedDefender.defenderHp < 20, "cursed penalty should lower defense enough to hit");
});

Deno.test("combatSystem: blessed attacker gains melee accuracy", () => {
  const baseline = runSingleMelee({
    seed: 9,
    attackDerived: 1,
    defenseDerived: 1,
  });
  const blessedAttacker = runSingleMelee({
    seed: 9,
    attackDerived: 1,
    defenseDerived: 1,
    attackerStatuses: [{ type: "blessed", duration: 5, potency: 1, stacks: 1 }],
  });

  assert(baseline.defenderHp === 20, "baseline should miss");
  assert(blessedAttacker.defenderHp < 20, "blessed bonus should turn this miss into a hit");
});
