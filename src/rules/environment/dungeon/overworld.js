// rules/environment/dungeon/overworld.js
// Deterministic depth-0 overworld generation (Perlin/fBM terrain + home clearing).

import { perlin2, buildPermutation, fbm01 } from "./generators/noise.js";
import { stampBuilding } from "./stampBuilding.js";
import smithyDef from "../../data/buildings/smithy.js";
import churchDef from "../../data/buildings/church.js";
import apothecaryDef from "../../data/buildings/apothecary.js";
import gemStoreDef from "../../data/buildings/gem_store.js";
import herbalistHutDef from "../../data/buildings/herbalist_hut.js";
import bookShopDef from "../../data/buildings/book_shop.js";
import {
  CHUNK_SIZE,
  TILE_FLOOR,
  TILE_WALL,
  TILE_DOOR,
  TILE_STAIR_DOWN,
  TILE_GRASS,
  TILE_GRASS_A,
  TILE_GRASS_C,
  TILE_GRASS_D,
  TILE_WATER,
  TILE_WATER_DEEP,
  TILE_MOUNTAIN,
  TILE_MOUNTAIN_B,
  TILE_MOUNTAIN_C,
  TILE_TREE,
  TILE_SHALLOW_WATER,
  TILE_FARMLAND,
  TILE_FENCE,
  TILE_COBBLESTONE,
} from "./constants.js";
import { setRoofed } from "./tileMap.js";
import { chebyshevScalar } from "../../utils/distance.js";
import { xyKey } from "../../utils/gridKey.js";

export const OVERWORLD_EXTENT = Object.freeze({
  minCX: -2,
  maxCX: 2,
  minCY: -2,
  maxCY: 2,
});

function chunkKey(cx, cy) { return `${cx},${cy}`; }

/**
 * @param {Map<string, { chunkX:number, chunkY:number, tiles:Uint8Array, spawns:any[] }>} chunks
 * @param {number} x
 * @param {number} y
 * @param {number} tile
 */
export function setWorldTile(chunks, x, y, tile) {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  const chunk = chunks.get(chunkKey(cx, cy));
  if (!chunk) return;
  const lx = x - cx * CHUNK_SIZE;
  const ly = y - cy * CHUNK_SIZE;
  if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) return;
  chunk.tiles[ly * CHUNK_SIZE + lx] = tile;
}

/**
 * @param {Map<string, { chunkX:number, chunkY:number, tiles:Uint8Array, spawns:any[] }>} chunks
 * @param {number} cx
 * @param {number} cy
 */
function getChunk(chunks, cx, cy) {
  return chunks.get(chunkKey(cx, cy));
}

/**
 * @param {Map<string, { chunkX:number, chunkY:number, tiles:Uint8Array, spawns:any[] }>} chunks
 * @param {number} x
 * @param {number} y
 */
function getWorldTile(chunks, x, y) {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  const chunk = chunks.get(chunkKey(cx, cy));
  if (!chunk) return TILE_WATER;
  const lx = x - cx * CHUNK_SIZE;
  const ly = y - cy * CHUNK_SIZE;
  if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) return TILE_WATER;
  return chunk.tiles[ly * CHUNK_SIZE + lx];
}

/**
 * @param {Map<string, { chunkX:number, chunkY:number, tiles:Uint8Array, spawns:any[] }>} chunks
 * @param {number} cx
 * @param {number} cy
 * @param {number} seed
 * @param {Uint8Array} perm
 */
function fillChunkTerrain(chunks, cx, cy, seed, perm) {
  const chunk = getChunk(chunks, cx, cy);
  if (!chunk) return;
  const elevCfg = { scale: 0.035, oct: 4, persist: 0.55, lacun: 2.0 };
  const moistCfg = { scale: 0.060, oct: 3, persist: 0.55, lacun: 2.0 };
  const ox = cx * CHUNK_SIZE;
  const oy = cy * CHUNK_SIZE;
  const saltX = ((seed ^ 0xA53) & 1023) - 512;
  const saltY = ((seed ^ 0xC17) & 1023) - 512;

  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = ox + lx;
      const wy = oy + ly;
      const elev = fbm01(wx + saltX, wy + saltY, perm, elevCfg);
      const ridge = Math.pow(elev, 1.35);
      const moist = fbm01(wx + 1000 + saltX, wy - 777 + saltY, perm, moistCfg);

      let tile;
      if (elev < 0.18) {
        tile = TILE_WATER_DEEP;
      } else if (elev < 0.30) {
        tile = TILE_WATER;
      } else if (ridge > 0.78) {
        tile = TILE_MOUNTAIN_C;
      } else if (ridge > 0.65) {
        tile = TILE_MOUNTAIN_B;
      } else if (ridge > 0.54) {
        tile = TILE_MOUNTAIN;
      } else if (moist > 0.62 && elev >= 0.24 && elev <= 0.75) {
        tile = TILE_TREE;
      } else {
        // Grass variant: cheap high-freq noise for texture
        const gv = (perlin2((wx + 2000) * 0.28, (wy + 3000) * 0.28, perm) + 1) * 0.5;
        if (gv < 0.25)       tile = TILE_GRASS_A;
        else if (gv < 0.55)  tile = TILE_GRASS;
        else if (gv < 0.82)  tile = TILE_GRASS_C;
        else                 tile = TILE_GRASS_D;
      }
      chunk.tiles[ly * CHUNK_SIZE + lx] = tile;
    }
  }
}

/**
 * @param {Map<string, { chunkX:number, chunkY:number, tiles:Uint8Array, spawns:any[] }>} chunks
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 */
function fillDisk(chunks, cx, cy, radius) {
  const rr = radius * radius;
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= rr) setWorldTile(chunks, x, y, TILE_GRASS);
    }
  }
}

/**
 * @param {Map<string, { chunkX:number, chunkY:number, tiles:Uint8Array, spawns:any[] }>} chunks
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 */
function carvePath(chunks, x0, y0, x1, y1) {
  let x = x0;
  let y = y0;
  while (x !== x1) {
    setWorldTile(chunks, x, y, TILE_FLOOR);
    x += x < x1 ? 1 : -1;
  }
  while (y !== y1) {
    setWorldTile(chunks, x, y, TILE_FLOOR);
    y += y < y1 ? 1 : -1;
  }
  setWorldTile(chunks, x1, y1, TILE_FLOOR);
}

