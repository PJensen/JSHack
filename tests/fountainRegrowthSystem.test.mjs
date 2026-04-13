import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { Interactable } from "../src/rules/components/Interactable.js";
import { Position } from "../src/rules/components/Position.js";
import { fountainRegrowthSystem } from "../src/rules/systems/fountainRegrowthSystem.js";

Deno.test("fountainRegrowthSystem refills dry fountains and emits structured sound payload", () => {
  const world = new World({ seed: 1337 });
  world.step = 250;
  const dungeonId = world.create();
  world.add(dungeonId, DungeonState, { worldSeed: 1337, currentDepth: 7, floorEntityIds: [] });

  const fountainId = world.create();
  world.add(fountainId, Position, { x: 12, y: 7 });
  world.add(fountainId, Interactable, {
    action: "fountain",
    params: {
      chargesRemaining: 0,
      maxCharges: 3,
      cooldownTurns: 233,
      dryUntilStep: 250,
      primaryEffect: "heal",
    },
  });

  const refilled = [];
  const sounds = [];
  world.on("fountain:refilled", (ev) => refilled.push(ev));
  world.on("ambient:sound", (ev) => sounds.push(ev));

  fountainRegrowthSystem(world);

  const inter = world.get(fountainId, Interactable);
  assertEquals(Number(inter?.params?.chargesRemaining || 0), 3);
  assertEquals(Number(inter?.params?.dryUntilStep || -1), -1);
  assertEquals(refilled.length, 1);
  assertEquals(sounds.length, 1);
  assertEquals(sounds[0].source, "fountain");
  assertEquals(sounds[0].depth, 7);
  assertEquals(sounds[0].sourceDbAt1Tile, 80);
  assertEquals(sounds[0].clarity?.far, "you hear faint gurgling");
  assertEquals(sounds[0].clarity?.mid, "you hear running water");
  assertEquals(sounds[0].clarity?.near, "you hear water gushing to life");
  assert(sounds[0].at && sounds[0].at.x === 12 && sounds[0].at.y === 7);
});
