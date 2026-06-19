import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createFrom } from "../src/lib/ecs-js/archetype.js";
import { Other } from "../src/rules/archetypes/Creatures.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { MoveIntent } from "../src/rules/components/Intents/MoveIntent.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { aiFarmAnimalSystem } from "../src/rules/systems/aiFarmAnimalSystem.js";
import { isAsleep } from "../src/rules/utils/sleep.js";

Deno.test("farm chickens sleep at night and wake in the morning", () => {
  const world = new World({ seed: 0xC11C });
  world.rand = () => 0.5;

  const dungeon = world.create();
  world.add(dungeon, DungeonState, { currentDepth: 0 });
  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 0, y: 0 });

  const chickens = ["chicken_hen", "chicken_rooster", "chick"].map((identity, index) =>
    createFrom(world, Other, {
      x: index === 2 ? 20 : index + 1,
      y: 0,
      identity,
      faction: "neutral",
      creatureType: "beast",
      speed: 1,
    })
  );
  const vocalizations = [];
  world.on("creature:vocalize", (event) => vocalizations.push(event));

  world.step = 630; // 9 PM
  aiFarmAnimalSystem(world);

  for (const chicken of chickens) {
    assert(isAsleep(world, chicken));
    assertEquals(world.has(chicken, MoveIntent), false);
  }
  assertEquals(vocalizations.length, 0);

  world.step = 180; // 6 AM
  aiFarmAnimalSystem(world);

  for (const chicken of chickens) assert(!isAsleep(world, chicken));
});
