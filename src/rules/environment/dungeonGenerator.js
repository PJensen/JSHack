// rules/environment/dungeonGenerator.js
// Simple tile-array dungeon generator. Integer grid only.

import { createFrom } from '../../lib/ecs-js/archetype.js';
import { FloorTile, WallTile } from '../archetypes/Tiles.js';
import { Door } from '../archetypes/Door.js';
import { bresenhamLine } from '../../shared/math/bresenham.js';

/**
 * Generate a multi-room dungeon using integer tile entities.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {{ width?:number, height?:number, corridorLen?:number, seed?:number }} [opts]
 * @returns {{ rooms: Array<{key:string, cx:number, cy:number, w:number, h:number}>,
 *             corridors: Array<{from:{x:number,y:number}, to:{x:number,y:number}}>,
 *             doors: Array<{x:number, y:number}>,
 *             spawnPoints: Array<{x:number, y:number}> }}
 */
export function generateDungeon(world, opts = {}) {
  const rw = Math.max(5, opts.width || 11);
  const rh = Math.max(5, opts.height || 11);
  const corridorLen = Math.max(3, opts.corridorLen || 5);

  // Simple seeded RNG (if no seed, use world.seed or 1)
  let s = ((opts.seed ?? world.seed ?? 1) >>> 0) || 1;
  function rng() {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  }
  function rngRange(min, max) {
    return min + Math.floor(rng() * (max - min + 1));
  }

  /** @type {Map<string, 'floor'|'wall'|'door'>} */
  const tiles = new Map();
  function k(x, y) { return `${x},${y}`; }

  // Carve a rectangular room (floor inside, walls on perimeter)
  function carveRoom(cx, cy, w, h) {
    const x0 = cx - Math.floor(w / 2);
    const y0 = cy - Math.floor(h / 2);
    for (let y = y0 - 1; y <= y0 + h; y++) {
      for (let x = x0 - 1; x <= x0 + w; x++) {
        const key = k(x, y);
        const isEdge = (x === x0 - 1 || x === x0 + w || y === y0 - 1 || y === y0 + h);
        if (isEdge) {
          if (!tiles.has(key)) tiles.set(key, 'wall');
        } else {
          tiles.set(key, 'floor'); // floor overwrites walls (corridors punch through)
        }
      }
    }
  }

  // Carve a 1-wide corridor between two points using Bresenham
  function carveCorridor(x0, y0, x1, y1) {
    // First go horizontal, then vertical (L-shaped corridor)
    const midX = x1;
    const midY = y0;

    carveLine(x0, y0, midX, midY);
    carveLine(midX, midY, x1, y1);
  }

  function carveLine(x0, y0, x1, y1) {
    // Set start tile as floor
    setFloor(x0, y0);
    for (const [x, y] of bresenhamLine(x0, y0, x1, y1)) {
      setFloor(x, y);
      // Add walls on both sides perpendicular to corridor direction
      if (x0 === x1) {
        // Vertical corridor: walls left and right
        if (!tiles.has(k(x - 1, y)) || tiles.get(k(x - 1, y)) === 'wall') tiles.set(k(x - 1, y), 'wall');
        if (!tiles.has(k(x + 1, y)) || tiles.get(k(x + 1, y)) === 'wall') tiles.set(k(x + 1, y), 'wall');
      } else {
        // Horizontal corridor: walls above and below
        if (!tiles.has(k(x, y - 1)) || tiles.get(k(x, y - 1)) === 'wall') tiles.set(k(x, y - 1), 'wall');
        if (!tiles.has(k(x, y + 1)) || tiles.get(k(x, y + 1)) === 'wall') tiles.set(k(x, y + 1), 'wall');
      }
    }
  }

  function setFloor(x, y) {
    tiles.set(k(x, y), 'floor');
  }

  // --- Layout ---

  const rooms = [];
  const corridors = [];
  const doors = [];

  // Main room at origin
  carveRoom(0, 0, rw, rh);
  rooms.push({ key: 'main', cx: 0, cy: 0, w: rw, h: rh });

  // Direction offsets for adjacent rooms (east, north, south)
  const halfW = Math.floor(rw / 2);
  const halfH = Math.floor(rh / 2);

  const adjacentDirs = [
    { key: 'east',  dx: 1, dy: 0 },
    { key: 'north', dx: 0, dy: -1 },
    { key: 'south', dx: 0, dy: 1 },
  ];

  for (const dir of adjacentDirs) {
    const adjW = rngRange(5, Math.max(5, rw - 2));
    const adjH = rngRange(5, Math.max(5, rh - 2));
    const adjHalfW = Math.floor(adjW / 2);
    const adjHalfH = Math.floor(adjH / 2);

    let adjCx, adjCy;
    let corrFromX, corrFromY, corrToX, corrToY;

    if (dir.dx !== 0) {
      // Horizontal: room to the east or west
      adjCx = dir.dx * (halfW + corridorLen + adjHalfW + 1);
      adjCy = rngRange(-2, 2);
      // Main room wall facing corridor (east wall = rw - halfW, west wall = -(halfW+1))
      corrFromX = dir.dx > 0 ? (rw - halfW) : -(halfW + 1);
      corrFromY = 0;
      // Adjacent room wall facing main (west wall = cx-halfW-1, east wall = cx+adjW-halfW)
      corrToX = dir.dx > 0 ? (adjCx - adjHalfW - 1) : (adjCx + adjW - adjHalfW);
      corrToY = adjCy;
    } else {
      // Vertical: room to the north or south
      adjCx = rngRange(-2, 2);
      adjCy = dir.dy * (halfH + corridorLen + adjHalfH + 1);
      corrFromX = 0;
      // Main room wall facing corridor (south wall = rh - halfH, north wall = -(halfH+1))
      corrFromY = dir.dy > 0 ? (rh - halfH) : -(halfH + 1);
      corrToX = adjCx;
      // Adjacent room wall facing main (north wall = cy-halfH-1, south wall = cy+adjH-halfH)
      corrToY = dir.dy > 0 ? (adjCy - adjHalfH - 1) : (adjCy + adjH - adjHalfH);
    }

    carveRoom(adjCx, adjCy, adjW, adjH);
    rooms.push({ key: dir.key, cx: adjCx, cy: adjCy, w: adjW, h: adjH });

    carveCorridor(corrFromX, corrFromY, corrToX, corrToY);
    corridors.push({ from: { x: corrFromX, y: corrFromY }, to: { x: corrToX, y: corrToY } });

    // Place doors at corridor start and end
    doors.push({ x: corrFromX, y: corrFromY });
    doors.push({ x: corrToX, y: corrToY });
  }

  // --- Create entities ---

  for (const [key, type] of tiles) {
    const [x, y] = key.split(',').map(Number);
    if (type === 'floor') {
      createFrom(world, FloorTile, { x, y });
    } else if (type === 'wall') {
      createFrom(world, WallTile, { x, y });
    }
  }

  // Place door entities at corridor junctions
  const doorSet = new Set();
  for (const d of doors) {
    const dk = k(d.x, d.y);
    if (doorSet.has(dk)) continue;
    doorSet.add(dk);
    createFrom(world, Door, { x: d.x, y: d.y });
  }

  // Spawn points: center of each room
  const spawnPoints = rooms.map(r => ({ x: r.cx, y: r.cy }));

  return { rooms, corridors, doors, spawnPoints };
}
