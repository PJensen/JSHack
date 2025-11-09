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
  // Main room (centered at 0,0)
  kernel.carveBox(roomMeta.center.x, roomMeta.center.y, roomMeta.halfWidth, roomMeta.halfHeight, 0, carveFlags);

  // Basic straight hallways using capsules; no advanced shapes.
  const hallRadius = Math.max(0.75, Math.min(2, (opts.hallRadius ?? 1.0)));

  // EAST corridor from main room
  const eastHallLen = Math.max(4, Math.floor(opts.hallLength ?? 10));
  const eastHallStartX = roomMeta.center.x + roomMeta.halfWidth; // start at the right edge
  const eastHallStartY = roomMeta.center.y;
  const eastHallEndX = eastHallStartX + eastHallLen;
  const eastHallEndY = eastHallStartY;
  kernel.carveCapsule(eastHallStartX, eastHallStartY, eastHallEndX, eastHallEndY, hallRadius, carveFlags);

  // EAST adjoining room at end of corridor
  const eastRoomW = Math.max(6, Math.floor(opts.eastRoomWidth ?? 9));
  const eastRoomH = Math.max(6, Math.floor(opts.eastRoomHeight ?? 9));
  const eastRoom = buildRoomMeta(eastRoomW, eastRoomH);
  eastRoom.center.x = eastHallEndX + eastRoom.halfWidth + 1; // small gap beyond corridor end
  eastRoom.center.y = eastHallEndY;
  kernel.carveBox(eastRoom.center.x, eastRoom.center.y, eastRoom.halfWidth, eastRoom.halfHeight, 0, carveFlags);

  // NORTH corridor from main room
  const northHallLen = Math.max(4, Math.floor(opts.northHallLength ?? 8));
  const northHallStartX = roomMeta.center.x;
  const northHallStartY = roomMeta.center.y - roomMeta.halfHeight; // top edge of main room
  const northHallEndX = northHallStartX;
  const northHallEndY = northHallStartY - northHallLen;
  kernel.carveCapsule(northHallStartX, northHallStartY, northHallEndX, northHallEndY, hallRadius, carveFlags);

  // NORTH adjoining room
  const northRoomW = Math.max(6, Math.floor(opts.northRoomWidth ?? 9));
  const northRoomH = Math.max(5, Math.floor(opts.northRoomHeight ?? 7));
  const northRoom = buildRoomMeta(northRoomW, northRoomH);
  northRoom.center.x = northHallEndX;
  northRoom.center.y = northHallEndY - northRoom.halfHeight - 1;
  kernel.carveBox(northRoom.center.x, northRoom.center.y, northRoom.halfWidth, northRoom.halfHeight, 0, carveFlags);

  // SOUTH corridor from main room
  const southHallLen = Math.max(4, Math.floor(opts.southHallLength ?? 6));
  const southHallStartX = roomMeta.center.x;
  const southHallStartY = roomMeta.center.y + roomMeta.halfHeight; // bottom edge of main room
  const southHallEndX = southHallStartX;
  const southHallEndY = southHallStartY + southHallLen;
  kernel.carveCapsule(southHallStartX, southHallStartY, southHallEndX, southHallEndY, hallRadius, carveFlags);

  // SOUTH adjoining room
  const southRoomW = Math.max(6, Math.floor(opts.southRoomWidth ?? 7));
  const southRoomH = Math.max(6, Math.floor(opts.southRoomHeight ?? 7));
  const southRoom = buildRoomMeta(southRoomW, southRoomH);
  southRoom.center.x = southHallEndX;
  southRoom.center.y = southHallEndY + southRoom.halfHeight + 1;
  kernel.carveBox(southRoom.center.x, southRoom.center.y, southRoom.halfWidth, southRoom.halfHeight, 0, carveFlags);

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
      // Primary room for backward compatibility
      room: roomMeta,
      // Structured rooms list
      rooms: [
        { key: "main", ...roomMeta },
        { key: "east", ...eastRoom },
        { key: "north", ...northRoom },
        { key: "south", ...southRoom },
      ],
      // Hallways described with simple endpoints and radius
      hallways: [
        { key: "main-east", shape: "capsule", radius: hallRadius, ax: eastHallStartX, ay: eastHallStartY, bx: eastHallEndX, by: eastHallEndY },
        { key: "main-north", shape: "capsule", radius: hallRadius, ax: northHallStartX, ay: northHallStartY, bx: northHallEndX, by: northHallEndY },
        { key: "main-south", shape: "capsule", radius: hallRadius, ax: southHallStartX, ay: southHallStartY, bx: southHallEndX, by: southHallEndY },
      ],
      // Suggested door positions at room/corridor interfaces
      doors: [
        // East doorway at main room wall and at east room entry
        { x: roomMeta.center.x + roomMeta.halfWidth, y: roomMeta.center.y },
        { x: eastHallEndX, y: eastHallEndY },
        // North doorway at main room wall and at north room entry
        { x: roomMeta.center.x, y: roomMeta.center.y - roomMeta.halfHeight },
        { x: northHallEndX, y: northHallEndY },
        // South doorway at main room wall and at south room entry
        { x: roomMeta.center.x, y: roomMeta.center.y + roomMeta.halfHeight },
        { x: southHallEndX, y: southHallEndY },
      ],
    },
    options: snapshot.options,
  };

  if (world.has(entityId, DungeonGeometry)) {
    world.set(entityId, DungeonGeometry, payload);
  } else {
    world.add(entityId, DungeonGeometry, payload);
  }

  // Return extra meta for convenience
  return {
    entityId,
    kernel,
    room: roomMeta,
    rooms: [roomMeta, eastRoom, northRoom, southRoom],
    labeledRooms: {
      main: roomMeta,
      east: eastRoom,
      north: northRoom,
      south: southRoom,
    },
    doors: [
      { x: roomMeta.center.x + roomMeta.halfWidth, y: roomMeta.center.y },
      { x: eastHallEndX, y: eastHallEndY },
      { x: roomMeta.center.x, y: roomMeta.center.y - roomMeta.halfHeight },
      { x: northHallEndX, y: northHallEndY },
      { x: roomMeta.center.x, y: roomMeta.center.y + roomMeta.halfHeight },
      { x: southHallEndX, y: southHallEndY },
    ],
  };
}
