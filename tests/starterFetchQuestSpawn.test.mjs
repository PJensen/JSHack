import "./helpers/installContentCatalog.mjs";
import { assertEquals, assert } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import "../src/rules/quests/definitions/graveyardWatch.js";
import { ensureStarterFetchQuestItem } from "../src/rules/quests/definitions/graveyardWatch.js";
import { instantiateQuest, STARTER_PRIEST_FETCH_QUEST_ID } from "../src/rules/quests/runtime.js";

Deno.test("starter fetch quest seeds the book on dungeon depth 1 without duplicating it", () => {
  const world = new World({ seed: 123 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Inventory, { capacity: 8 });

  const priest = world.create();
  world.add(priest, NamedIdentity, { name: "Priest", identity: "townfolk_priest" });

  const stair = world.create();
  world.add(stair, Position, { x: 12, y: 7 });
  world.add(stair, NamedIdentity, { name: "Staircase Down", identity: "stair_down" });

  const dungeon = world.create();
  world.add(dungeon, DungeonState, {
    worldSeed: 123,
    currentDepth: 1,
    profileType: "catacombs",
    floorEntityIds: [stair],
    downStairPositions: [{ x: 12, y: 7 }],
    destroyedTiles: {},
  });

  instantiateQuest(world, STARTER_PRIEST_FETCH_QUEST_ID, {
    player,
    giver: priest,
    target: priest,
  }, {}, { node: "offer" });

  const first = ensureStarterFetchQuestItem(world);
  const second = ensureStarterFetchQuestItem(world);

  assert(first > 0, "book should spawn on depth 1");
  assertEquals(first, second);
  assertEquals(world.get(first, Position), { x: 12, y: 7 });
  assert(world.get(dungeon, DungeonState).floorEntityIds.includes(first));
});
