import { Position } from "../components/Position.js";
import { Player } from "../components/Player.js";
import { RoomMetadata } from "../components/RoomMetadata.js";

/**
 * Ambient sound system - generates proximity-based atmospheric messages
 * Runs in "effects" phase of scheduler
 *
 * Tracks player proximity to special locations (shoppes, etc.) and emits
 * ambient sound events when entering/approaching these areas.
 */
export function ambientSoundSystem(world) {
  // Track last notification turn for each location to avoid spam
  const notificationCooldowns = new Map();
  const COOLDOWN_TURNS = 10;  // Minimum turns between same ambient message

  // Find player
  let playerPos = null;
  for (const [id, pos] of world.query(Player, Position)) {
    playerPos = pos;
    break;
  }

  if (!playerPos) return;

  const currentTurn = world.tick_count || 0;

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
    const lastNotified = notificationCooldowns.get(locationKey) || -Infinity;
    const canNotify = (currentTurn - lastNotified) >= COOLDOWN_TURNS;

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
      message = messages[Math.floor(Math.random() * messages.length)];
    } else if (distance <= 8) {
      // Medium range - initial detection
      const messages = [
        "*You hear the chime of a cash register*",
        "*The distant sound of bartering reaches your ears*",
        "*You hear the faint jingle of coins*"
      ];
      message = messages[Math.floor(Math.random() * messages.length)];
    }

    if (message) {
      world.emit('ambient:sound', { text: message, source: 'shop', distance });
      notificationCooldowns.set(locationKey, currentTurn);
      // Only emit one ambient sound per turn to avoid spam
      break;
    }
  }
}
