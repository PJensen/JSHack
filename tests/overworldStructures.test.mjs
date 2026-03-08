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
  TILE_WALL,
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

function canReach(startX, startY, targetX, targetY) {
  const minX = homeX - 18;
  const maxX = homeX + 18;
  const minY = homeY - 18;
  const maxY = homeY + 18;
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
const doorY = homeY + houseHalfH;
const spawnX = doorX;
const spawnY = doorY + 1;
const northWalkY = homeY - houseHalfH - 1;
const southWalkY = spawnY;
const westWalkX = homeX - houseHalfW - 1;
const eastWalkX = homeX + houseHalfW + 1;
const gateX = homeX + 1;
const gateY = homeY + 5;
const farmX0 = homeX - 2;
const farmX1 = homeX + 4;
const farmY0 = homeY + 6;
const farmY1 = homeY + 11;
const tavX0 = homeX + 6;
const tavY0 = homeY - 10;
const tavX1 = homeX + 14;
const tavY1 = homeY - 4;
const tavDoorX = tavX0 + 4;
const tavDoorY = tavY1;
const millX0 = homeX - 10;
const millY0 = homeY - 8;
const millX1 = homeX - 6;
const millY1 = homeY - 4;
const millDoorX = millX0 + 2;

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

Deno.test("overworld farm keeps the full tilled plot and uses a real fence gate", () => {
  const { chunks } = generateOverworldChunks(SEED);

  assertEquals(getWorldTile(chunks, farmX0, farmY0), TILE_FARMLAND);
  assertEquals(getWorldTile(chunks, farmX1, farmY1), TILE_FARMLAND);
  assertEquals(getWorldTile(chunks, farmX0, gateY), TILE_FENCE);
  assertEquals(getWorldTile(chunks, farmX1, gateY), TILE_FENCE);
  assertEquals(getWorldTile(chunks, gateX, gateY), TILE_DOOR);
});

Deno.test("overworld crops are planted in neat rows and the scarecrow sits in the farm center", () => {
  const { chunks } = generateOverworldChunks(SEED);

  assertEquals(coordsOfKind(chunks, "crop_wheat"), [
    `${homeX - 1},${homeY + 7}`,
    `${homeX + 1},${homeY + 7}`,
    `${homeX + 3},${homeY + 7}`,
  ]);
  assertEquals(coordsOfKind(chunks, "crop_turnip"), [
    `${homeX - 1},${homeY + 9}`,
    `${homeX + 1},${homeY + 9}`,
    `${homeX + 3},${homeY + 9}`,
  ]);
  assertEquals(coordsOfKind(chunks, "crop_pumpkin"), [
    `${homeX - 1},${homeY + 11}`,
    `${homeX + 1},${homeY + 11}`,
    `${homeX + 3},${homeY + 11}`,
  ]);
  assertEquals(coordsOfKind(chunks, "scarecrow"), [`${homeX + 1},${homeY + 8}`]);
  assertEquals(coordsOfKind(chunks, "well"), [`${homeX - 3},${southWalkY + 1}`]);
});

Deno.test("tavern and windmill keep their intended footprints, doors, and interior props", () => {
  const { chunks } = generateOverworldChunks(SEED);

  assertEquals(getWorldTile(chunks, tavX0, tavY0), TILE_WALL);
  assertEquals(getWorldTile(chunks, tavX0 + 8, tavY0), TILE_WALL);
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
  assertEquals(coordsOfKind(chunks, "tavern_pillar"), [
    `${tavX0 + 2},${tavY0 + 3}`,
    `${tavX0 + 6},${tavY0 + 3}`,
  ]);
  assertEquals(coordsOfKind(chunks, "tavern_bench"), [
    `${tavX0 + 1},${tavY0 + 4}`,
    `${tavX0 + 2},${tavY0 + 4}`,
    `${tavX0 + 5},${tavY0 + 4}`,
    `${tavX0 + 6},${tavY0 + 4}`,
  ]);
  assertEquals(coordsOfKind(chunks, "tavern_sign"), [`${tavDoorX + 1},${tavDoorY}`]);

  assertEquals(getWorldTile(chunks, millX0, millY0), TILE_WALL);
  assertEquals(getWorldTile(chunks, millX1, millY1), TILE_WALL);
  assertEquals(getWorldTile(chunks, millX0 + 2, millY0 + 2), TILE_FLOOR);
  assertEquals(getWorldTile(chunks, millDoorX, millY1), TILE_DOOR);
  assertEquals(coordsOfKind(chunks, "millstone"), [`${millX0 + 2},${millY0 + 2}`]);
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

Deno.test("overworld walkways connect the house to the gate and outbuilding doors", () => {
  clearAll();
  const { chunks } = generateOverworldChunks(SEED);
  for (const chunk of chunks) loadChunk(chunk.chunkX, chunk.chunkY, chunk.tiles);

  assert(canReach(spawnX, spawnY, gateX, gateY), "farm gate should be reachable from spawn");
  assert(canReach(spawnX, spawnY, tavDoorX, tavDoorY), "tavern door should be reachable from spawn");
  assert(canReach(spawnX, spawnY, millDoorX, millY1), "windmill door should be reachable from spawn");

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
