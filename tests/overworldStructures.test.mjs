import { assert, assertEquals } from "jsr:@std/assert";

import { BUILDING_DEFS } from "../src/rules/data/buildings/buildingRegistry.js";
import { generateOverworldChunks } from "../src/rules/environment/dungeon/overworld.js";
import {
  CHUNK_SIZE,
  TILE_COBBLESTONE,
  TILE_DOOR,
  TILE_FARMLAND,
  TILE_FENCE,
  TILE_FLOOR,
  TILE_MOUNTAIN,
  TILE_MOUNTAIN_B,
  TILE_MOUNTAIN_C,
  TILE_ROCKY_SHORE,
  TILE_STAIR_DOWN,
  TILE_WALL,
  TILE_WATER,
  TILE_WATER_DEEP,
  TILE_SHALLOW_WATER,
} from "../src/rules/environment/dungeon/constants.js";
import { clearAll, isFlyable, isWalkable, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";
import { rotateBuildingDef } from "../src/rules/environment/dungeon/townPlacement.js";

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

function spawnsOfKind(chunks, kind) {
  const out = [];
  for (const chunk of chunks) {
    for (const spawn of chunk.spawns) {
      if (spawn.kind === kind) out.push(spawn);
    }
  }
  return out.sort((a, b) => a.x - b.x || a.y - b.y);
}

function countKind(chunks, kind) {
  return spawnsOfKind(chunks, kind).length;
}

function nearestTileDistance(chunks, from, wantedTiles, maxR = 48) {
  for (let r = 0; r <= maxR; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        if (wantedTiles.has(getWorldTile(chunks, from.x + dx, from.y + dy))) return r;
      }
    }
  }
  return Infinity;
}

function key(x, y) {
  return `${x},${y}`;
}

function canReach(start, target, margin = 70) {
  const minX = Math.min(start.x, target.x) - margin;
  const maxX = Math.max(start.x, target.x) + margin;
  const minY = Math.min(start.y, target.y) - margin;
  const maxY = Math.max(start.y, target.y) + margin;
  const queue = [[start.x, start.y]];
  const seen = new Set([key(start.x, start.y)]);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    if (x === target.x && y === target.y) return true;
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      const k = key(nx, ny);
      if (nx < minX || nx > maxX || ny < minY || ny > maxY || seen.has(k) || !isWalkable(nx, ny)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return false;
}

function canReachNear(start, target, radius = 2) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = target.x + dx;
      const y = target.y + dy;
      if (isWalkable(x, y) && canReach(start, { x, y })) return true;
    }
  }
  return false;
}

function loadAll(chunks) {
  clearAll();
  for (const chunk of chunks) loadChunk(chunk.chunkX, chunk.chunkY, chunk.tiles);
}

Deno.test("overworld procedurally stamps the required town economy", () => {
  const { chunks } = generateOverworldChunks(SEED);

  assertEquals(countKind(chunks, "tavern_sign"), 1, "market district should anchor on a tavern");
  assertEquals(countKind(chunks, "smithy_sign"), 1, "workshop district should anchor on a smithy");
  assertEquals(countKind(chunks, "church_sign"), 1, "churchyard district should anchor on a church");
  assertEquals(countKind(chunks, "home_sign"), 1, "civic core should expose a home sign");
  assertEquals(countKind(chunks, "message_board"), 1, "town should have a bulletin board");
  assertEquals(countKind(chunks, "well"), 1, "civic core should include a well plaza");

  assert(countKind(chunks, "crop_wheat") >= 12, "farm should plant wheat");
  assert(countKind(chunks, "crop_carrot") >= 6, "farm should plant carrots");
  assert(countKind(chunks, "crop_corn") >= 6, "farm should plant corn");
  assert(countKind(chunks, "farm_animal") >= 4, "farm should support animals");
  assert(countKind(chunks, "townfolk") >= 8, "buildings should open town professions");
});

Deno.test("building rotation transforms tiles, spawns, waypoints, and shop rooms around the keystone", () => {
  const tavern = rotateBuildingDef(BUILDING_DEFS.tavern, 1);
  const door = tavern.tiles.find((tile) => tile.tile === "door");
  const sign = tavern.spawns.find((spawn) => spawn.kind === "tavern_sign");
  const waypoint = tavern.waypoints.find((point) => point.name === "vendor_work");

  assertEquals(door, { dx: 0, dy: 0, tile: "door" });
  assertEquals(sign, { dx: 1, dy: -1, kind: "tavern_sign" });
  assertEquals(waypoint, { dx: 1, dy: 4, name: "vendor_work" });

  const apothecary = rotateBuildingDef(BUILDING_DEFS.apothecary, 1);
  assertEquals(apothecary.shop.room, "shop", "shop metadata should survive rotation");
  assert(apothecary.rooms[0].w > 0 && apothecary.rooms[0].h > 0, "rotated rooms should keep positive extents");
});

