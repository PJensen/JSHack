const TILE_MAP_KEY = Symbol.for("jshack.tilemap");

export const TILE_WALKABLE = 1 << 0;
export const TILE_OPAQUE = 1 << 1;

function createTileMap(width, height, originX, originY) {
  const w = Math.max(1, width | 0);
  const h = Math.max(1, height | 0);
  return {
    width: w,
    height: h,
    originX: originX | 0,
    originY: originY | 0,
    cells: new Uint8Array(w * h),
    version: 0,
  };
}

export function ensureTileMap(world, opts = {}) {
  if (!world) throw new Error("World is required");
  const width = Math.max(1, opts.width | 0);
  const height = Math.max(1, opts.height | 0);
  const originX = Number.isFinite(opts.originX) ? opts.originX | 0 : 0;
  const originY = Number.isFinite(opts.originY) ? opts.originY | 0 : 0;
  let map = world[TILE_MAP_KEY];
  if (!map || map.width !== width || map.height !== height || map.originX !== originX || map.originY !== originY) {
    map = createTileMap(width, height, originX, originY);
    world[TILE_MAP_KEY] = map;
  }
  return map;
}

export function getTileMap(world) {
  return world ? world[TILE_MAP_KEY] || null : null;
}

function indexFor(map, x, y) {
  if (!map) return -1;
  const col = x - map.originX;
  const row = y - map.originY;
  if (col < 0 || col >= map.width || row < 0 || row >= map.height) return -1;
  return row * map.width + col;
}

export function clearTileMap(map, fillMask = 0) {
  if (!map) return;
  map.cells.fill(fillMask & 0xff);
  map.version = (map.version + 1) | 0;
}

export function setTile(map, x, y, { walkable = false, opaque = true } = {}) {
  if (!map) return false;
  const idx = indexFor(map, x, y);
  if (idx < 0) return false;
  let mask = 0;
  if (walkable) mask |= TILE_WALKABLE;
  if (opaque) mask |= TILE_OPAQUE;
  map.cells[idx] = mask;
  map.version = (map.version + 1) | 0;
  return true;
}

export function setTileWalkable(map, x, y, walkable) {
  if (!map) return false;
  const idx = indexFor(map, x, y);
  if (idx < 0) return false;
  let mask = map.cells[idx];
  if (walkable) mask |= TILE_WALKABLE; else mask &= ~TILE_WALKABLE;
  map.cells[idx] = mask;
  map.version = (map.version + 1) | 0;
  return true;
}

export function setTileOpaque(map, x, y, opaque) {
  if (!map) return false;
  const idx = indexFor(map, x, y);
  if (idx < 0) return false;
  let mask = map.cells[idx];
  if (opaque) mask |= TILE_OPAQUE; else mask &= ~TILE_OPAQUE;
  map.cells[idx] = mask;
  map.version = (map.version + 1) | 0;
  return true;
}

export function getTileMask(map, x, y) {
  if (!map) return 0;
  const idx = indexFor(map, x, y);
  if (idx < 0) return 0;
  return map.cells[idx] || 0;
}

export function isTileWalkable(map, x, y) {
  return !!(getTileMask(map, x, y) & TILE_WALKABLE);
}

export function isTileOpaque(map, x, y) {
  return !!(getTileMask(map, x, y) & TILE_OPAQUE);
}

export function tileKey(x, y) {
  return `${x},${y}`;
}

export function forEachTile(map, fn) {
  if (!map || typeof fn !== "function") return;
  const { width, height, originX, originY, cells } = map;
  let idx = 0;
  for (let row = 0; row < height; row++) {
    const y = originY + row;
    for (let col = 0; col < width; col++, idx++) {
      const x = originX + col;
      fn(x, y, cells[idx] || 0);
    }
  }
}

export function getTileBounds(map) {
  if (!map) return null;
  return {
    minX: map.originX,
    minY: map.originY,
    maxX: map.originX + map.width - 1,
    maxY: map.originY + map.height - 1,
  };
}
