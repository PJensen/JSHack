import { assert } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Hunger } from "../src/rules/components/Hunger.js";
import { Status } from "../src/rules/components/Status.js";
import { hungerSystem } from "../src/rules/systems/hungerSystem.js";

Deno.test("hungerSystem creates Status when hunger penalty applies", () => {
  const world = new World({ seed: 1 });
  const id = world.create();
  world.add(id, Hunger, { hunger: 400, satiation: 0 }); // -> hungry

  hungerSystem(world);

  const st = world.get(id, Status);
  assert(st && Array.isArray(st.statuses), "Status should exist after hunger tick");
  const hungry = st.statuses.find((s) => s.type === "hungry");
  assert(hungry, "hungry status should be present");
  assert((hungry.potency || 0) === 1, `expected hungry potency 1, got ${hungry?.potency}`);
});

Deno.test("hungerSystem preserves non-hunger statuses while replacing hunger status", () => {
  const world = new World({ seed: 1 });
  const id = world.create();
  world.add(id, Hunger, { hunger: 650, satiation: 0 }); // famished
  world.add(id, Status, {
    statuses: [
      { type: "poisoned", duration: 3, potency: 1, stacks: 1 },
      { type: "hungry", duration: 9999, potency: 1, stacks: 1 },
    ],
  });

  hungerSystem(world);

  const st = world.get(id, Status);
  assert(st && Array.isArray(st.statuses), "Status should still exist");
  assert(st.statuses.some((s) => s.type === "poisoned"), "non-hunger status should be preserved");
  assert(st.statuses.some((s) => s.type === "famished"), "hunger status should update to current level");
  assert(!st.statuses.some((s) => s.type === "hungry"), "previous hunger status should be removed");
});