Deno.test("terrain heuristics bias resource buildings toward useful landscape", () => {
  const { chunks, spawnX, spawnY } = generateOverworldChunks(SEED);
  const smithy = spawnsOfKind(chunks, "smithy_sign")[0];
  const farmCrop = spawnsOfKind(chunks, "crop_wheat")[0];
  const mill = spawnsOfKind(chunks, "millstone")[0];
  const herbStore = spawnsOfKind(chunks, "herb_chest")[0];
  const mountains = new Set([TILE_MOUNTAIN, TILE_MOUNTAIN_B, TILE_MOUNTAIN_C, TILE_ROCKY_SHORE]);
  const water = new Set([TILE_WATER, TILE_WATER_DEEP, TILE_SHALLOW_WATER]);

  assert(nearestTileDistance(chunks, { x: spawnX, y: spawnY }, water, 32) <= 16, "town core should form near coastline or waterfront");
  assert(nearestTileDistance(chunks, farmCrop, water, 48) <= 18, "farm should bias toward water");
  assert(nearestTileDistance(chunks, mill, water, 48) <= 18, "mill should bias toward water");
  assert(nearestTileDistance(chunks, herbStore, water, 48) <= 18, "herbal/alchemy supply should bias toward water or wet edges");
  assert(nearestTileDistance(chunks, smithy, mountains, 56) <= 40, "smithy should bias toward mining terrain");
  assertEquals(getWorldTile(chunks, farmCrop.x, farmCrop.y), TILE_FARMLAND, "farm crops must sit on stamped farmland");
});

Deno.test("procedural building stamps do not overlap destructively", () => {
  const { chunks } = generateOverworldChunks(SEED);
  const structureTiles = new Set([TILE_FLOOR, TILE_WALL, TILE_DOOR, TILE_STAIR_DOWN, TILE_FARMLAND, TILE_FENCE]);

  for (const [key, def] of Object.entries(BUILDING_DEFS)) {
    const requiredSpawnKind = {
      tavern: "tavern_sign",
      smithy: "smithy_sign",
      church: "church_sign",
      farm: "crop_wheat",
      well_plaza: "well",
      graveyard: "grave_tombstone",
      apothecary: "apothecary_sign",
      gem_store: "gem_shop_sign",
      book_shop: "book_shop_sign",
      general_store: "general_store_sign",
      windmill: "millstone",
      cottage: "home_bed",
      herbalist_hut: "herb_chest",
    }[key];
    assert(requiredSpawnKind && countKind(chunks, requiredSpawnKind) > 0, `${key} should be represented by authored spawns`);
    assert(def.tiles.length > 0, `${key} should have a real tile stamp`);
  }

  for (const chunk of chunks) {
    for (const spawn of chunk.spawns) {
      if (!spawn.kind.startsWith("harvest_")) continue;
      const tile = getWorldTile(chunks, spawn.x, spawn.y);
      assert(!structureTiles.has(tile), `${spawn.kind} spawned inside a structure at ${spawn.x},${spawn.y}`);
    }
  }
});

Deno.test("procedural paths connect district doors without punching through walls", () => {
  const { chunks, spawnX, spawnY } = generateOverworldChunks(SEED);
  loadAll(chunks);

  const start = { x: spawnX, y: spawnY };
  const targets = [
    spawnsOfKind(chunks, "tavern_sign")[0],
    spawnsOfKind(chunks, "smithy_sign")[0],
    spawnsOfKind(chunks, "church_sign")[0],
    spawnsOfKind(chunks, "well")[0],
  ];
  for (const target of targets) {
    assert(target, "expected reachable target spawn");
    assert(canReachNear(start, target), `expected town path reachability near ${target.kind} at ${target.x},${target.y}`);
  }

  let cobble = 0;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.tiles.length; i++) {
      if (chunk.tiles[i] === TILE_COBBLESTONE) cobble++;
    }
  }
  assert(cobble > 20, "path network should leave a visible cobblestone trace");

  clearAll();
});

Deno.test("TILE_FARMLAND is walkable and flyable, TILE_FENCE is not walkable but flyable", () => {
  const { chunks } = generateOverworldChunks(SEED);
  loadAll(chunks);
  const crop = spawnsOfKind(chunks, "crop_wheat")[0];
  const fence = (() => {
    for (const chunk of chunks) {
      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          if (chunk.tiles[ly * CHUNK_SIZE + lx] === TILE_FENCE) {
            return { x: chunk.chunkX * CHUNK_SIZE + lx, y: chunk.chunkY * CHUNK_SIZE + ly };
          }
        }
      }
    }
    return null;
  })();

  assert(crop, "expected crop spawn");
  assert(fence, "expected farm fence");
  assertEquals(isWalkable(crop.x, crop.y), true, "farmland should be walkable");
  assertEquals(isFlyable(crop.x, crop.y), true, "farmland should be flyable");
  assertEquals(isWalkable(fence.x, fence.y), false, "fence should not be walkable");
  assertEquals(isFlyable(fence.x, fence.y), true, "fence should be flyable");

  clearAll();
});
