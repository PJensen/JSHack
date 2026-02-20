import { Position } from "../components/Position.js";
import { Player } from "../components/Player.js";
import { RoomMetadata } from "../components/RoomMetadata.js";
import { createRng } from "../../lib/ecs-js/rng.js";

const AMBIENT_SOUND_STATE_KEY = Symbol.for("jshack:ambientSound:state");
const COOLDOWN_TURNS = 10; // Minimum turns between same ambient message

/**
 * @param {number} worldSeed
 * @param {number} turn
 * @param {number} roomX
 * @param {number} roomY
 * @param {string} band
 */
function createAmbientMessageRng(worldSeed, turn, roomX, roomY, band) {
  const salt = band === "near" ? 0x7f4a7c15 : 0x1a2b3c4d;
  const roomSeed = (((roomX | 0) * 0x9e3779b1) ^ ((roomY | 0) * 0x85ebca6b)) >>> 0;
  const turnSeed = Math.imul((turn | 0) >>> 0, 0x27d4eb2d) >>> 0;
  const seed = ((worldSeed >>> 0) ^ turnSeed ^ roomSeed ^ salt) >>> 0;
  return createRng(seed);
}

/**
 * Ambient sound system - generates proximity-based atmospheric messages
 * Runs in "effects" phase of scheduler
 *
 * Tracks player proximity to special locations (shoppes, etc.) and emits
 * ambient sound events when entering/approaching these areas.
 */
export function ambientSoundSystem(world) {
  // Track last notification turn for each location to avoid spam
  let notificationCooldowns = world[AMBIENT_SOUND_STATE_KEY];
  if (!(notificationCooldowns instanceof Map)) {
    notificationCooldowns = new Map();
    world[AMBIENT_SOUND_STATE_KEY] = notificationCooldowns;
  }

  // Find player
  let playerPos = null;
  for (const [, , pos] of world.query(Player, Position)) {
    playerPos = pos;
    break;
  }

  if (!playerPos) return;

  const currentTurn = world.step | 0;

  // Check for nearby shoppes
  for (const [entityId, metadata] of world.query(RoomMetadata)) {
    if (metadata.roomType !== 'shop') continue;

    // Calculate distance from player to shop center
    const shopCenterX = metadata.x + Math.floor(metadata.w / 2);
    const shopCenterY = metadata.y + Math.floor(metadata.h / 2);
    const dx = playerPos.x - shopCenterX;
    const dy = playerPos.y - shopCenterY;
    const distance = Math.max(Math.abs(dx), Math.abs(dy));  // Chebyshev distance

    // Location key for cooldown tracking
    const locationKey = `shop_${metadata.x}_${metadata.y}`;
    const lastNotified = notificationCooldowns.get(locationKey);
    const canNotify = lastNotified == null || (currentTurn - lastNotified) >= COOLDOWN_TURNS;

    if (!canNotify) continue;

    // Distance-based ambient messages
    let message = null;

    if (distance <= 4) {
      // Very close - louder sounds
      const messages = [
        "*The sound of coins jingling grows louder*",
        "*You hear the shopkeeper counting gold*",
        "*The chime of commerce echoes nearby*"
      ];
      const rng = createAmbientMessageRng(world.seed >>> 0, currentTurn, metadata.x, metadata.y, "near");
      message = messages[rng.int(0, messages.length - 1)];
    } else if (distance <= 8) {
      // Medium range - initial detection
      const messages = [
        "*You hear the chime of a cash register*",
        "*The distant sound of bartering reaches your ears*",
        "*You hear the faint jingle of coins*"
      ];
      const rng = createAmbientMessageRng(world.seed >>> 0, currentTurn, metadata.x, metadata.y, "mid");
      message = messages[rng.int(0, messages.length - 1)];
    }

    if (message) {
      world.emit('ambient:sound', { text: message, source: 'shop', distance });
      notificationCooldowns.set(locationKey, currentTurn);
      // Only emit one ambient sound per turn to avoid spam
      break;
    }
  }
}
