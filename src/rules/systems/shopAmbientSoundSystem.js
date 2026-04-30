import { RoomMetadata } from "../components/RoomMetadata.js";
import { playerEntity } from "../utils/queries.js";
import { createRng } from "../../lib/ecs-js/rng.js";
import { chebyshevScalar } from "../utils/distance.js";
import { currentDepth } from "../utils/worldAccess.js";

const SHOP_AMBIENT_STATE_KEY = Symbol.for("jshack:shopAmbientSoundSystem:state");
const COOLDOWN_TURNS = 10;
const GREETING_COOLDOWN_TURNS = 6;
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

const SHOP_GREETING_LINES = Object.freeze([
  "Welcome in — take your time browsing.",
  "Fine wares for careful delvers.",
  "No touching the cursed stock without coin.",
  "See something you like? It's priced to survive the dungeon.",
  "Fresh goods on the floor, no haggling today.",
  "Step lively, and mind the fragile bottles.",
]);

/**
 * @param {{x:number,y:number,w:number,h:number}} room
 * @param {{x:number,y:number}} pos
 */
function isInsideRoom(room, pos) {
  return pos.x >= room.x && pos.x < (room.x + room.w)
    && pos.y >= room.y && pos.y < (room.y + room.h);
}

/**
 * @param {Map<string, any>} stateMap
 * @param {string} key
 */
function getOrCreateRoomState(stateMap, key) {
  const prev = stateMap.get(key);
  if (prev && typeof prev === 'object') {
    return {
      lastSoundTurn: Number.isFinite(prev.lastSoundTurn) ? (prev.lastSoundTurn | 0) : null,
      lastGreetingTurn: Number.isFinite(prev.lastGreetingTurn) ? (prev.lastGreetingTurn | 0) : null,
      wasInside: !!prev.wasInside,
    };
  }
  if (Number.isFinite(prev)) {
    return { lastSoundTurn: prev | 0, lastGreetingTurn: null, wasInside: false };
  }
  return { lastSoundTurn: null, lastGreetingTurn: null, wasInside: false };
}

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

  const _player = playerEntity(world);
  if (!_player) return;
  const playerPos = _player.pos;

  const depthNow = currentDepth(world, 0);
  const currentTurn = world.step | 0;

  for (const [entityId, metadata] of world.query(RoomMetadata)) {
    if (metadata.roomType !== "shop") continue;

    const locationKey = `shop_${depthNow}_${metadata.x}_${metadata.y}`;
    const roomState = getOrCreateRoomState(state, locationKey);
    const insideNow = isInsideRoom(metadata, playerPos);
    const enteredNow = insideNow && !roomState.wasInside;
    const canGreet = roomState.lastGreetingTurn == null || (currentTurn - roomState.lastGreetingTurn) >= GREETING_COOLDOWN_TURNS;

    if (enteredNow && canGreet) {
      const speakerId = Number(metadata.shopkeeperId || 0) | 0;
      if (speakerId > 0) {
        const greetRng = createShopSoundRng(world.seed >>> 0, currentTurn, metadata.x, metadata.y);
        const line = SHOP_GREETING_LINES[greetRng.int(0, SHOP_GREETING_LINES.length - 1)] || SHOP_GREETING_LINES[0];
        world.emit?.("npc:dialogue", {
          actor: speakerId,
          targetId: 0,
          text: line,
          source: "shop:ambientGreeting",
        });
        roomState.lastGreetingTurn = currentTurn;
      }
    }
    roomState.wasInside = insideNow;
    state.set(locationKey, roomState);

    const centerX = metadata.x + Math.floor(metadata.w / 2);
    const centerY = metadata.y + Math.floor(metadata.h / 2);
    const distance = chebyshevScalar(playerPos.x, playerPos.y, centerX, centerY);
    if (distance > 12) continue;

    const canNotify = roomState.lastSoundTurn == null || (currentTurn - roomState.lastSoundTurn) >= COOLDOWN_TURNS;
    if (!canNotify) continue;

    const rng = createShopSoundRng(world.seed >>> 0, currentTurn, metadata.x, metadata.y);
    const idx = rng.int(0, SHOP_CLARITY_LINES.length - 1);
    const clarity = SHOP_CLARITY_LINES[idx] || SHOP_CLARITY_LINES[0];

    world.emit?.("ambient:sound", {
      source: "shop",
      at: { x: centerX, y: centerY },
      depth: depthNow,
      sourceDbAt1Tile: SHOP_SOURCE_DB_AT_1_TILE,
      clarity,
      targetId: entityId,
    });

    roomState.lastSoundTurn = currentTurn;
    state.set(locationKey, roomState);
    break;
  }
}
