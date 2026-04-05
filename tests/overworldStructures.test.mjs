// tests/overworldStructures.test.mjs
// Verify the organized overworld settlement layout: scaled house, farm, outbuildings, and walkways.

import { assert, assertEquals } from "jsr:@std/assert";
import { generateOverworldChunks } from "../src/rules/environment/dungeon/overworld.js";
import {
  CHUNK_SIZE,
  TILE_DOOR,
  TILE_FARMLAND,
  TILE_FENCE,
  TILE_FLOOR,
  TILE_COBBLESTONE,
  TILE_GRASS,
  TILE_SHALLOW_WATER,
  TILE_STAIR_DOWN,
  TILE_WALL,
  TILE_WATER,
  TILE_WATER_DEEP,
} from "../src/rules/environment/dungeon/constants.js";
import { clearAll, isFlyable, isWalkable, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";

const SEED = 0xC0FFEE;

function getWorldTile(chunks, x, y) {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  const chunk = chunks.find((c) => c.chunkX === cx && c.chunkY === cy);
  if (!chunk) return -1;
  const lx = x - cx * CHUNK_SIZE;
  const ly = y - cy * CHUNK_SIZE;
  return chunk.tiles[ly * CHUNK_SIZE + lx];
}

function coordsOfKind(chunks, kind) {
  const coords = [];
  for (const chunk of chunks) {
    for (const spawn of chunk.spawns) {
      if (spawn.kind === kind) coords.push(`${spawn.x},${spawn.y}`);
    }
  }
  return coords.sort();
}

function key(x, y) {
  return `${x},${y}`;
}

function anyCoordWithin(coords, centerX, centerY, radius) {
  for (const coord of coords) {
    const [xStr, yStr] = String(coord).split(",");
    const x = Number(xStr);
    const y = Number(yStr);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (Math.abs(x - centerX) <= radius && Math.abs(y - centerY) <= radius) return true;
  }
  return false;
}

function canReach(startX, startY, targetX, targetY) {
  const minX = homeX - 32;
  const maxX = homeX + 32;
  const minY = homeY - 40;
  const maxY = homeY + 32;
  const queue = [[startX, startY]];
  const seen = new Set([key(startX, startY)]);
  const steps = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    if (x === targetX && y === targetY) return true;
    for (const [dx, dy] of steps) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
      const k = key(nx, ny);
      if (seen.has(k) || !isWalkable(nx, ny)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return false;
}

const minX = -2 * CHUNK_SIZE;
const maxX = (2 + 1) * CHUNK_SIZE - 1;
const homeX = Math.floor((minX + maxX) / 2);
const homeY = homeX; // symmetric extent

const houseHalfW = 4;
const houseHalfH = 2;
const doorX = homeX;
const doorY = homeY - houseHalfH;
const fountainCX = homeX;
const fountainCY = homeY - 6;
const spawnX = fountainCX;
const spawnY = fountainCY + 2;
const northWalkY = homeY - houseHalfH - 1;
const southWalkY = homeY + houseHalfH + 1;
const westWalkX = homeX - houseHalfW - 1;
const eastWalkX = homeX + houseHalfW + 1;
const houseStairAnchorX = eastWalkX + 1;
const houseStairAnchorY = homeY + 2;
const wellX = houseStairAnchorX + 5;
const wellY = houseStairAnchorY;
const gateX = homeX + 1;
const gateY = homeY + 5;
const farmX0 = homeX - 4;
const farmX1 = homeX + 4;
const farmY0 = homeY + 6;
const farmY1 = homeY + 18;
const tavX0 = homeX + 6;
const tavY0 = homeY - 10;
const stairX = tavX0 + 4;
const stairY = tavY0 + 5;
const tavX1 = homeX + 14;
const tavY1 = homeY - 4;
const tavDoorX = tavX0;
const tavDoorY = tavY0 + 3;
const crossingY = homeY - 20;
const millX0 = homeX - 10;
const millY0 = crossingY - 13;
const millX1 = millX0 + 4;
const millY1 = millY0 + 4;
const millDoorX = millX0 + 2;
// New smithy: anchor (keystone) at (homeX - 7, homeY), stamped from JSON.
const smithyAnchorX = homeX - 7;
const smithyAnchorY = homeY;
const apothX0 = homeX - 29;
const apothY0 = homeY - 12;
const apothDoorX = apothX0 + 5;
const apothDoorY = apothY0 + 5;
const herbalistDoorX = apothX0 - 2;
const herbalistDoorY = apothY0 - 4;
const gemX0 = apothX0 - 16;
const gemY0 = apothY0;
const gemDoorX = gemX0 + 3;
const gemDoorY = gemY0 + 5;
const barkeepX0 = tavX0 + 12;
const barkeepY0 = tavY0 + 1;
const masonX0 = homeX + 23;
const masonY0 = homeY - 5;
const minerX0 = homeX + 20;
const minerY0 = homeY - 18;
const pondCX = homeX - 24;
const pondCY = homeY + 18;
const poisonGarden = new Set([
  `${apothX0 + 12},${apothY0 + 1}`,
  `${apothX0 + 13},${apothY0 + 1}`,
  `${apothX0 + 12},${apothY0 + 2}`,
  `${apothX0 + 13},${apothY0 + 2}`,
]);

Deno.test("overworld scales the player house down to a 9x5 footprint with a front walk", () => {
  const { chunks, spawnX: actualSpawnX, spawnY: actualSpawnY } = generateOverworldChunks(SEED);

  assertEquals(actualSpawnX, spawnX);
  assertEquals(actualSpawnY, spawnY);
  assertEquals(getWorldTile(chunks, homeX - houseHalfW, homeY - houseHalfH), TILE_WALL);
  assertEquals(getWorldTile(chunks, homeX + houseHalfW, homeY - houseHalfH), TILE_WALL);
  assertEquals(getWorldTile(chunks, homeX - houseHalfW, homeY + houseHalfH), TILE_WALL);
  assertEquals(getWorldTile(chunks, homeX + houseHalfW, homeY + houseHalfH), TILE_WALL);
  assertEquals(getWorldTile(chunks, doorX, doorY), TILE_DOOR);
  assertEquals(getWorldTile(chunks, doorX, southWalkY), TILE_FLOOR);
  assertEquals(getWorldTile(chunks, westWalkX, northWalkY), TILE_FLOOR);
  assertEquals(getWorldTile(chunks, eastWalkX, southWalkY), TILE_FLOOR);
});

Deno.test("overworld places the dungeon entrance inside the tavern", () => {
  const { chunks } = generateOverworldChunks(SEED);

  assertEquals(getWorldTile(chunks, stairX, stairY), TILE_STAIR_DOWN);
  // Cobblestone path leads from fountain plaza to tavern door
  assertEquals(getWorldTile(chunks, tavDoorX, tavDoorY), TILE_DOOR);
  assertEquals(getWorldTile(chunks, tavDoorX - 2, tavDoorY), TILE_COBBLESTONE);
});

Deno.test("overworld farm keeps the full tilled plot and uses a real fence gate", () => {
  const { chunks } = generateOverworldChunks(SEED);

  assertEquals(getWorldTile(chunks, farmX0, farmY0), TILE_FARMLAND);
  assertEquals(getWorldTile(chunks, farmX1, farmY1), TILE_FARMLAND);
  assertEquals(getWorldTile(chunks, farmX0, gateY), TILE_FENCE);
  assertEquals(getWorldTile(chunks, farmX1, gateY), TILE_FENCE);
  assertEquals(getWorldTile(chunks, gateX, gateY), TILE_DOOR);
});

Deno.test("overworld crops are planted in vertical columns and scarecrows sit in the farm", () => {
  const { chunks } = generateOverworldChunks(SEED);

  // 4 columns × 6 rows = 24 crops total (wheat, carrot, corn, wheat)
  const wheat = coordsOfKind(chunks, "crop_wheat");
  const carrot = coordsOfKind(chunks, "crop_carrot");
  const corn = coordsOfKind(chunks, "crop_corn");
  assertEquals(wheat.length, 12);  // 2 wheat columns × 6
  assertEquals(carrot.length, 6);  // 1 carrot column × 6
  assertEquals(corn.length, 6);    // 1 corn column × 6
  assertEquals(coordsOfKind(chunks, "scarecrow").length, 2);
  assertEquals(coordsOfKind(chunks, "well"), [`${wellX},${wellY}`]);
});

Deno.test("tavern and windmill keep their intended footprints, doors, and interior props", () => {
  const { chunks } = generateOverworldChunks(SEED);

  // Check interior floor tiles and door
  assertEquals(getWorldTile(chunks, tavX0 + 2, tavY0 + 2), TILE_FLOOR);
  assertEquals(getWorldTile(chunks, tavX0 + 4, tavY0 + 3), TILE_FLOOR);
  assertEquals(getWorldTile(chunks, tavX0 + 1, tavY0 + 1), TILE_FLOOR);
  assertEquals(getWorldTile(chunks, tavX0 + 7, tavY0 + 5), TILE_FLOOR);
  assertEquals(getWorldTile(chunks, tavDoorX, tavDoorY), TILE_DOOR);
  assertEquals(coordsOfKind(chunks, "tavern_keg"), [`${tavX0 + 1},${tavY0 + 1}`]);
  assertEquals(coordsOfKind(chunks, "tavern_table"), [
    `${tavX0 + 3},${tavY0 + 1}`,
    `${tavX0 + 4},${tavY0 + 1}`,
    `${tavX0 + 5},${tavY0 + 1}`,
    `${tavX0 + 6},${tavY0 + 1}`,
  ]);
  const tavernPillars = coordsOfKind(chunks, "tavern_pillar");
  assert(tavernPillars.includes(`${tavX0 + 2},${tavY0 + 3}`));
  assert(tavernPillars.includes(`${tavX0 + 6},${tavY0 + 3}`));
  assertEquals(coordsOfKind(chunks, "tavern_bench"), [
    `${tavX0 + 1},${tavY0 + 4}`,
    `${tavX0 + 2},${tavY0 + 4}`,
    `${tavX0 + 5},${tavY0 + 4}`,
    `${tavX0 + 6},${tavY0 + 4}`,
  ]);
  assertEquals(coordsOfKind(chunks, "tavern_sign"), [`${tavDoorX - 1},${tavDoorY - 1}`]);

  // Mill corners may be overwritten by cottage paths; check interior + door instead
  assertEquals(getWorldTile(chunks, millX0 + 1, millY0), TILE_WALL);
  assertEquals(getWorldTile(chunks, millX0 + 2, millY0 + 2), TILE_FLOOR);
  assertEquals(getWorldTile(chunks, millDoorX, millY1), TILE_DOOR);
  assertEquals(coordsOfKind(chunks, "millstone"), [`${millX0 + 2},${millY0 + 2}`]);
  assertEquals(coordsOfKind(chunks, "mill_chest"), [`${millX0 + 1},${millY0 + 2}`]);
});

Deno.test("blacksmith building has correct footprint, door, and interior spawns", () => {
  const { chunks } = generateOverworldChunks(SEED);
  const ax = smithyAnchorX;
  const ay = smithyAnchorY;

  // Main door on east wall connects via cobblestone to walkway
  assertEquals(getWorldTile(chunks, ax + -4, ay), TILE_DOOR);
  // Interior floor
  assertEquals(getWorldTile(chunks, ax + -8, ay), TILE_FLOOR);
  assertEquals(getWorldTile(chunks, ax + -7, ay + 1), TILE_FLOOR);
  // Walls around main body
  assertEquals(getWorldTile(chunks, ax + -11, ay), TILE_WALL);
  assertEquals(getWorldTile(chunks, ax + -4, ay + 1), TILE_WALL);
  // Interior spawns (offsets match smithy.json)
  assertEquals(coordsOfKind(chunks, "furnace"), [`${ax - 7},${ay + 5}`]);
  assertEquals(coordsOfKind(chunks, "anvil"), [`${ax - 12},${ay + 1}`]);
  assertEquals(coordsOfKind(chunks, "smithy_sign").length, 1);
});

Deno.test("overworld gem shop and town center props include the gem sign and bulletin board", () => {
  const { chunks } = generateOverworldChunks(SEED);

  assertEquals(coordsOfKind(chunks, "gem_display_case"), [
    `${gemX0 + 5},${gemY0 + 1}`,
    `${gemX0 + 3},${gemY0 + 1}`,
    `${gemX0 + 1},${gemY0 + 1}`,
  ]);
  assertEquals(coordsOfKind(chunks, "gem_shop_sign"), [`${gemDoorX + 2},${gemDoorY + 1}`]);
  assertEquals(coordsOfKind(chunks, "message_board"), [`${fountainCX - 3},${fountainCY + 1}`]);
});

Deno.test("overworld commute paths no longer punch holes in nearby buildings", () => {
  const { chunks } = generateOverworldChunks(SEED);

  assertEquals(getWorldTile(chunks, tavX0, tavDoorY - 1), TILE_WALL);
  assertEquals(getWorldTile(chunks, tavX0, tavDoorY + 1), TILE_WALL);
  assertEquals(getWorldTile(chunks, apothX0 + 2, apothY0), TILE_WALL);
  assertEquals(getWorldTile(chunks, apothX0 + 8, apothY0), TILE_WALL);
  assertEquals(getWorldTile(chunks, apothX0 + 2, apothDoorY), TILE_WALL);
  assertEquals(getWorldTile(chunks, apothX0 + 8, apothDoorY), TILE_WALL);
});

Deno.test("worker cottages keep separate footprints instead of overlapping", () => {
  const { chunks } = generateOverworldChunks(SEED);

  for (let y = barkeepY0; y <= barkeepY0 + 4; y++) {
    for (let x = barkeepX0; x <= barkeepX0 + 4; x++) {
      const tile = getWorldTile(chunks, x, y);
      assert(tile === TILE_WALL || tile === TILE_FLOOR || tile === TILE_DOOR, `barkeep cottage footprint damaged at ${x},${y}`);
    }
  }

  for (let y = masonY0; y <= masonY0 + 4; y++) {
    for (let x = masonX0; x <= masonX0 + 4; x++) {
      const tile = getWorldTile(chunks, x, y);
      assert(tile === TILE_WALL || tile === TILE_FLOOR || tile === TILE_DOOR, `mason cottage footprint damaged at ${x},${y}`);
    }
  }

  const overlapX0 = Math.max(barkeepX0, masonX0);
  const overlapY0 = Math.max(barkeepY0, masonY0);
  const overlapX1 = Math.min(barkeepX0 + 4, masonX0 + 4);
  const overlapY1 = Math.min(barkeepY0 + 4, masonY0 + 4);
  assert(overlapX0 > overlapX1 || overlapY0 > overlapY1, "barkeep and mason cottages should not overlap");
});

Deno.test("apothecary uses a tighter cleaner footprint with shelves off the center aisle", () => {
  const { chunks } = generateOverworldChunks(SEED);

  assertEquals(getWorldTile(chunks, apothX0, apothY0), TILE_WALL);
  assertEquals(getWorldTile(chunks, apothX0 + 9, apothY0), TILE_WALL);
  assertEquals(getWorldTile(chunks, apothX0 + 5, apothY0 + 3), TILE_FLOOR);
  assertEquals(getWorldTile(chunks, apothDoorX, apothDoorY), TILE_DOOR);
  assertEquals(coordsOfKind(chunks, "alchemy_bench"), [`${apothX0 + 2},${apothY0 + 2}`]);
  assert(coordsOfKind(chunks, "herb_chest").includes(`${apothX0 + 2},${apothY0 + 4}`), "apothecary should include its herb chest");
  assertEquals(coordsOfKind(chunks, "potion_shelf"), [
    `${apothX0 + 4},${apothY0 + 1}`,
    `${apothX0 + 6},${apothY0 + 1}`,
    `${apothX0 + 8},${apothY0 + 2}`,
    `${apothX0 + 8},${apothY0 + 4}`,
  ].sort());
  assertEquals(coordsOfKind(chunks, "alchemy_shop_item"), [
    `${apothX0 + 4},${apothY0 + 3}`,
    `${apothX0 + 6},${apothY0 + 3}`,
    `${apothX0 + 7},${apothY0 + 4}`,
  ].sort());
});

Deno.test("herbalist hut is an eclectic stamped outbuilding with its own storage and garden clutter", () => {
  const { chunks } = generateOverworldChunks(SEED);

  assertEquals(getWorldTile(chunks, herbalistDoorX - 4, herbalistDoorY - 6), TILE_WALL);
  assertEquals(getWorldTile(chunks, herbalistDoorX, herbalistDoorY), TILE_DOOR);
  assertEquals(getWorldTile(chunks, herbalistDoorX, herbalistDoorY + 1), TILE_FLOOR);

  const herbChests = coordsOfKind(chunks, "herb_chest");
  const beds = coordsOfKind(chunks, "home_bed");

  assert(
    anyCoordWithin(herbChests, herbalistDoorX, herbalistDoorY, 5),
    "herbalist hut should keep a nearby herb chest",
  );
  assert(
    anyCoordWithin(beds, herbalistDoorX, herbalistDoorY, 7),
    "herbalist hut should keep a nearby bed",
  );
});

Deno.test("wild harvestables stay on exterior ground rather than structure tiles", () => {
  const { chunks } = generateOverworldChunks(SEED);
  const naturalKinds = new Set([
    "harvest_berries",
    "harvest_herbs",
    "harvest_thorn_bramble",
    "harvest_venom_fern",
  ]);

  for (const chunk of chunks) {
    for (const spawn of chunk.spawns) {
      if (!naturalKinds.has(spawn.kind)) continue;
      const tile = getWorldTile(chunks, spawn.x, spawn.y);
      assert(tile !== TILE_WALL, `${spawn.kind} spawned in a wall at ${spawn.x},${spawn.y}`);
      assert(tile !== TILE_FLOOR, `${spawn.kind} spawned on an indoor floor at ${spawn.x},${spawn.y}`);
      assert(tile !== TILE_DOOR, `${spawn.kind} spawned in a doorway at ${spawn.x},${spawn.y}`);
      assert(tile !== TILE_FARMLAND, `${spawn.kind} spawned in the farm plot at ${spawn.x},${spawn.y}`);
      assert(tile !== TILE_FENCE, `${spawn.kind} spawned on the fence line at ${spawn.x},${spawn.y}`);
    }
  }
});

Deno.test("wild poisonous plants stay out of the town core except for the alchemist garden", () => {
  const { chunks } = generateOverworldChunks(SEED);

  for (const chunk of chunks) {
    for (const spawn of chunk.spawns) {
      if (spawn.kind !== "harvest_thorn_bramble" && spawn.kind !== "harvest_venom_fern") continue;
      const key = `${spawn.x},${spawn.y}`;
      if (poisonGarden.has(key)) continue;
      const dist = Math.max(Math.abs(spawn.x - homeX), Math.abs(spawn.y - homeY));
      assert(dist >= 20, `${spawn.kind} should spawn further afield, got ${key}`);
    }
  }
});

Deno.test("lake sits outside the town core", () => {
  const { chunks } = generateOverworldChunks(SEED);
  let pondTiles = 0;

  for (let y = pondCY - 4; y <= pondCY + 4; y++) {
    for (let x = pondCX - 5; x <= pondCX + 5; x++) {
      const tile = getWorldTile(chunks, x, y);
      if (tile === TILE_SHALLOW_WATER || tile === TILE_WATER || tile === TILE_WATER_DEEP) {
        pondTiles++;
        const dist = Math.max(Math.abs(x - homeX), Math.abs(y - homeY));
        assert(dist >= 18, `pond tile drifted back into town at ${x},${y}`);
      }
    }
  }

  assert(pondTiles > 0, "expected to find pond tiles near the relocated lake center");
});

Deno.test("overworld walkways connect the house to the gate and outbuilding doors", () => {
  clearAll();
  const { chunks } = generateOverworldChunks(SEED);
  for (const chunk of chunks) loadChunk(chunk.chunkX, chunk.chunkY, chunk.tiles);

  assert(canReach(spawnX, spawnY, gateX, gateY), "farm gate should be reachable from spawn");
  assert(canReach(spawnX, spawnY, tavDoorX, tavDoorY), "tavern door should be reachable from spawn");
  assert(canReach(spawnX, spawnY, millDoorX, millY1), "windmill door should be reachable from spawn");
  assert(canReach(spawnX, spawnY, smithyAnchorX + -4, smithyAnchorY), "smithy door should be reachable from spawn");
  assert(canReach(spawnX, spawnY, herbalistDoorX, herbalistDoorY), "herbalist hut door should be reachable from spawn");
  assert(canReach(spawnX, spawnY, apothDoorX, apothDoorY), "apothecary door should be reachable from spawn");
  assert(canReach(herbalistDoorX, herbalistDoorY, apothDoorX, apothDoorY), "herbalist hut should connect to the apothecary by road");

  clearAll();
});

Deno.test("TILE_FARMLAND is walkable and flyable, TILE_FENCE is not walkable but flyable", () => {
  clearAll();
  const { chunks } = generateOverworldChunks(SEED);
  for (const chunk of chunks) loadChunk(chunk.chunkX, chunk.chunkY, chunk.tiles);

  assertEquals(isWalkable(homeX, homeY + 7), true, "farmland should be walkable");
  assertEquals(isFlyable(homeX, homeY + 7), true, "farmland should be flyable");
  assertEquals(isWalkable(farmX0, gateY), false, "fence should not be walkable");
  assertEquals(isFlyable(farmX0, gateY), true, "fence should be flyable");
  assertEquals(isWalkable(gateX, gateY), true, "gate should be walkable");

  clearAll();
});