/**
 * Carve an orthogonal path that resolves vertical travel before horizontal travel.
 * Useful when a straight horizontal-first route would slice through an adjacent structure shell.
 * @param {Map<string, { chunkX:number, chunkY:number, tiles:Uint8Array, spawns:any[] }>} chunks
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 */
function carvePathVerticalFirst(chunks, x0, y0, x1, y1) {
  let x = x0;
  let y = y0;
  while (y !== y1) {
    setWorldTile(chunks, x, y, TILE_FLOOR);
    y += y < y1 ? 1 : -1;
  }
  while (x !== x1) {
    setWorldTile(chunks, x, y, TILE_FLOOR);
    x += x < x1 ? 1 : -1;
  }
  setWorldTile(chunks, x1, y1, TILE_FLOOR);
}

/**
 * @param {Map<string, { chunkX:number, chunkY:number, tiles:Uint8Array, spawns:any[] }>} chunks
 * @param {number} x
 * @param {number} y
 * @param {string} kind
 * @param {Record<string, any>} [params]
 */
export function addSpawn(chunks, x, y, kind, params = {}) {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  const chunk = chunks.get(chunkKey(cx, cy));
  if (!chunk) return;
  chunk.spawns.push({ x, y, kind, params });
}

function setStructureTile(chunks, x, y, tile, roofed = false) {
  setWorldTile(chunks, x, y, tile);
  setRoofed(x, y, roofed);
}

/**
 * Paint a wall-bounded structure from explicit interior floor cells.
 * The wall ring is inferred from the interior, so irregular plans stay easy to author.
 * @param {Map<string, { chunkX:number, chunkY:number, tiles:Uint8Array, spawns:any[] }>} chunks
 * @param {Array<{x:number, y:number}>} floorCells
 * @param {{ x:number, y:number }} door
 */
function paintStructure(chunks, floorCells, door) {
  const floorKeys = new Set(floorCells.map((cell) => xyKey(cell.x, cell.y)));
  const wallKeys = new Set();

  for (const cell of floorCells) {
    setStructureTile(chunks, cell.x, cell.y, TILE_FLOOR, true);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const x = cell.x + dx;
        const y = cell.y + dy;
        const key = xyKey(x, y);
        if (floorKeys.has(key)) continue;
        if (door.x === x && door.y === y) continue;
        wallKeys.add(key);
      }
    }
  }

  for (const key of wallKeys) {
    const [x, y] = key.split(",").map(Number);
    setStructureTile(chunks, x, y, TILE_WALL, true);
  }
  setStructureTile(chunks, door.x, door.y, TILE_DOOR, true);
}

/**
 * Build a compact cottage with a door and bed.
 * Returns interior anchors for assigning residents.
 * @param {Map<string, { chunkX:number, chunkY:number, tiles:Uint8Array, spawns:any[] }>} chunks
 * @param {number} x0
 * @param {number} y0
 * @param {"north"|"south"} doorSide
 * @returns {{ doorX:number, doorY:number, sleepX:number, sleepY:number, standX:number, standY:number }}
 */
function buildCottage(chunks, x0, y0, doorSide = "south") {
  const floorCells = [];
  for (let y = y0 + 1; y <= y0 + 3; y++) {
    for (let x = x0 + 1; x <= x0 + 3; x++) {
      floorCells.push({ x, y });
    }
  }
  const doorX = x0 + 2;
  const doorY = doorSide === "north" ? y0 : y0 + 4;
  paintStructure(chunks, floorCells, { x: doorX, y: doorY });

  const sleepX = x0 + 1;
  const sleepY = y0 + 2;
  const standX = x0 + 2;
  const standY = y0 + 2;
  addSpawn(chunks, sleepX, sleepY, "home_bed");
  return { doorX, doorY, sleepX, sleepY, standX, standY };
}

function isOutdoorGroundTile(tile) {
  return tile === TILE_GRASS
      || tile === TILE_GRASS_A
      || tile === TILE_GRASS_C
      || tile === TILE_GRASS_D;
}

/**
 * Keep natural gatherables on exterior ground instead of under later-built structures.
 * @param {Map<string, { chunkX:number, chunkY:number, tiles:Uint8Array, spawns:any[] }>} chunks
 * @param {number} hintX
 * @param {number} hintY
 * @param {number} maxR
 */
function findOutdoorSpawnTile(chunks, hintX, hintY, maxR = 10, predicate = null) {
  for (let r = 0; r <= maxR; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = hintX + dx;
        const y = hintY + dy;
        if (predicate && !predicate(x, y)) continue;
        if (isOutdoorGroundTile(getWorldTile(chunks, x, y))) {
          return { x, y };
        }
      }
    }
  }
  return null;
}

/**
 * @param {Map<string, { chunkX:number, chunkY:number, tiles:Uint8Array, spawns:any[] }>} chunks
 * @param {{ x:number, y:number }} pos
 * @param {string} kind
 */
function addOutdoorSpawn(chunks, pos, kind, predicate = null) {
  const target = findOutdoorSpawnTile(chunks, pos.x, pos.y, 10, predicate) ?? pos;
  if (!isOutdoorGroundTile(getWorldTile(chunks, target.x, target.y))) {
    setWorldTile(chunks, target.x, target.y, TILE_GRASS);
  }
  addSpawn(chunks, target.x, target.y, kind);
}

/**
 * @param {number} worldSeed
 * @returns {{ extent:{minCX:number,maxCX:number,minCY:number,maxCY:number}, chunks:Array<{chunkX:number,chunkY:number,depth:number,seed:number,tiles:Uint8Array,rooms:any[],doors:any[],spawns:any[]}>, spawnX:number, spawnY:number }}
 */
