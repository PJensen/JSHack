import { DungeonState } from "../components/DungeonState.js";
import { Position } from "../components/Position.js";
import { Player } from "../components/Player.js";
import { RoomMetadata } from "../components/RoomMetadata.js";
import { createRng } from "../../lib/ecs-js/rng.js";

const SHOP_AMBIENT_STATE_KEY = Symbol.for("jshack:shopAmbientSoundSystem:state");
const COOLDOWN_TURNS = 10;
const SHOP_SOURCE_DB_AT_1_TILE = 60;

const SHOP_CLARITY_LINES = Object.freeze([
  Object.freeze({
    far: "you hear faint coin clinks",
    mid: "you hear bartering nearby",
    near: "you hear a busy market in full swing",
  }),
  Object.freeze({
    far: "you hear a distant register chime",
    mid: "you hear coins exchanging hands",
    near: "you hear rapid haggling and ringing tills",
  }),
  Object.freeze({
    far: "you catch a faint murmur of trade",
    mid: "you hear the bustle of commerce",
    near: "you hear loud bargaining from the shop",
  }),
]);

/**
 * @param {number} worldSeed
 * @param {number} turn
 * @param {number} roomX
 * @param {number} roomY
 */
function createShopSoundRng(worldSeed, turn, roomX, roomY) {
  const roomSeed = (((roomX | 0) * 0x9e3779b1) ^ ((roomY | 0) * 0x85ebca6b)) >>> 0;
  const turnSeed = Math.imul((turn | 0) >>> 0, 0x27d4eb2d) >>> 0;
  const seed = ((worldSeed >>> 0) ^ turnSeed ^ roomSeed ^ 0x53484f50) >>> 0;
  return createRng(seed);
}

function getCurrentDepth(world) {
  for (const [, ds] of world.query(DungeonState)) {
    const depth = Number(ds?.currentDepth);
    return Number.isFinite(depth) ? (depth | 0) : 0;
  }
  return 0;
}

/**
 * Emit structured `ambient:sound` events for nearby shop rooms.
 * This is shop-only ambient authoring; audibility and message selection are
 * resolved by display/ui/wiring/messageWiring.js via rules/utils/sound.js.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
export function shopAmbientSoundSystem(world) {
  let state = world[SHOP_AMBIENT_STATE_KEY];
  if (!(state instanceof Map)) {
    state = new Map();
    world[SHOP_AMBIENT_STATE_KEY] = state;
  }

  let playerPos = null;
  for (const [, , pos] of world.query(Player, Position)) {
    playerPos = pos;
    break;
  }
  if (!playerPos) return;

  const currentDepth = getCurrentDepth(world);
  const currentTurn = world.step | 0;

  for (const [entityId, metadata] of world.query(RoomMetadata)) {
    if (metadata.roomType !== "shop") continue;

    const centerX = metadata.x + Math.floor(metadata.w / 2);
    const centerY = metadata.y + Math.floor(metadata.h / 2);
    const distance = Math.max(Math.abs(playerPos.x - centerX), Math.abs(playerPos.y - centerY));
    if (distance > 12) continue;

    const locationKey = `shop_${metadata.x}_${metadata.y}`;
    const lastTurn = state.get(locationKey);
    const canNotify = lastTurn == null || (currentTurn - lastTurn) >= COOLDOWN_TURNS;
    if (!canNotify) continue;

    const rng = createShopSoundRng(world.seed >>> 0, currentTurn, metadata.x, metadata.y);
    const idx = rng.int(0, SHOP_CLARITY_LINES.length - 1);
    const clarity = SHOP_CLARITY_LINES[idx] || SHOP_CLARITY_LINES[0];

    world.emit?.("ambient:sound", {
      source: "shop",
      at: { x: centerX, y: centerY },
      depth: currentDepth,
      sourceDbAt1Tile: SHOP_SOURCE_DB_AT_1_TILE,
      clarity,
      targetId: entityId,
    });

    state.set(locationKey, currentTurn);
    break;
  }
}
