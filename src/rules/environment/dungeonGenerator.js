import { ensureGeometryKernel } from "./worldGeometry.js";
import { Dungeon } from "../components/Dungeon.js";
import { DungeonGeometry } from "../components/DungeonGeometry.js";

const DUNGEON_ENTITY_KEY = Symbol.for("jshack.dungeon.entity");

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

/**
 * Generate a minimal rectangular room dungeon and capture the carved primitives.
 * Returns metadata describing the carved room.
 */
export function generateRectRoom(world, opts = {}) {
  const width = Math.max(4, Number.isFinite(opts.width) ? opts.width : 11);
  const height = Math.max(4, Number.isFinite(opts.height) ? opts.height : 11);
  const roomMeta = buildRoomMeta(width, height);

  const kernel = ensureGeometryKernel(world, { seed: opts.seed ?? world.seed ?? 0 });
  kernel.clear();

  const carveFlags = { affectsMove: true, affectsOccl: true };
  kernel.carveBox(roomMeta.center.x, roomMeta.center.y, roomMeta.halfWidth, roomMeta.halfHeight, 0, carveFlags);

  // Carve a simple horizontal hallway from the room's right wall
  const hallRadius = Math.max(0.75, Math.min(2, (opts.hallRadius ?? 1.0)));
  const hallLen = Math.max(4, Math.floor(opts.hallLength ?? 10));
  const hallStartX = roomMeta.center.x + roomMeta.halfWidth; // start at the right edge
  const hallStartY = roomMeta.center.y;
  const hallEndX = hallStartX + hallLen;
  const hallEndY = hallStartY;
  kernel.carveCapsule(hallStartX, hallStartY, hallEndX, hallEndY, hallRadius, carveFlags);

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
        shape: "capsule",
        radius: hallRadius,
        ax: hallStartX,
        ay: hallStartY,
        bx: hallEndX,
        by: hallEndY,
        length: hallLen,
        side: "east",
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