export function generateOverworldChunks(worldSeed) {
  const extent = { ...OVERWORLD_EXTENT };
  const perm = buildPermutation(worldSeed >>> 0);
  /** @type {Map<string, { chunkX:number, chunkY:number, tiles:Uint8Array, spawns:any[] }>} */
  const chunks = new Map();

  for (let cy = extent.minCY; cy <= extent.maxCY; cy++) {
    for (let cx = extent.minCX; cx <= extent.maxCX; cx++) {
      const rec = {
        chunkX: cx,
        chunkY: cy,
        tiles: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE),
        spawns: [],
      };
      chunks.set(chunkKey(cx, cy), rec);
      fillChunkTerrain(chunks, cx, cy, worldSeed >>> 0, perm);
    }
  }

  const minX = extent.minCX * CHUNK_SIZE;
  const maxX = (extent.maxCX + 1) * CHUNK_SIZE - 1;
  const minY = extent.minCY * CHUNK_SIZE;
  const maxY = (extent.maxCY + 1) * CHUNK_SIZE - 1;
  const homeX = Math.floor((minX + maxX) / 2);
  const homeY = Math.floor((minY + maxY) / 2);

  fillDisk(chunks, homeX, homeY, 13);

  const halfW = 4;
  const halfH = 2;
  const doorX = homeX;
  const doorY = homeY - halfH;
  const fountainCX = homeX;
  const fountainCY = homeY - 7;
  const crossingX = homeX;
  const crossingY = homeY - 20;
  const spawnX = fountainCX;
  const spawnY = fountainCY + 2;
  const northWalkY = homeY - halfH - 1;
  const southWalkY = homeY + halfH + 1;
  const westWalkX = homeX - halfW - 1;
  const eastWalkX = homeX + halfW + 1;
  const fenceY = homeY + 5;
  const gateX = homeX + 1;
  const gateY = fenceY;
  const farmX0 = homeX - 4;
  const farmX1 = homeX + 4;
  const farmY0 = homeY + 6;
  const farmY1 = homeY + 18;

  // Clear spawn area before building the house so the disk doesn't overwrite walls/door
  fillDisk(chunks, spawnX, spawnY, 2);
  setWorldTile(chunks, spawnX, spawnY, TILE_GRASS);

  for (let y = homeY - halfH; y <= homeY + halfH; y++) {
    for (let x = homeX - halfW; x <= homeX + halfW; x++) {
      const border = x === homeX - halfW || x === homeX + halfW || y === homeY - halfH || y === homeY + halfH;
      setStructureTile(chunks, x, y, border ? TILE_WALL : TILE_FLOOR, true);
    }
  }

  setStructureTile(chunks, doorX, doorY, TILE_DOOR, true);

  // Settlement walkways: a simple ring around the house plus a front path to the farm gate.
  carvePath(chunks, westWalkX, northWalkY, eastWalkX, northWalkY);
  carvePath(chunks, westWalkX, southWalkY, eastWalkX, southWalkY);
  carvePath(chunks, westWalkX, northWalkY, westWalkX, southWalkY);
  carvePath(chunks, eastWalkX, northWalkY, eastWalkX, southWalkY);
  carvePath(chunks, doorX, southWalkY, gateX, gateY - 1);

  // Keep the original east-side staircase anchor for nearby plaza layout.
  const houseStairAnchorX = eastWalkX + 1;
  const houseStairAnchorY = homeY + 2;

  // Pond — ellipse with Perlin wobble, northwest of the house
  const pondCX = homeX - 24;
  const pondCY = homeY + 18;
  const pondRX = 3;
  const pondRY = 2.5;
  const pondWobble = 0.35;
  const pondFreq = 0.5;
  for (let py = Math.floor(pondCY - pondRY - 2); py <= pondCY + pondRY + 2; py++) {
    for (let px = Math.floor(pondCX - pondRX - 2); px <= pondCX + pondRX + 2; px++) {
      const dx = (px - pondCX) / pondRX;
      const dy = (py - pondCY) / pondRY;
      const dist = dx * dx + dy * dy;
      const n = perlin2((px + 5000) * pondFreq, (py + 5000) * pondFreq, perm);
      const edge = 1.0 + n * pondWobble;
      if (dist >= edge) continue;
      const cur = getWorldTile(chunks, px, py);
      if (cur !== TILE_GRASS && cur !== TILE_GRASS_A
       && cur !== TILE_GRASS_C && cur !== TILE_GRASS_D) continue;
      setWorldTile(chunks, px, py, dist < edge * 0.55 ? TILE_WATER : TILE_SHALLOW_WATER);
    }
  }

  // Home interactables
  addSpawn(chunks, homeX - 2, homeY, "home_bed");
  addSpawn(chunks, homeX + 2, homeY, "home_chest");
  // Alchemy bench moved to the apothecary building (see below).
  addSpawn(chunks, homeX + 3, homeY + 1, "cooking_fire");
  addSpawn(chunks, westWalkX - 1, southWalkY, "home_sign");
  // Furnace and anvil moved to the smithy building (see below).

  // Harvest nodes around the clearing
  const berrySpots = [
    { x: homeX + 11, y: homeY - 4 },
    { x: homeX + 8, y: homeY + 7 },
    { x: homeX - 10, y: homeY + 5 },
    { x: homeX - 12, y: homeY - 2 },
  ];
  const herbSpots = [
    { x: homeX + 6, y: homeY - 9 },
    { x: homeX - 7, y: homeY - 8 },
    { x: homeX + 12, y: homeY + 2 },
    { x: homeX - 5, y: homeY + 9 },
  ];
  const thornSpots = [
    { x: homeX + 28, y: homeY - 18 },
    { x: homeX - 31, y: homeY + 16 },
    { x: homeX + 24, y: homeY + 27 },
  ];
  const venomSpots = [
    { x: homeX + 30, y: homeY - 26 },
    { x: homeX - 27, y: homeY - 24 },
    { x: homeX - 22, y: homeY + 29 },
  ];
  const moonleafSpots = [
    { x: homeX + 18, y: homeY - 14 },
    { x: homeX - 19, y: homeY + 12 },
    { x: homeX + 14, y: homeY + 18 },
  ];
  const emberRootSpots = [
    { x: homeX + 24, y: homeY - 8 },
    { x: homeX - 23, y: homeY - 17 },
    { x: homeX - 16, y: homeY + 23 },
  ];

  function _impassable(/** @type {number | undefined} */ t) {
    return t === TILE_WATER || t === TILE_WATER_DEEP
        || t === TILE_MOUNTAIN || t === TILE_MOUNTAIN_B || t === TILE_MOUNTAIN_C
        || t === TILE_TREE;
  }

  // Spiral search from (hintX, hintY) for the nearest mountain tile within maxR.
  function findMountainSpot(/** @type {number} */ hintX, /** @type {number} */ hintY, /** @type {number} */ maxR) {
    for (let r = 0; r <= maxR; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // perimeter only
          const t = getWorldTile(chunks, hintX + dx, hintY + dy);
          if (t === TILE_MOUNTAIN || t === TILE_MOUNTAIN_B || t === TILE_MOUNTAIN_C) {
            return { x: hintX + dx, y: hintY + dy };
          }
        }
      }
    }
    return null;
  }

  // Mining nodes — placed well afield (28–48 tiles from home)
  const ironSpots = [
    { x: homeX + 35, y: homeY - 22 },  // NE
    { x: homeX - 33, y: homeY + 27 },  // SW
    { x: homeX + 26, y: homeY + 38 },  // SE
  ];
  const coalSpots = [
    { x: homeX - 42, y: homeY - 18 },  // NW
    { x: homeX + 44, y: homeY + 15 },  // E
    { x: homeX - 20, y: homeY - 44 },  // N
  ];
  const stoneSpots = [
    { x: homeX + 28, y: homeY - 32 },  // NE
    { x: homeX - 36, y: homeY + 30 },  // SW
  ];

  for (const p of ironSpots) {
    const m = findMountainSpot(p.x, p.y, 14);
    const pos = m ?? p;
    setWorldTile(chunks, pos.x, pos.y, TILE_GRASS);
    addSpawn(chunks, pos.x, pos.y, "harvest_iron_ore");
  }
  for (const p of coalSpots) {
    const m = findMountainSpot(p.x, p.y, 14);
    const pos = m ?? p;
    setWorldTile(chunks, pos.x, pos.y, TILE_GRASS);
    addSpawn(chunks, pos.x, pos.y, "harvest_coal_ore");
  }
  for (const p of stoneSpots) {
    const m = findMountainSpot(p.x, p.y, 14);
    const pos = m ?? p;
    setWorldTile(chunks, pos.x, pos.y, TILE_GRASS);
    addSpawn(chunks, pos.x, pos.y, "harvest_stone");
  }

  // ── Fence line south of house yard ──────────────────────────────
  for (let fx = farmX0; fx <= farmX1; fx++) {
    setWorldTile(chunks, fx, fenceY, TILE_FENCE);
  }
  // Gate tile so the opening reads as an actual entrance rather than a missing fence segment.
  setWorldTile(chunks, gateX, gateY, TILE_DOOR);

  // ── Farm plot — tilled soil south of the fence ────────────────
  for (let fy = farmY0; fy <= farmY1; fy++) {
    for (let fx = farmX0; fx <= farmX1; fx++) {
      setWorldTile(chunks, fx, fy, TILE_FARMLAND);
    }
  }
  // Crop columns: vertical strips (rotated 90° from original rows) with 2-tile spacing.
  // 4 columns × 6 rows = 24 crops to feed the whole town.
  const cropCols = [
    { x: homeX - 3, kind: "crop_wheat" },
    { x: homeX - 1, kind: "crop_carrot" },
    { x: homeX + 1, kind: "crop_corn" },
    { x: homeX + 3, kind: "crop_wheat" },
  ];
  for (const col of cropCols) {
    for (let fy = homeY + 7; fy <= homeY + 17; fy += 2) {
      addSpawn(chunks, col.x, fy, col.kind);
    }
  }
  addSpawn(chunks, homeX, homeY + 10, "scarecrow");
  addSpawn(chunks, homeX, homeY + 14, "scarecrow");

  // ── Farm chickens — a small flock pecking around the crops ────
  addSpawn(chunks, homeX - 2, homeY + 8,  "farm_animal", { name: "Rooster", identity: "chicken_rooster", maxHp: 5, massKg: 3 });
  addSpawn(chunks, homeX + 2, homeY + 9,  "farm_animal", { name: "Hen", identity: "chicken_hen" });
  addSpawn(chunks, homeX - 1, homeY + 12, "farm_animal", { name: "Hen", identity: "chicken_hen" });
  addSpawn(chunks, homeX + 3, homeY + 13, "farm_animal", { name: "Hen", identity: "chicken_hen" });
  addSpawn(chunks, homeX + 1, homeY + 16, "farm_animal", { name: "Chick", identity: "chick", maxHp: 2, massKg: 0.5 });
  addSpawn(chunks, homeX + 2, homeY + 16, "farm_animal", { name: "Chick", identity: "chick", maxHp: 2, massKg: 0.5 });

  // ── Well plaza — east of the dungeon entrance ────────────────
  // A cobblestone courtyard with a walkable well and short path from staircase.
  const wellX = houseStairAnchorX + 5;
  const wellY = houseStairAnchorY;
  // Cobblestone path from stair to plaza entrance
  for (let wx = houseStairAnchorX + 1; wx <= wellX - 2; wx++) {
    setWorldTile(chunks, wx, wellY, TILE_COBBLESTONE);
  }
  // 3×3 cobblestone plaza centered on well
  for (let wy = wellY - 1; wy <= wellY + 1; wy++) {
    for (let wx = wellX - 1; wx <= wellX + 1; wx++) {
      setWorldTile(chunks, wx, wy, TILE_COBBLESTONE);
    }
  }
  // Flower beds north and south of plaza
  addSpawn(chunks, wellX - 1, wellY - 2, "flower_rose");
  addSpawn(chunks, wellX,     wellY - 2, "flower_bluebell");
  addSpawn(chunks, wellX + 1, wellY - 2, "flower_rose");
  addSpawn(chunks, wellX - 1, wellY + 2, "flower_tulip");
  addSpawn(chunks, wellX,     wellY + 2, "flower_daisy");
  addSpawn(chunks, wellX + 1, wellY + 2, "flower_tulip");
  addSpawn(chunks, wellX + 2, wellY - 1, "flower_sunflower");
  addSpawn(chunks, wellX + 2, wellY + 1, "flower_sunflower");
  // Well in plaza center
  addSpawn(chunks, wellX, wellY, "well");

  // ── Tavern — broader rectangle so the roof posts, bar, and seating read cleanly ──
  const tavX0 = homeX + 6;
  const tavY0 = homeY - 10;
  const tavFloorCells = [];
  for (let ty = tavY0 + 1; ty <= tavY0 + 5; ty++) {
    for (let tx = tavX0 + 1; tx <= tavX0 + 7; tx++) {
      tavFloorCells.push({ x: tx, y: ty });
    }
  }
  const tavDoorX = tavX0;
  const tavDoorY = tavY0 + 3;
  paintStructure(chunks, tavFloorCells, { x: tavDoorX, y: tavDoorY });
  carvePath(chunks, eastWalkX, tavDoorY, eastWalkX, northWalkY);
  // Interior layout:
  //   o ═ ═ ═ ═ . .     keg + long bar along the north wall
  //   . . . . . . .     standing room behind the benches
  //   . □ . . . □ .     paired roof posts with a center aisle
  //   ▭ ▭ . . . ▭ ▭     benches facing the bar
  //   . . . . . . .     open run to the centered door
  addSpawn(chunks, tavX0 + 1, tavY0 + 1, "tavern_keg");
  addSpawn(chunks, tavX0 + 5, tavY0 + 1, "tavern_table");
  addSpawn(chunks, tavX0 + 3, tavY0 + 1, "tavern_table");
  addSpawn(chunks, tavX0 + 4, tavY0 + 1, "tavern_table");
  addSpawn(chunks, tavX0 + 6, tavY0 + 1, "tavern_table");
  addSpawn(chunks, tavX0 + 2, tavY0 + 3, "tavern_pillar");
  addSpawn(chunks, tavX0 + 6, tavY0 + 3, "tavern_pillar");
  addSpawn(chunks, tavX0 + 1, tavY0 + 4, "tavern_bench");
  addSpawn(chunks, tavX0 + 2, tavY0 + 4, "tavern_bench");
  addSpawn(chunks, tavX0 + 5, tavY0 + 4, "tavern_bench");
  addSpawn(chunks, tavX0 + 6, tavY0 + 4, "tavern_bench");
  addSpawn(chunks, tavX0 + 7, tavY0 + 2, "tavern_chest");
  addSpawn(chunks, tavX0 + 7, tavY0 + 4, "cooking_fire");
  addSpawn(chunks, tavDoorX - 1, tavDoorY - 1, "tavern_sign");
  // Dungeon entrance — cellar hatch in the tavern's open south row
  const stairX = tavX0 + 4;
  const stairY = tavY0 + 5;
  setWorldTile(chunks, stairX, stairY, TILE_STAIR_DOWN);
  setRoofed(stairX, stairY, true);

  // ── Windmill — west of the graveyard, outside of town ──
  const millX0 = crossingX - 10;
  const millY0 = crossingY - 13;
  const millX1 = millX0 + 4;
  const millY1 = millY0 + 4;
  fillDisk(chunks, millX0 + 2, millY0 + 2, 4);
  for (let my = millY0; my <= millY1; my++) {
    for (let mx = millX0; mx <= millX1; mx++) {
      const border = mx === millX0 || mx === millX1 || my === millY0 || my === millY1;
      setStructureTile(chunks, mx, my, border ? TILE_WALL : TILE_FLOOR, true);
    }
  }
  const millDoorX = millX0 + 2;
  setStructureTile(chunks, millDoorX, millY1, TILE_DOOR, true);
  carvePath(chunks, millDoorX, millY1 + 1, millDoorX, northWalkY);
  carvePath(chunks, millDoorX, northWalkY, westWalkX, northWalkY);
  // Interior
  addSpawn(chunks, millX0 + 2, millY0 + 2, "millstone");
  addSpawn(chunks, millX0 + 1, millY0 + 2, "mill_chest");

  // ── The Smithy — stamped from JSON building definition ──
  // Anchor (keystone) offset so fenced yard clears the mill to the north.
  const smithyAnchorX = homeX - 7;
  const smithyAnchorY = homeY;
  const smithyResult = stampBuilding(chunks, smithyDef, smithyAnchorX, smithyAnchorY);
  // Extend cobblestone from building edge to the western walkway
  for (let px = smithyAnchorX + 1; px <= westWalkX; px++) {
    setWorldTile(chunks, px, smithyAnchorY, TILE_COBBLESTONE);
  }
  const smithyFurnace = smithyResult.spawns.furnace || { x: smithyAnchorX - 9, y: smithyAnchorY + 2 };
  const smithyAnvil = smithyResult.spawns.anvil || { x: smithyAnchorX - 9, y: smithyAnchorY - 1 };
  const smithyLumberDrop = smithyResult.waypoints?.deliver_lumber || smithyResult.spawns.lumber_chest || { x: smithyFurnace.x + 1, y: smithyFurnace.y + 1 };
  const smithyOreDrop = smithyResult.waypoints?.deliver_ore || smithyResult.spawns.smithy_chest || { x: smithyFurnace.x + 1, y: smithyFurnace.y - 1 };

  // Small ore outcrop near the smithy so the miner has a short commute.
  const nearOreX = smithyAnchorX - 10;
  const nearOreY = smithyAnchorY + 9;
  fillDisk(chunks, nearOreX, nearOreY, 2);
  addSpawn(chunks, nearOreX, nearOreY, "harvest_iron_ore");
  addSpawn(chunks, nearOreX + 1, nearOreY, "harvest_coal_ore");
  addSpawn(chunks, nearOreX - 1, nearOreY, "harvest_iron_ore");

  // Stand of trees next to the ore outcrop for the woodcutter.
  const nearTreeX = nearOreX;
  const nearTreeY = nearOreY + 3;
  fillDisk(chunks, nearTreeX, nearTreeY, 3);
  for (let tx = nearTreeX - 1; tx <= nearTreeX + 1; tx++) {
    for (let ty = nearTreeY - 1; ty <= nearTreeY + 1; ty++) {
      if (tx === nearTreeX && ty === nearTreeY) continue;   // center walkable
      if (tx === nearTreeX && ty === nearTreeY - 1) continue; // north entrance
      addSpawn(chunks, tx, ty, "tree_node");
    }
  }

  // Path from smithy area down to the ore/tree work area.
  carvePath(chunks, nearOreX, smithyAnchorY + 7, nearOreX, nearOreY);

  // ── The Apothecary — stamped from JSON building definition ───────────────────────────
  const apothX0 = homeX - 29;
  const apothY0 = homeY - 12;
  fillDisk(chunks, apothX0 + 5, apothY0 + 3, 8);
  const apothDoorX = apothX0 + 5;
  const apothDoorY = apothY0 + 5;
  const apothResult = stampBuilding(chunks, apothecaryDef, apothDoorX, apothDoorY);
  const apothDoor = apothResult.shop?.door || apothResult.waypoints?.shop_door || { x: apothDoorX, y: apothDoorY };
  const apothVendorWork = apothResult.shop?.work || apothResult.waypoints?.vendor_work || { x: apothX0 + 2, y: apothY0 + 2 };
  const apothShopRoom = apothResult.shop?.room || apothResult.rooms?.shop || { x: apothX0, y: apothY0, w: 10, h: 6 };
  // Path from door south to walkway level, then east to the western walkway.
  carvePath(chunks, apothDoor.x, apothDoor.y + 1, apothDoor.x, northWalkY);
  carvePath(chunks, apothDoor.x, northWalkY, westWalkX, northWalkY);
  // Dangerous plant garden — offset from the doorway so it does not clog the shopfront.
  const gardenX = apothX0 + 12;
  const gardenY = apothY0 + 1;
  const poisonGarden = new Set([
    `${gardenX},${gardenY}`,
    `${gardenX + 1},${gardenY}`,
    `${gardenX},${gardenY + 1}`,
    `${gardenX + 1},${gardenY + 1}`,
  ]);
  for (let gy = gardenY; gy <= gardenY + 1; gy++) {
    for (let gx = gardenX; gx <= gardenX + 1; gx++) {
      setWorldTile(chunks, gx, gy, TILE_GRASS);
    }
  }
  addSpawn(chunks, gardenX, gardenY, "harvest_thorn_bramble");
  addSpawn(chunks, gardenX + 1, gardenY, "harvest_venom_fern");
  addSpawn(chunks, gardenX, gardenY + 1, "harvest_venom_fern");
  addSpawn(chunks, gardenX + 1, gardenY + 1, "harvest_thorn_bramble");

  // ── Church — stamped from JSON building definition ─────────────
  fillDisk(chunks, crossingX, crossingY, 8);
  const churchResult = stampBuilding(chunks, churchDef, crossingX, crossingY);
  const churchDoorX = crossingX;
  const churchDoorY = crossingY + 7;
  // Path from south door to fountain plaza / walkway
  carvePath(chunks, churchDoorX, churchDoorY + 1, churchDoorX, northWalkY);

  // ── Graveyard — fenced enclosure behind (north of) the church ──
  const gyX0 = crossingX - 4;
  const gyX1 = crossingX + 4;
  const gyY0 = crossingY - 14;
  const gyY1 = crossingY - 8;
  const gyGateX = crossingX;
  const gyGateY = gyY1;
  // Clear terrain beyond the church grass disk
  fillDisk(chunks, crossingX, crossingY - 11, 5);
  // Fence perimeter
  for (let gx = gyX0; gx <= gyX1; gx++) {
    setWorldTile(chunks, gx, gyY0, TILE_FENCE);
    setWorldTile(chunks, gx, gyY1, TILE_FENCE);
  }
  for (let gy = gyY0; gy <= gyY1; gy++) {
    setWorldTile(chunks, gyX0, gy, TILE_FENCE);
    setWorldTile(chunks, gyX1, gy, TILE_FENCE);
  }
  // Gate opening on south face
  setWorldTile(chunks, gyGateX, gyGateY, TILE_DOOR);
  // Interior cobblestone floor
  for (let gy = gyY0 + 1; gy < gyY1; gy++) {
    for (let gx = gyX0 + 1; gx < gyX1; gx++) {
      setWorldTile(chunks, gx, gy, TILE_COBBLESTONE);
    }
  }
  // Crypt entrance — second dungeon stair
  setWorldTile(chunks, crossingX, crossingY - 12, TILE_STAIR_DOWN);
  // Decorative tombstones — south row
  addSpawn(chunks, crossingX - 2, crossingY - 10, "grave_tombstone");
  addSpawn(chunks, crossingX,     crossingY - 10, "grave_tombstone");
  addSpawn(chunks, crossingX + 2, crossingY - 10, "grave_tombstone");
  // North row flanking the crypt stair
  addSpawn(chunks, crossingX - 2, crossingY - 12, "grave_tombstone");
  addSpawn(chunks, crossingX + 2, crossingY - 12, "grave_tombstone");
  // Cobblestone path from graveyard gate to church north wall
  for (let py = crossingY - 7; py <= crossingY - 5; py++) {
    setWorldTile(chunks, crossingX, py, TILE_COBBLESTONE);
  }

  // ── Town square — cobblestone plaza with fountain, trees, and benches ────────
  const sqX0 = fountainCX - 1;
  const sqX1 = fountainCX + 1;
  const sqY0 = fountainCY - 1;
  const sqY1 = fountainCY + 1;
  for (let fy = sqY0; fy <= sqY1; fy++) {
    for (let fx = sqX0; fx <= sqX1; fx++) {
      setWorldTile(chunks, fx, fy, TILE_COBBLESTONE);
    }
  }
  addSpawn(chunks, fountainCX, fountainCY, "fountain");
  addSpawn(chunks, fountainCX - 3, fountainCY + 1, "message_board");
  // Corner trees
  addSpawn(chunks, sqX0 - 3, sqY0 - 3, "tree_node");
  addSpawn(chunks, sqX1 + 3, sqY0 - 3, "tree_node");
  addSpawn(chunks, sqX0 - 3, sqY1 + 3, "tree_node");
  addSpawn(chunks, sqX1 + 3, sqY1 + 3, "tree_node");
  // Benches along the sides
  addSpawn(chunks, fountainCX - 2, sqY0 + 1, "bench");
  addSpawn(chunks, fountainCX + 2, sqY0 + 1, "bench");
  addSpawn(chunks, fountainCX - 2, sqY1 - 1, "bench");
  addSpawn(chunks, fountainCX + 2, sqY1 - 1, "bench");


  // ── Worker cottages — actual homes for the town to sleep in ─────────────
  const farmerHouse = buildCottage(chunks, homeX + 8, homeY + 10, "north");
  carvePath(chunks, farmerHouse.doorX, farmerHouse.doorY - 1, eastWalkX, southWalkY);

  // Smith + miner sleep at the smithy (beds placed via JSON building definition).
  const smithyBeds = smithyResult.allSpawns?.home_bed || [];
  const smithBed = smithyBeds[0] || { x: smithyAnchorX - 8, y: smithyAnchorY + 1 };
  const minerBed = smithyBeds[1] || smithBed;
  const smithHome = smithyResult.waypoints?.home || { x: smithBed.x + 1, y: smithBed.y };
  const minerHome = smithyResult.waypoints?.miner_home || { x: minerBed.x + 1, y: minerBed.y };

  const masonHouse = buildCottage(chunks, homeX + 23, homeY - 5, "south");
  carvePath(chunks, masonHouse.doorX, masonHouse.doorY + 1, eastWalkX, homeY - 1);

  const villagerHouse = buildCottage(chunks, homeX + 16, homeY + 4, "north");
  carvePath(chunks, villagerHouse.doorX, villagerHouse.doorY - 1, eastWalkX, southWalkY);

  const barkeepHouse = buildCottage(chunks, tavX0 + 12, tavY0 + 1, "south");
  carvePathVerticalFirst(chunks, barkeepHouse.doorX, barkeepHouse.doorY + 1, eastWalkX, tavDoorY);
  setStructureTile(chunks, tavDoorX, tavDoorY, TILE_DOOR, true);

  const priestHouse = buildCottage(chunks, crossingX - 15, crossingY - 1, "south");
  carvePath(chunks, priestHouse.doorX, priestHouse.doorY + 1, priestHouse.doorX, northWalkY);
  carvePath(chunks, priestHouse.doorX, northWalkY, westWalkX, northWalkY);

  // Small quarry route close enough that the miner visibly commutes from town.
  const mineWorkX = homeX + 18;
  const mineWorkY = homeY - 20;
  fillDisk(chunks, mineWorkX, mineWorkY, 3);
  carvePath(chunks, eastWalkX, northWalkY, mineWorkX, mineWorkY + 2);
  addSpawn(chunks, mineWorkX, mineWorkY, "harvest_stone");
  addSpawn(chunks, mineWorkX + 1, mineWorkY - 1, "harvest_iron_ore");
  addSpawn(chunks, mineWorkX - 1, mineWorkY + 1, "harvest_coal_ore");
  addSpawn(chunks, mineWorkX + 2, mineWorkY, "harvest_stone");
  addSpawn(chunks, mineWorkX - 1, mineWorkY - 1, "harvest_iron_ore");

  // Woodcutter sleeps at the smithy (bed placed via JSON building definition).
  const woodcutterBed = smithyBeds[2] || minerBed;
  const woodcutterHome = smithyResult.waypoints?.woodcutter_home || { x: woodcutterBed.x + 1, y: woodcutterBed.y };

  const herbalistDoorX = apothX0 - 2;
  const herbalistDoorY = apothY0 - 4;
  const herbalistResult = stampBuilding(chunks, herbalistHutDef, herbalistDoorX, herbalistDoorY);
  const herbalistDoor = herbalistResult.waypoints?.front_door || { x: herbalistDoorX, y: herbalistDoorY };
  const herbalistHome = herbalistResult.waypoints?.resident_home || { x: herbalistDoorX, y: herbalistDoorY - 2 };
  const herbalistBed = herbalistResult.spawns?.home_bed || { x: herbalistDoorX - 2, y: herbalistDoorY - 4 };
  const herbalistWork = herbalistResult.waypoints?.herb_work || { x: herbalistDoorX + 1, y: herbalistDoorY - 3 };
  carvePathVerticalFirst(chunks, herbalistDoor.x, herbalistDoor.y + 1, apothDoorX - 2, apothDoorY + 1);

  const alchemistHouse = buildCottage(chunks, apothX0 + 8, apothY0 - 8, "south");
  carvePathVerticalFirst(chunks, alchemistHouse.doorX, alchemistHouse.doorY + 1, apothDoorX + 3, apothDoorY + 1);

  // ── Gem Shop — stamped from JSON building definition ─────────────────────────────────
  const gemAnchorX = apothX0 - 13;
  const gemAnchorY = apothY0 + 5;
  fillDisk(chunks, gemAnchorX, gemAnchorY - 3, 6);
  const gemResult = stampBuilding(chunks, gemStoreDef, gemAnchorX, gemAnchorY);
  const gemDoor = gemResult.shop?.door || gemResult.waypoints?.shop_door || { x: gemAnchorX, y: gemAnchorY };
  const gemVendorWork = gemResult.shop?.work || gemResult.waypoints?.vendor_work || { x: gemAnchorX - 1, y: gemAnchorY - 3 };
  const gemShopRoom = gemResult.shop?.room || gemResult.rooms?.shop || { x: gemAnchorX - 3, y: gemAnchorY - 5, w: 8, h: 6 };
  carvePath(chunks, gemDoor.x, gemDoor.y + 1, gemDoor.x, northWalkY);
  carvePath(chunks, gemDoor.x, northWalkY, apothDoorX, northWalkY);

  const gemVendorHouse = buildCottage(chunks, gemShopRoom.x - 4, gemShopRoom.y - 8, "south");
  carvePathVerticalFirst(chunks, gemVendorHouse.doorX, gemVendorHouse.doorY + 1, gemDoor.x, gemDoor.y + 1);

  // ── Book Shop — stamped from JSON building definition ──────────────────────────────
  const bookAnchorX = homeX + 12;
  const bookAnchorY = homeY - 14;
  fillDisk(chunks, bookAnchorX, bookAnchorY - 3, 6);
  const bookResult = stampBuilding(chunks, bookShopDef, bookAnchorX, bookAnchorY);
  const bookDoor = bookResult.shop?.door || bookResult.waypoints?.shop_door || { x: bookAnchorX, y: bookAnchorY };
  const bookVendorWork = bookResult.shop?.work || bookResult.waypoints?.vendor_work || { x: bookAnchorX - 1, y: bookAnchorY - 3 };
  const bookShopRoom = bookResult.shop?.room || bookResult.rooms?.shop || { x: bookAnchorX - 3, y: bookAnchorY - 5, w: 8, h: 6 };
  const bookBed = bookResult.spawns?.home_bed || { x: bookAnchorX + 3, y: bookAnchorY - 1 };
  // Path from door south to east walkway, then west to walkway ring
  carvePath(chunks, bookDoor.x, bookDoor.y + 1, bookDoor.x, northWalkY);
  carvePath(chunks, bookDoor.x, northWalkY, eastWalkX, northWalkY);


  // Natural harvestables are placed after all structures so they cannot end up in walls or on paths.
  for (const p of berrySpots) {
    if (_impassable(getWorldTile(chunks, p.x, p.y))) setWorldTile(chunks, p.x, p.y, TILE_GRASS);
    addOutdoorSpawn(chunks, p, "harvest_berries");
  }
  for (const p of herbSpots) {
    if (_impassable(getWorldTile(chunks, p.x, p.y))) setWorldTile(chunks, p.x, p.y, TILE_GRASS);
    addOutdoorSpawn(chunks, p, "harvest_herbs");
  }
  for (const p of thornSpots) {
    if (_impassable(getWorldTile(chunks, p.x, p.y))) setWorldTile(chunks, p.x, p.y, TILE_GRASS);
    addOutdoorSpawn(chunks, p, "harvest_thorn_bramble", (x, y) => {
      if (poisonGarden.has(`${x},${y}`)) return true;
      return chebyshevScalar(x, y, homeX, homeY) >= 20;
    });
  }
  for (const p of venomSpots) {
    if (_impassable(getWorldTile(chunks, p.x, p.y))) setWorldTile(chunks, p.x, p.y, TILE_GRASS);
    addOutdoorSpawn(chunks, p, "harvest_venom_fern", (x, y) => {
      if (poisonGarden.has(`${x},${y}`)) return true;
      return chebyshevScalar(x, y, homeX, homeY) >= 20;
    });
  }
  for (const p of moonleafSpots) {
    if (_impassable(getWorldTile(chunks, p.x, p.y))) setWorldTile(chunks, p.x, p.y, TILE_GRASS);
    addOutdoorSpawn(chunks, p, "harvest_moonleaf");
  }
  for (const p of emberRootSpots) {
    if (_impassable(getWorldTile(chunks, p.x, p.y))) setWorldTile(chunks, p.x, p.y, TILE_GRASS);
    addOutdoorSpawn(chunks, p, "harvest_ember_root", (x, y) => {
      return chebyshevScalar(x, y, homeX, homeY) >= 14;
    });
  }

  // ── NPC Townspeople ────────────────────────────────────────────
  addSpawn(chunks, farmerHouse.standX, farmerHouse.standY, "townfolk", {
    townfolkId: "farmer",
    scheduleEnabled: true,
    homeX: farmerHouse.standX, homeY: farmerHouse.standY,
    bedX: farmerHouse.sleepX, bedY: farmerHouse.sleepY,
    workX: homeX + 1, workY: homeY + 11,
    workAuxX: millX0 + 2, workAuxY: millY0 + 2,
    pubX: tavX0 + 2, pubY: tavY0 + 4,
    deliverX: millX0 + 1, deliverY: millY0 + 2,
  });
  addSpawn(chunks, woodcutterHome.x, woodcutterHome.y, "townfolk", {
    townfolkId: "woodcutter",
    scheduleEnabled: true,
    homeX: woodcutterHome.x, homeY: woodcutterHome.y,
    bedX: woodcutterBed.x, bedY: woodcutterBed.y,
    workX: nearTreeX, workY: nearTreeY,
    workAuxX: homeX - 21, workAuxY: homeY - 10,
    pubX: tavX0 + 1, pubY: tavY0 + 4,
    deliverX: smithyLumberDrop.x, deliverY: smithyLumberDrop.y,
  });
  addSpawn(chunks, minerHome.x, minerHome.y, "townfolk", {
    townfolkId: "miner",
    scheduleEnabled: true,
    homeX: minerHome.x, homeY: minerHome.y,
    bedX: minerBed.x, bedY: minerBed.y,
    workX: nearOreX, workY: nearOreY,
    workAuxX: mineWorkX + 1, workAuxY: mineWorkY - 1,
    pubX: tavX0 + 6, pubY: tavY0 + 4,
    deliverX: smithyOreDrop.x, deliverY: smithyOreDrop.y,
  });
  addSpawn(chunks, smithHome.x, smithHome.y, "townfolk", {
    townfolkId: "smith",
    scheduleEnabled: true,
    homeX: smithHome.x, homeY: smithHome.y,
    bedX: smithBed.x, bedY: smithBed.y,
    workX: smithyFurnace.x + 1, workY: smithyFurnace.y,
    workAuxX: smithyAnvil.x, workAuxY: smithyAnvil.y,
    pubX: tavX0 + 5, pubY: tavY0 + 4,
  });
  addSpawn(chunks, priestHouse.standX, priestHouse.standY, "townfolk", {
    townfolkId: "priest",
    scheduleEnabled: true,
    homeX: priestHouse.standX, homeY: priestHouse.standY,
    bedX: priestHouse.sleepX, bedY: priestHouse.sleepY,
    workX: crossingX, workY: crossingY,
    workAuxX: crossingX, workAuxY: crossingY - 3,
    pubX: tavX0 + 4, pubY: tavY0 + 4,
  });
  addSpawn(chunks, barkeepHouse.standX, barkeepHouse.standY, "townfolk", {
    townfolkId: "barkeep",
    scheduleEnabled: true,
    homeX: barkeepHouse.standX, homeY: barkeepHouse.standY,
    bedX: barkeepHouse.sleepX, bedY: barkeepHouse.sleepY,
    workX: tavX0 + 4, workY: tavY0 + 2,
    workAuxX: tavX0 + 2, workAuxY: tavY0 + 1,
    pubX: tavX0 + 3, pubY: tavY0 + 4,
  });
  addSpawn(chunks, villagerHouse.standX, villagerHouse.standY, "townfolk", {
    townfolkId: "villager",
    scheduleEnabled: true,
    homeX: villagerHouse.standX, homeY: villagerHouse.standY,
    bedX: villagerHouse.sleepX, bedY: villagerHouse.sleepY,
    workX: fountainCX + 1, workY: fountainCY + 1,
    workAuxX: homeX - 3, workAuxY: southWalkY + 1,
    pubX: tavX0 + 6, pubY: tavY0 + 2,
  });
  addSpawn(chunks, masonHouse.standX, masonHouse.standY, "townfolk", {
    townfolkId: "mason",
    scheduleEnabled: true,
    homeX: masonHouse.standX, homeY: masonHouse.standY,
    bedX: masonHouse.sleepX, bedY: masonHouse.sleepY,
    workX: fountainCX + 1, workY: fountainCY + 1,
    workAuxX: churchDoorX, workAuxY: northWalkY,
    pubX: tavX0 + 1, pubY: tavY0 + 2,
  });
  addSpawn(chunks, herbalistHome.x, herbalistHome.y, "townfolk", {
    townfolkId: "herbalist",
    scheduleEnabled: true,
    homeX: herbalistHome.x, homeY: herbalistHome.y,
    bedX: herbalistBed.x, bedY: herbalistBed.y,
    workX: gardenX, workY: gardenY,
    workAuxX: herbalistWork.x, workAuxY: herbalistWork.y,
    pubX: tavX0 + 3, pubY: tavY0 + 2,
    deliverX: herbalistWork.x, deliverY: herbalistWork.y,
  });
  addSpawn(chunks, alchemistHouse.standX, alchemistHouse.standY, "townfolk", {
    townfolkId: apothResult.shop?.vendorRole || "alchemist",
    scheduleEnabled: true,
    homeX: alchemistHouse.standX, homeY: alchemistHouse.standY,
    bedX: alchemistHouse.sleepX, bedY: alchemistHouse.sleepY,
    workX: apothVendorWork.x, workY: apothVendorWork.y,
    workAuxX: apothX0 + 4, workAuxY: apothY0 + 2,
    pubX: tavX0 + 7, pubY: tavY0 + 2,
    shopRoom: { x: apothShopRoom.x, y: apothShopRoom.y, w: apothShopRoom.w, h: apothShopRoom.h },
    shopDoor: { x: apothDoor.x, y: apothDoor.y },
  });
  addSpawn(chunks, gemVendorHouse.standX, gemVendorHouse.standY, "townfolk", {
    townfolkId: gemResult.shop?.vendorRole || "gem_vendor",
    scheduleEnabled: true,
    homeX: gemVendorHouse.standX, homeY: gemVendorHouse.standY,
    bedX: gemVendorHouse.sleepX, bedY: gemVendorHouse.sleepY,
    workX: gemVendorWork.x, workY: gemVendorWork.y,
    pubX: tavX0 + 5, pubY: tavY0 + 2,
    shopRoom: { x: gemShopRoom.x, y: gemShopRoom.y, w: gemShopRoom.w, h: gemShopRoom.h },
    shopDoor: { x: gemDoor.x, y: gemDoor.y },
  });
  // Book vendor — lives and sleeps in the shop
  addSpawn(chunks, bookVendorWork.x, bookVendorWork.y, "townfolk", {
    townfolkId: bookResult.shop?.vendorRole || "book_vendor",
    scheduleEnabled: true,
    homeX: bookBed.x, homeY: bookBed.y,
    bedX: bookBed.x, bedY: bookBed.y,
    workX: bookVendorWork.x, workY: bookVendorWork.y,
    pubX: tavX0 + 4, pubY: tavY0 + 2,
    shopRoom: { x: bookShopRoom.x, y: bookShopRoom.y, w: bookShopRoom.w, h: bookShopRoom.h },
    shopDoor: { x: bookDoor.x, y: bookDoor.y },
  });

  const outChunks = [];
  for (const rec of chunks.values()) {
    outChunks.push({
      chunkX: rec.chunkX,
      chunkY: rec.chunkY,
      depth: 0,
      seed: worldSeed >>> 0,
      tiles: rec.tiles,
      rooms: [],
      doors: [],
      spawns: rec.spawns,
    });
  }

  return { extent, chunks: outChunks, spawnX, spawnY };
}
