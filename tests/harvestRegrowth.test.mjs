import { assert } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { HarvestNode } from "../src/rules/components/HarvestNode.js";
import { harvestRegrowthSystem } from "../src/rules/systems/harvestRegrowthSystem.js";

Deno.test("harvestRegrowthSystem decrements regrowCountdown", () => {
  const world = new World({ seed: 1 });
  const id = world.create();
  world.add(id, HarvestNode, { kind: "berries", ready: false, regrowTurns: 5, regrowCountdown: 3 });

  harvestRegrowthSystem(world);
  const h = world.get(id, HarvestNode);
  assert(h.ready === false, "node should still be unready");
  assert(h.regrowCountdown === 2, `expected 2 turns left, got ${h.regrowCountdown}`);
});

Deno.test("harvestRegrowthSystem flips ready and emits regrown event", () => {
  const world = new World({ seed: 2 });
  const id = world.create();
  world.add(id, HarvestNode, { kind: "herbs", ready: false, regrowTurns: 4, regrowCountdown: 1 });

  const events = [];
  world.on("harvest:regrown", (e) => events.push(e));

  harvestRegrowthSystem(world);
  const h = world.get(id, HarvestNode);
  assert(h.ready === true, "node should become ready");
  assert(h.regrowCountdown === 0, "regrowCountdown should reset to 0");
  assert(events.length === 1, "regrown event should be emitted");
  assert(events[0].id === id, "regrown event should include node id");
});
