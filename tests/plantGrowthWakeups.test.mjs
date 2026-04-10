import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { GrowthStage } from "../src/rules/components/GrowthStage.js";
import { HarvestNode } from "../src/rules/components/HarvestNode.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { plantGrowthSystem } from "../src/rules/systems/plantGrowthSystem.js";

function addDepth(world, depth) {
  const id = world.create();
  world.add(id, DungeonState, { currentDepth: depth, floorEntityIds: [] });
}

Deno.test("plantGrowthSystem standalone plants advance on scheduled due turns", () => {
  const world = new World({ seed: 77 });
  world.setScheduler(() => {});
  addDepth(world, 0);
  const id = world.create();
  world.add(id, GrowthStage, {
    currentStage: 0,
    maxStage: 2,
    stageIdentities: ["seedling", "sprout", "mature"],
    growInterval: 3,
    growCountdown: 3,
  });
  world.add(id, NamedIdentity, { name: "Seedling", identity: "seedling" });

  for (let i = 0; i < 2; i++) {
    plantGrowthSystem(world);
    world.tick(1);
  }
  assertEquals(world.get(id, GrowthStage)?.currentStage, 0);

  world.tick(1);
  plantGrowthSystem(world);
  assertEquals(world.get(id, GrowthStage)?.currentStage, 1);
  assertEquals(world.get(id, NamedIdentity)?.identity, "sprout");

  world.tick(1);
  world.tick(1);
  world.tick(1);
  world.tick(1);
  plantGrowthSystem(world);
  assertEquals(world.get(id, GrowthStage)?.currentStage, 2);
  assertEquals(world.get(id, NamedIdentity)?.identity, "mature");
});

Deno.test("plantGrowthSystem crop mode still derives stage from HarvestNode countdown", () => {
  const world = new World({ seed: 78 });
  world.setScheduler(() => {});
  addDepth(world, 0);
  const id = world.create();
  world.add(id, HarvestNode, {
    kind: "wheat",
    ready: false,
    regrowTurns: 100,
    regrowCountdown: 50,
    replantable: true,
    needsPlanting: false,
  });
  world.add(id, GrowthStage, {
    currentStage: 0,
    maxStage: 2,
    stageIdentities: ["wheat_seedling", "wheat_growing", "wheat_ready"],
    growInterval: 0,
    growCountdown: 0,
  });
  world.add(id, NamedIdentity, { name: "Wheat", identity: "wheat_seedling" });

  plantGrowthSystem(world);
  assertEquals(world.get(id, GrowthStage)?.currentStage, 1);
  assertEquals(world.get(id, NamedIdentity)?.identity, "wheat_growing");
});
