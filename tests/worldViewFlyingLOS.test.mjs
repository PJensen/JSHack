import { assert } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { buildWorldView } from "../src/bridge/schema/worldView.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { Flying } from "../src/rules/components/Flying.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { clearAll, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";
import { clearExplored } from "../src/rules/environment/dungeon/exploredMap.js";
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL } from "../src/rules/environment/dungeon/constants.js";
import { buildCatalogItem } from "../src/rules/data/itemCatalogLoader.js";

function addDungeonState(world, depth, profileType = 'default') {
  const id = world.create();
  world.add(id, DungeonState, {
    worldSeed: 1,
    currentDepth: depth,
    profileType,
    floorEntityIds: [],
    downStairPositions: [],
  });
  return id;
}

function loadWallBetweenPlayerAndTarget() {
  clearAll();
  clearExplored();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
  tiles[0 * CHUNK_SIZE + 2] = TILE_WALL;
  loadChunk(0, 0, tiles);
}

Deno.test("WorldView shows overworld flyers even when terrain blocks tile FOV", () => {
  loadWallBetweenPlayerAndTarget();
  const world = new World({ seed: 11 });
  addDungeonState(world, 0, 'overworld');

  const player = world.create();
  world.add(player, Player, {});
  world.add(player, Position, { x: 0, y: 0 });
  world.add(player, NamedIdentity, { name: "Hero", identity: "player" });

  const bat = world.create();
  world.add(bat, Position, { x: 4, y: 0 });
  world.add(bat, Flying, {});
  world.add(bat, NamedIdentity, { name: "Bat", identity: "bat" });

  const view = buildWorldView(world);
  const visibleBat = view.entities.find((entity) => entity.id === bat);
  assert(visibleBat, "expected overworld flyer to remain visible through wall cover");
});

Deno.test("WorldView still hides cave flyers behind blocked LOS", () => {
  loadWallBetweenPlayerAndTarget();
  const world = new World({ seed: 12 });
  addDungeonState(world, 5, 'caves');

  const player = world.create();
  world.add(player, Player, {});
  world.add(player, Position, { x: 0, y: 0 });
  world.add(player, NamedIdentity, { name: "Hero", identity: "player" });

  const bat = world.create();
  world.add(bat, Position, { x: 4, y: 0 });
  world.add(bat, Flying, {});
  world.add(bat, NamedIdentity, { name: "Bat", identity: "bat" });

  const view = buildWorldView(world);
  const visibleBat = view.entities.find((entity) => entity.id === bat);
  assert(!visibleBat, "expected cave flyer to stay hidden behind wall cover");
});

Deno.test("WorldView tags actors carrying an offhand torch for display emitters", () => {
  clearAll();
  clearExplored();
  loadChunk(0, 0, new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR));

  const world = new World({ seed: 13 });
  addDungeonState(world, 1, "default");

  const player = world.create();
  world.add(player, Player, {});
  world.add(player, Position, { x: 1, y: 1 });
  world.add(player, NamedIdentity, { name: "Hero", identity: "player" });
  world.add(player, Equipment, {});

  const torch = buildCatalogItem(world, "torch");
  world.get(player, Equipment).offhand = torch;

  const view = buildWorldView(world);
  const playerView = view.entities.find((entity) => entity.id === player);
  assert(playerView, "expected player to appear in world view");
  assert(playerView.tags.includes("torch"), "expected offhand torch to project a torch display tag");
});
