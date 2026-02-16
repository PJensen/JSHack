// rules/environment/dungeon/overworld.js
// Deterministic depth-0 overworld generation (Perlin/fBM terrain + home clearing).

import { createRng } from "../../../lib/ecs-js/rng.js";
import {
  CHUNK_SIZE,
  TILE_FLOOR,
  TILE_WALL,
  TILE_DOOR,
  TILE_STAIR_DOWN,
  TILE_GRASS,
  TILE_WATER,
  TILE_MOUNTAIN,
  TILE_TREE,
} from "./constants.js";

export const OVERWORLD_EXTENT = Object.freeze({
  minCX: -2,
  maxCX: 2,
  minCY: -2,
  maxCY: 2,
});

function chunkKey(cx, cy) { return `${cx},${cy}`; }

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }

function grad(hash, x, y) {
  const h = hash & 7;
  switch (h) {
    case 0: return x + y;
    case 1: return -x + y;
    case 2: return x - y;
    case 3: return -x - y;
    case 4: return x;
    case 5: return -x;
    case 6: return y;
    default: return -y;
  }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {Uint8Array} perm
 */
function perlin2(x, y, perm) {
  const xi0 = Math.floor(x) & 255;
  const yi0 = Math.floor(y) & 255;
  const xi1 = (xi0 + 1) & 255;
  const yi1 = (yi0 + 1) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);
  const aa = perm[perm[xi0] + yi0];
  const ab = perm[perm[xi0] + yi1];
  const ba = perm[perm[xi1] + yi0];
  const bb = perm[perm[xi1] + yi1];
  const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
  const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
  const out = lerp(x1, x2, v);
  return Math.max(-1, Math.min(1, out));
}

/**
 * @param {number} seed
 */
function buildPermutation(seed) {
  const rng = createRng((seed ^ 0x9e3779b1) >>> 0);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (rng.next() * (i + 1)) | 0;
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {Uint8Array} perm
 * @param {{scale:number,oct:number,persist:number,lacun:number}} cfg
 */
function fbm01(x, y, perm, cfg) {
  let amp = 1;
  let freq = cfg.scale;
  let sum = 0;
  let ampSum = 0;
  for (let i = 0; i < cfg.oct; i++) {
    sum += amp * perlin2(x * freq, y * freq, perm);
    ampSum += amp;
    amp *= cfg.persist;
    freq *= cfg.lacun;
  }
  const norm = sum / (ampSum || 1);
  return 0.5 * (norm + 1);
}

/**
 * @param {Map<string, { chunkX:number, chunkY:number, tiles:Uint8Array, spawns:any[] }>} chunks
 * @param {number} x
 * @param {number} y
 * @param {number} tile
 */
function setWorldTile(chunks, x, y, tile) {
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

      let tile = TILE_GRASS;
      if (elev < 0.30) {
        tile = TILE_WATER;
      } else if (ridge > 0.68) {
        tile = TILE_MOUNTAIN;
      } else if (moist > 0.62 && elev >= 0.24 && elev <= 0.75) {
        tile = TILE_TREE;
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
 * @param {Map<string, { chunkX:number, chunkY:number, tiles:Uint8Array, spawns:any[] }>} chunks
 * @param {number} x
 * @param {number} y
 * @param {string} kind
 * @param {Record<string, any>} [params]
 */
function addSpawn(chunks, x, y, kind, params = {}) {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  const chunk = chunks.get(chunkKey(cx, cy));
  if (!chunk) return;
  chunk.spawns.push({ x, y, kind, params });
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

  const halfW = 5;
  const halfH = 3;
  const doorX = homeX;
  const doorY = homeY + halfH;
  const spawnX = doorX;
  const spawnY = doorY + 1;

  // Clear spawn area before building the house so the disk doesn't overwrite walls/door
  fillDisk(chunks, spawnX, spawnY, 2);
  setWorldTile(chunks, spawnX, spawnY, TILE_GRASS);

  for (let y = homeY - halfH; y <= homeY + halfH; y++) {
    for (let x = homeX - halfW; x <= homeX + halfW; x++) {
      const border = x === homeX - halfW || x === homeX + halfW || y === homeY - halfH || y === homeY + halfH;
      setWorldTile(chunks, x, y, border ? TILE_WALL : TILE_FLOOR);
    }
  }

  setWorldTile(chunks, doorX, doorY, TILE_DOOR);

  const stairX = homeX + 8;
  const stairY = homeY + 1;
  carvePath(chunks, doorX, doorY + 1, stairX, stairY);
  setWorldTile(chunks, stairX, stairY, TILE_STAIR_DOWN);

  // Home interactables
  addSpawn(chunks, homeX - 2, homeY, "home_bed");
  addSpawn(chunks, homeX + 2, homeY, "home_chest");
  addSpawn(chunks, homeX - 3, doorY + 2, "home_sign");

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

  for (const p of berrySpots) {
    const t = getWorldTile(chunks, p.x, p.y);
    if (t === TILE_WATER || t === TILE_MOUNTAIN) setWorldTile(chunks, p.x, p.y, TILE_GRASS);
    addSpawn(chunks, p.x, p.y, "harvest_berries");
  }
  for (const p of herbSpots) {
    const t = getWorldTile(chunks, p.x, p.y);
    if (t === TILE_WATER || t === TILE_MOUNTAIN) setWorldTile(chunks, p.x, p.y, TILE_GRASS);
    addSpawn(chunks, p.x, p.y, "harvest_herbs");
  }

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
