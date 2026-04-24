// rules/environment/dungeon/overworld.js
// Deterministic depth-0 overworld generation (Perlin/fBM terrain + home clearing).

import { perlin2, buildPermutation, fbm01 } from "./generators/noise.js";
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
  TILE_BEACH,
  TILE_MARSH,
  TILE_SWAMP,
  TILE_BOG,
  TILE_SAND_DUNES,
  TILE_MUD,
  TILE_TIDAL_FLAT,
  TILE_ROCKY_SHORE,
  TILE_KELP_FOREST,
  TILE_SALT_MARSH,
  TILE_SHINGLE,
  TILE_SEAGRASS,
  TILE_MOORLAND,
  TILE_SCRUBLAND,
  TILE_BADLANDS,
  TILE_GRAVEL,
  TILE_PINE_FOREST,
  TILE_PALM_FOREST,
  TILE_MANGROVE,
  TILE_CORAL_REEF,
} from "./constants.js";

export const OVERWORLD_EXTENT = Object.freeze({
  minCX: -3,
  maxCX: 3,
  minCY: -3,
  maxCY: 3,
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
 * Force irregular ocean at map edges using Perlin noise.
 * Creates natural-looking jagged coastlines on all boundaries.
 * @param {Map<string, { chunkX:number, chunkY:number, tiles:Uint8Array, spawns:any[] }>} chunks
 * @param {number} minX
 * @param {number} maxX
 * @param {number} minY
 * @param {number} maxY
 * @param {Uint8Array} perm
 */
function forceEdgeOcean(chunks, minX, maxX, minY, maxY, worldSeed, perm) {
  const baseThickness = 4;
  const wobbleFreq = 0.15;
  const wobbleAmp = 3;

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      const distFromLeft = x - minX;
      const distFromRight = maxX - x;
      const distFromTop = y - minY;
      const distFromBottom = maxY - y;

      // Perlin wobble on each edge for irregularity
      const leftWobble = perlin2((y + 1000) * wobbleFreq, 0, perm) * wobbleAmp;
      const rightWobble = perlin2((y + 2000) * wobbleFreq, 0, perm) * wobbleAmp;
      const topWobble = perlin2((x + 3000) * wobbleFreq, 0, perm) * wobbleAmp;
      const bottomWobble = perlin2((x + 4000) * wobbleFreq, 0, perm) * wobbleAmp;

      const leftThresh = baseThickness + leftWobble;
      const rightThresh = baseThickness + rightWobble;
      const topThresh = baseThickness + topWobble;
      const bottomThresh = baseThickness + bottomWobble;

      if (distFromLeft < leftThresh || distFromRight < rightThresh ||
          distFromTop < topThresh || distFromBottom < bottomThresh) {
        setWorldTile(chunks, x, y, TILE_WATER_DEEP);
      }
    }
  }
}

/**
 * Generate diverse overworld terrain with multiple biomes.
 * Elevation determines base terrain; moisture adds forests, marshes, swamps.
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
      const gv = (perlin2((wx + 2000) * 0.28, (wy + 3000) * 0.28, perm) + 1) * 0.5;

      // WATER ZONES
      if (elev < 0.18) {
        // Deep ocean
        tile = moist > 0.70 ? TILE_KELP_FOREST : TILE_WATER_DEEP;
      }
      else if (elev < 0.26) {
        // Shallow water + variants
        tile = moist > 0.80 ? TILE_SEAGRASS : TILE_WATER;
      }
      // COASTAL ZONES (highly varied)
      else if (elev < 0.32) {
        if (ridge > 0.55) tile = TILE_ROCKY_SHORE;
        else if (moist > 0.75) tile = TILE_TIDAL_FLAT;
        else if (moist > 0.70) tile = TILE_MUD;
        else tile = TILE_SHINGLE;
      }
      // BEACH ZONE (make very visible)
      else if (elev < 0.40) {
        if (moist > 0.65) tile = TILE_SALT_MARSH;
        else if (gv > 0.7) tile = TILE_SHINGLE;
        else tile = TILE_BEACH;
      }
      // MOUNTAINS
      else if (ridge > 0.78) {
        tile = TILE_MOUNTAIN_C;
      } else if (ridge > 0.65) {
        tile = TILE_MOUNTAIN_B;
      } else if (ridge > 0.54) {
        tile = TILE_MOUNTAIN;
      }
      // DESERT/DUNES (make prominent)
      else if (moist < 0.30 && elev >= 0.40 && elev <= 0.70) {
        tile = gv > 0.6 ? TILE_BADLANDS : TILE_SAND_DUNES;
      }
      // WETLANDS (sparse, not dominant)
      else if (moist > 0.85 && elev >= 0.40 && elev <= 0.55) {
        tile = TILE_BOG;
      }
      else if (moist > 0.78 && elev >= 0.42 && elev <= 0.58) {
        tile = TILE_SWAMP;
      }
      else if (moist > 0.70 && elev >= 0.44 && elev <= 0.60) {
        tile = TILE_MARSH;
      }
      // MANGROVE: coastal forest transition
      else if (moist > 0.65 && elev >= 0.38 && elev <= 0.50) {
        tile = TILE_MANGROVE;
      }
      // FORESTS (varied types)
      else if (moist > 0.60 && elev >= 0.50 && elev <= 0.75) {
        if (elev > 0.65) tile = TILE_PINE_FOREST;
        else if (moist > 0.75) tile = TILE_PALM_FOREST;
        else tile = TILE_TREE;
      }
      // MOORLAND & SCRUBLAND (arid grassland variants)
      else if (moist < 0.50 && elev >= 0.48 && elev <= 0.68) {
        tile = moist < 0.35 ? TILE_SCRUBLAND : TILE_MOORLAND;
      }
      // DEFAULT GRASSLANDS with texture
      else {
        if (gv < 0.20) tile = TILE_GRASS_A;
        else if (gv < 0.45) tile = TILE_GRASS;
        else if (gv < 0.70) tile = TILE_GRASS_C;
        else if (gv < 0.90) tile = TILE_GRASS_D;
        else tile = TILE_GRAVEL;
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

  // Force irregular ocean at all map edges using Perlin wobble + rivers
  forceEdgeOcean(chunks, minX, maxX, minY, maxY, worldSeed >>> 0, perm);

  // Default spawn point at center of overworld
  const homeX = Math.floor((minX + maxX) / 2);
  const homeY = Math.floor((minY + maxY) / 2);
  const spawnX = homeX;
  const spawnY = homeY;

  // TODO: Procedural building placement system
  // - Scan terrain for placement heuristics (fishing by water, miners by mountains, etc.)
  // - Use building stamps from buildingRegistry
  // - Handle building rotation/facing
  // - Generate path network from keystones

  // [NUKED: all hard-coded building placement, paths, NPCs, decorations removed]
  // Building placement will be procedural from here forward.

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
