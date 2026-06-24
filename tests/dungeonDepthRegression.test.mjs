import "./helpers/installContentCatalog.mjs";
import "./helpers/installContentMonsters.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { generateFloor } from "../src/rules/environment/dungeon/index.js";
import { clearAll } from "../src/rules/environment/dungeon/tileMap.js";
import { transitionToDepth, clearFloorCache } from "../src/rules/environment/dungeon/transition.js";
import { UNDERWORLD_REGION_TEMPLATES } from "../src/rules/environment/dungeon/underworldRegions.js";

function countIdentity(world, identity) {
  let count = 0;
  for (const [, named] of world.query(NamedIdentity)) {
    if (named.identity === identity) count++;
  }
  return count;
}

Deno.test("roomless dungeon profiles still materialize their down stairs", async () => {
  clearAll();
  const world = new World({ seed: 0x7171 });
  const floor = await generateFloor(world, world.seed, 1, null, null, [{ x: 64, y: 64 }], {
    templateId: "bat_cave",
    anchorX: 64,
    anchorY: 64,
  });

  assertEquals(floor.downStairPositions.length, 1);
  assertEquals(countIdentity(world, "stair_down"), 1);
});

Deno.test("templated descent preserves an exact return stair", async () => {
  clearFloorCache();
  clearAll();
  const world = new World({ seed: 0x7272 });
  const first = await generateFloor(world, world.seed, 1, null, null, [{ x: 64, y: 64 }], {
    templateId: "bat_cave",
    anchorX: 64,
    anchorY: 64,
  });
  const down = first.downStairPositions[0];
  const dungeon = world.create();
  world.add(dungeon, DungeonState, {
    worldSeed: world.seed,
    currentDepth: 1,
    activeTemplateId: "bat_cave",
    activeRegionKey: "z1:64,64:bat_cave",
    regionAnchorX: 64,
    regionAnchorY: 64,
    floorEntityIds: first.entityIds,
    downStairPositions: first.downStairPositions,
  });
  const player = world.create();
  world.add(player, Player, {});
  world.add(player, Position, down);

  await transitionToDepth(world, 2, down, {
    direction: "down",
    stairPos: down,
    templateId: "bat_cave",
    anchorX: 64,
    anchorY: 64,
  });

  let returnStair = null;
  for (const [, named, pos] of world.query(NamedIdentity, Position)) {
    if (named.identity === "stair_up" && pos.x === down.x && pos.y === down.y) {
      returnStair = pos;
      break;
    }
  }
  assert(returnStair, "the lower floor must have an up stair where the player arrived");
});

Deno.test("authored dungeons include deep and populated options", async () => {
  assert(
    Object.values(UNDERWORLD_REGION_TEMPLATES).some((template) => template.floors >= 6),
    "at least one authored dungeon should be deep",
  );

  clearAll();
  const world = new World({ seed: 0x7373 });
  await generateFloor(world, world.seed, 2, null, null, [{ x: 64, y: 64 }], {
    templateId: "human_mine",
    anchorX: 64,
    anchorY: 64,
  });
  assert(countIdentity(world, "cave_spider") >= 4, "deeper mine floors should contain monsters");
});
