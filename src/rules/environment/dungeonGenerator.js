import { createFrom } from "../../lib/ecs-js/archetype.js";
import { ensureGeometryKernel } from "./worldGeometry.js";
import { ensureTileMap, clearTileMap, setTile, isTileWalkable, forEachTile, TILE_WALKABLE } from "./tileMap.js";
import { Dungeon } from "../components/Dungeon.js";
import { DungeonGeometry } from "../components/DungeonGeometry.js";
import { FloorTile, WallTile } from "../archetypes/Tiles.js";

const DUNGEON_ENTITY_KEY = Symbol.for("jshack.dungeon.entity");
const TILE_ENTITIES_KEY = Symbol.for("jshack.dungeon.tiles");

function ensureDungeonEntity(world, opts = {}) {
  if (!world[DUNGEON_ENTITY_KEY]) {
    const id = world.create();
    world[DUNGEON_ENTITY_KEY] = id;
    const level = Number.isFinite(opts.level) ? opts.level : 1;
    const dungeonId = opts.id ?? "demo";
    const name = opts.name ?? "Demo Dungeon";
    world.add(id, Dungeon, { level, id: dungeonId, name });
  }
  return world[DUNGEON_ENTITY_KEY];
}

function buildRoomMeta(width, height) {
  const w = Math.max(2, Number(width) || 0);
  const h = Math.max(2, Number(height) || 0);
  const halfW = w * 0.5;
  const halfH = h * 0.5;
  const originX = -Math.floor(w / 2);
  const originY = -Math.floor(h / 2);
  const center = { x: 0, y: 0 };
  return {
    shape: "rect-room",
    width: w,
    height: h,
    halfWidth: halfW,
    halfHeight: halfH,
    origin: { x: originX, y: originY },
    center,
  };
}

function rebuildTileEntities(world, tileMap) {
  const prev = world[TILE_ENTITIES_KEY];
  if (Array.isArray(prev)) {
    for (let i = 0; i < prev.length; i++) {
      const id = prev[i];
      if (Number.isInteger(id) && world.isAlive?.(id)) {
        try { world.destroy(id); } catch {}
      }
    }
  }

  const ids = [];
  forEachTile(tileMap, (x, y, mask) => {
    const tpl = (mask & TILE_WALKABLE) ? FloorTile : WallTile;
    const ent = createFrom(world, tpl, { x, y });
    ids.push(ent);
  });
  world[TILE_ENTITIES_KEY] = ids;
}

function carveFloorsIntoKernel(kernel, tileMap) {
  if (!kernel || !tileMap) return;
  const flags = { affectsMove: true, affectsOccl: true };
  const { originX, originY, width, height } = tileMap;
  for (let row = 0; row < height; row++) {
    const y = originY + row;
    let runStart = null;
    for (let col = 0; col <= width; col++) {
      const isFloor = col < width ? isTileWalkable(tileMap, originX + col, y) : false;
      if (isFloor) {
        if (runStart === null) runStart = originX + col;
      }
      if ((!isFloor || col === width) && runStart !== null) {
        const runEnd = originX + col - 1;
        const span = runEnd - runStart + 1;
        const cx = (runStart + runEnd) * 0.5;
        kernel.carveBox(cx, y, span * 0.5, 0.5, 0, flags);
        runStart = null;
      }
    }
  }
}

/**
 * Generate a minimal rectangular room dungeon and capture the carved primitives.
 * Returns metadata describing the carved room.
 */
export function generateRectRoom(world, opts = {}) {
  const width = Math.max(4, Number.isFinite(opts.width) ? opts.width : 11);
  const height = Math.max(4, Number.isFinite(opts.height) ? opts.height : 11);
  const roomMeta = buildRoomMeta(width, height);

  const roomMinX = roomMeta.origin.x;
  const roomMaxX = roomMinX + width - 1;
  const roomMinY = roomMeta.origin.y;
  const roomMaxY = roomMinY + height - 1;

  const hallLen = Math.max(4, Math.floor(opts.hallLength ?? 10));
  const hallWidthTiles = Math.max(1, opts.hallWidthTiles ? opts.hallWidthTiles | 0 : 3);
  const hallHalf = Math.floor(hallWidthTiles / 2);
  const hallStartX = roomMaxX + 1;
  const hallEndX = hallStartX + hallLen - 1;
  const hallMinY = roomMeta.center.y - hallHalf;
  const hallMaxY = roomMeta.center.y + hallHalf;

  const mapMinX = roomMinX - 1;
  const mapMaxX = hallEndX + 1;
  const mapMinY = Math.min(roomMinY - 1, hallMinY - 1);
  const mapMaxY = Math.max(roomMaxY + 1, hallMaxY + 1);

  const tileWidth = mapMaxX - mapMinX + 1;
  const tileHeight = mapMaxY - mapMinY + 1;

  const tileMap = ensureTileMap(world, {
    width: tileWidth,
    height: tileHeight,
    originX: mapMinX,
    originY: mapMinY,
  });

  clearTileMap(tileMap, 0);

  for (let y = mapMinY; y <= mapMaxY; y++) {
    for (let x = mapMinX; x <= mapMaxX; x++) {
      setTile(tileMap, x, y, { walkable: false, opaque: true });
    }
  }

  for (let y = roomMinY; y <= roomMaxY; y++) {
    for (let x = roomMinX; x <= roomMaxX; x++) {
      setTile(tileMap, x, y, { walkable: true, opaque: false });
    }
  }

  for (let y = hallMinY; y <= hallMaxY; y++) {
    for (let x = hallStartX; x <= hallEndX; x++) {
      setTile(tileMap, x, y, { walkable: true, opaque: false });
    }
  }

  const kernel = ensureGeometryKernel(world, { seed: opts.seed ?? world.seed ?? 0 });
  kernel.clear();
  carveFloorsIntoKernel(kernel, tileMap);

  rebuildTileEntities(world, tileMap);

  const snapshot = kernel.snapshot();
  const entityId = ensureDungeonEntity(world, opts);
  const payload = {
    seed: snapshot.seed,
    mbrVersion: snapshot.mbrVersion,
    moveVersion: snapshot.moveVersion,
    occlVersion: snapshot.occlVersion,
    mbr: snapshot.mbr,
    primitives: snapshot.primitives,
    meta: {
      room: roomMeta,
      hallway: {
        shape: "rect",
        width: hallLen,
        tilesWide: hallWidthTiles,
        startX: hallStartX,
        endX: hallEndX,
        y0: hallMinY,
        y1: hallMaxY,
        length: hallLen,
        side: "east",
      },
      tiles: {
        origin: { x: tileMap.originX, y: tileMap.originY },
        width: tileMap.width,
        height: tileMap.height,
        version: tileMap.version,
      },
    },
    options: snapshot.options,
  };

  if (world.has(entityId, DungeonGeometry)) {
    world.set(entityId, DungeonGeometry, payload);
  } else {
    world.add(entityId, DungeonGeometry, payload);
  }

  return { entityId, kernel, room: roomMeta };
}
