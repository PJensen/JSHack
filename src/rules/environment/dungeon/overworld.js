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
} from "./constants.js";

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

function xyKey(x, y) {
  return `${x},${y}`;
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
    setWorldTile(chunks, cell.x, cell.y, TILE_FLOOR);
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
    setWorldTile(chunks, x, y, TILE_WALL);
  }
  setWorldTile(chunks, door.x, door.y, TILE_DOOR);
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
function findOutdoorSpawnTile(chunks, hintX, hintY, maxR = 10) {
  for (let r = 0; r <= maxR; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = hintX + dx;
        const y = hintY + dy;
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
function addOutdoorSpawn(chunks, pos, kind) {
  const target = findOutdoorSpawnTile(chunks, pos.x, pos.y, 10) ?? pos;
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
  const doorY = homeY + halfH;
  const spawnX = doorX;
  const spawnY = doorY + 1;
  const northWalkY = homeY - halfH - 1;
  const southWalkY = spawnY;
  const westWalkX = homeX - halfW - 1;
  const eastWalkX = homeX + halfW + 1;
  const fenceY = homeY + 5;
  const gateX = homeX + 1;
  const gateY = fenceY;
  const farmX0 = homeX - 2;
  const farmX1 = homeX + 4;
  const farmY0 = homeY + 6;
  const farmY1 = homeY + 11;

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

  // Settlement walkways: a simple ring around the house plus a front path to the farm gate.
  carvePath(chunks, westWalkX, northWalkY, eastWalkX, northWalkY);
  carvePath(chunks, westWalkX, southWalkY, eastWalkX, southWalkY);
  carvePath(chunks, westWalkX, northWalkY, westWalkX, southWalkY);
  carvePath(chunks, eastWalkX, northWalkY, eastWalkX, southWalkY);
  carvePath(chunks, doorX, southWalkY, gateX, gateY - 1);

  // Keep the first dungeon entrance visibly beside the player house on open ground.
  const stairX = eastWalkX + 1;
  const stairY = homeY + 2;
  carvePath(chunks, eastWalkX, southWalkY, stairX, stairY);
  setWorldTile(chunks, stairX, stairY, TILE_STAIR_DOWN);

  // Pond — ellipse with Perlin wobble, northwest of the house
  const pondCX = homeX - 12;
  const pondCY = homeY + 6;
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
  addSpawn(chunks, homeX, homeY - 1, "alchemy_bench");
  addSpawn(chunks, homeX + 3, homeY + 1, "cooking_fire");
  addSpawn(chunks, westWalkX - 1, southWalkY, "home_sign");
  // Outside crafting & fire
  // setWorldTile(chunks, homeX + 10, homeY + 5, TILE_GRASS);
  // addSpawn(chunks, homeX + 10, homeY + 5, "anvil");
  setWorldTile(chunks, homeX - 6, homeY + 7, TILE_GRASS);
  addSpawn(chunks, homeX - 6, homeY + 7, "furnace");

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
    { x: homeX + 14, y: homeY - 1 },
    { x: homeX - 13, y: homeY + 1 },
    { x: homeX + 4, y: homeY + 12 },
  ];
  const venomSpots = [
    { x: homeX + 10, y: homeY - 10 },
    { x: homeX - 9, y: homeY - 11 },
    { x: homeX - 2, y: homeY + 13 },
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
  // Crop rows: tidy three-by-three planting grid with empty aisles between rows/columns.
  for (let fx = homeX - 1; fx <= homeX + 3; fx += 2) {
    addSpawn(chunks, fx, homeY + 7, "crop_wheat");
  }
  for (let fx = homeX - 1; fx <= homeX + 3; fx += 2) {
    addSpawn(chunks, fx, homeY + 9, "crop_turnip");
  }
  for (let fx = homeX - 1; fx <= homeX + 3; fx += 2) {
    addSpawn(chunks, fx, homeY + 11, "crop_pumpkin");
  }
  addSpawn(chunks, homeX + 1, homeY + 8, "scarecrow");

  // ── Well — south-west of house ────────────────────────────────
  addSpawn(chunks, homeX - 3, southWalkY + 1, "well");

  // ── Tavern — broader rectangle so the roof posts, bar, and seating read cleanly ──
  const tavX0 = homeX + 6;
  const tavY0 = homeY - 10;
  const tavFloorCells = [];
  for (let ty = tavY0 + 1; ty <= tavY0 + 5; ty++) {
    for (let tx = tavX0 + 1; tx <= tavX0 + 7; tx++) {
      tavFloorCells.push({ x: tx, y: ty });
    }
  }
  const tavDoorX = tavX0 + 4;
  const tavDoorY = tavY0 + 6;
  paintStructure(chunks, tavFloorCells, { x: tavDoorX, y: tavDoorY });
  carvePath(chunks, tavDoorX, tavDoorY + 1, eastWalkX, northWalkY);
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
  addSpawn(chunks, tavDoorX + 1, tavDoorY, "tavern_sign");

  // ── Windmill — slightly larger square so the millstone is not jammed into the shell ──
  const millX0 = homeX - 10;
  const millY0 = homeY - 8;
  const millX1 = homeX - 6;
  const millY1 = homeY - 4;
  for (let my = millY0; my <= millY1; my++) {
    for (let mx = millX0; mx <= millX1; mx++) {
      const border = mx === millX0 || mx === millX1 || my === millY0 || my === millY1;
      setWorldTile(chunks, mx, my, border ? TILE_WALL : TILE_FLOOR);
    }
  }
  const millDoorX = millX0 + 2;
  setWorldTile(chunks, millDoorX, millY1, TILE_DOOR);
  carvePath(chunks, millDoorX, millY1 + 1, westWalkX, northWalkY);
  // Interior
  addSpawn(chunks, millX0 + 2, millY0 + 2, "millstone");

  // ── Church — small chapel north of house ─────────────────────
  // Clear terrain for the church (sits outside the main clearing disk)
  fillDisk(chunks, homeX, homeY - 13, 5);
  const churchX0 = homeX - 3;
  const churchY0 = homeY - 16;
  // Interior: 5 wide × 5 tall → building 7 × 7
  const churchFloorCells = [];
  for (let cy = churchY0 + 1; cy <= churchY0 + 5; cy++) {
    for (let cx = churchX0 + 1; cx <= churchX0 + 5; cx++) {
      churchFloorCells.push({ x: cx, y: cy });
    }
  }
  const churchDoorX = churchX0 + 3;
  const churchDoorY = churchY0 + 6;
  paintStructure(chunks, churchFloorCells, { x: churchDoorX, y: churchDoorY });
  carvePath(chunks, churchDoorX, churchDoorY + 1, churchDoorX, northWalkY);
  // Interior: altar + candles at north, pew rows in the nave
  addSpawn(chunks, churchX0 + 3, churchY0 + 1, "church_altar");
  addSpawn(chunks, churchX0 + 2, churchY0 + 1, "torch");
  addSpawn(chunks, churchX0 + 4, churchY0 + 1, "torch");
  addSpawn(chunks, churchX0 + 2, churchY0 + 3, "church_pew");
  addSpawn(chunks, churchX0 + 4, churchY0 + 3, "church_pew");
  addSpawn(chunks, churchX0 + 2, churchY0 + 4, "church_pew");
  addSpawn(chunks, churchX0 + 4, churchY0 + 4, "church_pew");
  addSpawn(chunks, churchDoorX + 1, churchDoorY + 1, "church_sign");

  // ── Fountain plaza — cobblestone square with fountain ────────
  // Placed on the church-to-walkway path, north of house
  const fountainCX = homeX;
  const fountainCY = homeY - 6;
  for (let fy = fountainCY - 2; fy <= fountainCY + 2; fy++) {
    for (let fx = fountainCX - 2; fx <= fountainCX + 2; fx++) {
      setWorldTile(chunks, fx, fy, TILE_COBBLESTONE);
    }
  }
  addSpawn(chunks, fountainCX, fountainCY, "fountain");

  // ── Garden — colorful flowers east of house ─────────────────
  const gardenCX = homeX + 9;
  const gardenCY = homeY + 7;
  const flowerKinds = [
    "flower_rose", "flower_sunflower", "flower_tulip",
    "flower_daisy", "flower_bluebell",
  ];
  let flowerIdx = 0;
  for (let gy = gardenCY - 2; gy <= gardenCY + 1; gy++) {
    for (let gx = gardenCX - 2; gx <= gardenCX + 2; gx++) {
      setWorldTile(chunks, gx, gy, TILE_GRASS);
      // Checkerboard pattern — flowers on even parity, gaps on odd
      if ((gx + gy) % 2 === 0) {
        addSpawn(chunks, gx, gy, flowerKinds[flowerIdx % flowerKinds.length]);
        flowerIdx++;
      }
    }
  }
  // Short path connecting garden to the house-side stair spur.
  carvePath(chunks, gardenCX, gardenCY - 3, stairX + 1, southWalkY);

  // ── Worker cottages — actual homes for the town to sleep in ─────────────
  const farmerHouse = buildCottage(chunks, homeX + 6, homeY + 8, "north");
  carvePath(chunks, farmerHouse.doorX, farmerHouse.doorY - 1, eastWalkX, southWalkY);

  const smithHouse = buildCottage(chunks, homeX - 12, homeY + 8, "north");
  carvePath(chunks, smithHouse.doorX, smithHouse.doorY - 1, westWalkX, southWalkY);

  const masonHouse = buildCottage(chunks, homeX + 11, homeY - 2, "south");
  carvePath(chunks, masonHouse.doorX, masonHouse.doorY + 1, eastWalkX, homeY - 1);

  const villagerHouse = buildCottage(chunks, homeX + 11, homeY + 2, "north");
  carvePath(chunks, villagerHouse.doorX, villagerHouse.doorY - 1, eastWalkX, southWalkY);

  const barkeepHouse = buildCottage(chunks, tavX0 + 9, tavY0 + 1, "south");
  carvePath(chunks, barkeepHouse.doorX, barkeepHouse.doorY + 1, tavDoorX + 3, tavDoorY + 1);

  const priestHouse = buildCottage(chunks, churchX0 - 7, churchY0 + 1, "south");
  carvePath(chunks, priestHouse.doorX, priestHouse.doorY + 1, churchDoorX - 4, northWalkY);

  const woodcutterHouse = buildCottage(chunks, homeX - 17, homeY - 4, "south");
  carvePath(chunks, woodcutterHouse.doorX, woodcutterHouse.doorY + 1, westWalkX, homeY - 2);

  const minerHouse = buildCottage(chunks, homeX + 15, homeY - 15, "south");
  carvePath(chunks, minerHouse.doorX, minerHouse.doorY + 1, eastWalkX, northWalkY);

  // Small quarry route close enough that the miner visibly commutes from town.
  const mineWorkX = homeX + 18;
  const mineWorkY = homeY - 20;
  fillDisk(chunks, mineWorkX, mineWorkY, 3);
  carvePath(chunks, eastWalkX, northWalkY, mineWorkX, mineWorkY + 2);
  addSpawn(chunks, mineWorkX, mineWorkY, "harvest_stone");
  addSpawn(chunks, mineWorkX + 1, mineWorkY - 1, "harvest_iron_ore");

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
    addOutdoorSpawn(chunks, p, "harvest_thorn_bramble");
  }
  for (const p of venomSpots) {
    if (_impassable(getWorldTile(chunks, p.x, p.y))) setWorldTile(chunks, p.x, p.y, TILE_GRASS);
    addOutdoorSpawn(chunks, p, "harvest_venom_fern");
  }

  // ── NPC Townspeople ────────────────────────────────────────────
  addSpawn(chunks, farmerHouse.standX, farmerHouse.standY, "townfolk", {
    townfolkId: "farmer",
    scheduleEnabled: true,
    homeX: farmerHouse.standX, homeY: farmerHouse.standY,
    bedX: farmerHouse.sleepX, bedY: farmerHouse.sleepY,
    workX: homeX + 1, workY: homeY + 8,
    workAuxX: millX0 + 2, workAuxY: millY0 + 2,
    pubX: tavX0 + 2, pubY: tavY0 + 4,
  });
  addSpawn(chunks, woodcutterHouse.standX, woodcutterHouse.standY, "townfolk", {
    townfolkId: "woodcutter",
    scheduleEnabled: true,
    homeX: woodcutterHouse.standX, homeY: woodcutterHouse.standY,
    bedX: woodcutterHouse.sleepX, bedY: woodcutterHouse.sleepY,
    workX: homeX - 18, workY: homeY - 6,
    workAuxX: homeX - 21, workAuxY: homeY - 10,
    pubX: tavX0 + 1, pubY: tavY0 + 4,
  });
  addSpawn(chunks, minerHouse.standX, minerHouse.standY, "townfolk", {
    townfolkId: "miner",
    scheduleEnabled: true,
    homeX: minerHouse.standX, homeY: minerHouse.standY,
    bedX: minerHouse.sleepX, bedY: minerHouse.sleepY,
    workX: mineWorkX, workY: mineWorkY + 1,
    workAuxX: mineWorkX + 1, workAuxY: mineWorkY - 1,
    pubX: tavX0 + 6, pubY: tavY0 + 4,
  });
  addSpawn(chunks, smithHouse.standX, smithHouse.standY, "townfolk", {
    townfolkId: "smith",
    scheduleEnabled: true,
    homeX: smithHouse.standX, homeY: smithHouse.standY,
    bedX: smithHouse.sleepX, bedY: smithHouse.sleepY,
    workX: homeX - 5, workY: homeY + 8,
    workAuxX: homeX - 6, workAuxY: homeY + 7,
    pubX: tavX0 + 5, pubY: tavY0 + 4,
  });
  addSpawn(chunks, priestHouse.standX, priestHouse.standY, "townfolk", {
    townfolkId: "priest",
    scheduleEnabled: true,
    homeX: priestHouse.standX, homeY: priestHouse.standY,
    bedX: priestHouse.sleepX, bedY: priestHouse.sleepY,
    workX: churchX0 + 3, workY: churchY0 + 3,
    workAuxX: churchX0 + 3, workAuxY: churchY0 + 1,
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
    workX: gardenCX, workY: gardenCY,
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
