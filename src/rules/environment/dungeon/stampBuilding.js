// rules/environment/dungeon/stampBuilding.js
// Stamps a JSON building definition onto the chunk map at a given anchor position.

import {
  TILE_FLOOR,
  TILE_WALL,
  TILE_DOOR,
  TILE_GRASS,
  TILE_GRASS_A,
  TILE_GRASS_C,
  TILE_GRASS_D,
  TILE_TREE,
  TILE_FENCE,
  TILE_COBBLESTONE,
  TILE_FARMLAND,
  TILE_WATER,
  TILE_WATER_DEEP,
  TILE_SHALLOW_WATER,
  TILE_MOUNTAIN,
  TILE_MOUNTAIN_B,
  TILE_MOUNTAIN_C,
  TILE_STAIR_DOWN,
  TILE_STAIR_UP,
  TILE_ICE,
  TILE_LAVA,
} from "./constants.js";
import { setWorldTile, addSpawn } from "./overworld.js";
import { setRoofed } from "./tileMap.js";

const TILE_MAP = {
  floor:          TILE_FLOOR,
  wall:           TILE_WALL,
  door:           TILE_DOOR,
  grass:          TILE_GRASS,
  grass_a:        TILE_GRASS_A,
  grass_c:        TILE_GRASS_C,
  grass_d:        TILE_GRASS_D,
  tree:           TILE_TREE,
  fence:          TILE_FENCE,
  cobblestone:    TILE_COBBLESTONE,
  farmland:       TILE_FARMLAND,
  water:          TILE_WATER,
  water_deep:     TILE_WATER_DEEP,
  shallow_water:  TILE_SHALLOW_WATER,
  mountain:       TILE_MOUNTAIN,
  mountain_b:     TILE_MOUNTAIN_B,
  mountain_c:     TILE_MOUNTAIN_C,
  stair_down:     TILE_STAIR_DOWN,
  stair_up:       TILE_STAIR_UP,
  ice:            TILE_ICE,
  lava:           TILE_LAVA,
};

// Tile types that get a roof overhead
const ROOFABLE = new Set(["floor", "wall", "door"]);

/**
 * Stamp a building definition onto the world.
 * @param {Map} chunks - chunk map from overworld generation
 * @param {object} def - parsed building JSON (tiles[], spawns[], waypoints[], rooms[])
 * @param {number} anchorX - world X of the keystone (cobblestone attachment point)
 * @param {number} anchorY - world Y of the keystone
 * @returns {{ spawns: Object<string, {x:number,y:number}>, waypoints: Object<string, {x:number,y:number}>, shop: { vendorRole:string, door:{x:number,y:number}|null, work:{x:number,y:number}|null, room:object|null } | null }}
 */
export function stampBuilding(chunks, def, anchorX, anchorY) {
  // Place tiles + mark roofed bitmap for floor/wall/door
  for (const { dx, dy, tile } of def.tiles) {
    const tileId = TILE_MAP[tile];
    if (tileId === undefined) {
      console.warn(`stampBuilding: unknown tile type "${tile}"`);
      continue;
    }
    const wx = anchorX + dx;
    const wy = anchorY + dy;
    setWorldTile(chunks, wx, wy, tileId);
    if (ROOFABLE.has(tile)) {
      setRoofed(wx, wy, true);
    }
  }

  // Place spawns, collect first position of each kind + all positions per kind
  const spawnPositions = {};
  const allSpawnPositions = {};
  for (const { dx, dy, kind, params } of def.spawns) {
    addSpawn(chunks, anchorX + dx, anchorY + dy, kind, params || {});
    if (!spawnPositions[kind]) {
      spawnPositions[kind] = { x: anchorX + dx, y: anchorY + dy };
    }
    (allSpawnPositions[kind] ??= []).push({ x: anchorX + dx, y: anchorY + dy });
  }

  // Collect named waypoints
  const waypointPositions = {};
  if (def.waypoints) {
    for (const { dx, dy, name } of def.waypoints) {
      waypointPositions[name] = { x: anchorX + dx, y: anchorY + dy };
    }
  }

  const roomPositions = {};
  if (Array.isArray(def.rooms)) {
    for (const room of def.rooms) {
      const name = String(room?.name || room?.roomType || "");
      if (!name) continue;
      roomPositions[name] = {
        ...room,
        x: anchorX + (Number(room.dx) | 0),
        y: anchorY + (Number(room.dy) | 0),
        w: Number(room.w) | 0,
        h: Number(room.h) | 0,
      };
    }
  }

  let shopMeta = null;
  if (def.shop && typeof def.shop === "object") {
    const doorName = String(def.shop.doorWaypoint || "");
    const workName = String(def.shop.workWaypoint || "");
    const roomName = String(def.shop.room || "");
    shopMeta = {
      vendorRole: String(def.shop.vendorRole || ""),
      door: doorName ? (waypointPositions[doorName] || null) : null,
      work: workName ? (waypointPositions[workName] || null) : null,
      room: roomName ? (roomPositions[roomName] || null) : null,
    };
  }

  return {
    spawns: spawnPositions,
    waypoints: waypointPositions,
    allSpawns: allSpawnPositions,
    rooms: roomPositions,
    shop: shopMeta,
  };
}
