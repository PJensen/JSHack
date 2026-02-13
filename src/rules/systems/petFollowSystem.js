// src/rules/systems/petFollowSystem.js
// Pets follow the player each tick, staying within 2 tiles.
// If the pet is very far away (e.g. floor transition), it teleports nearby.
// When adjacent to the player and carrying items, drops them at the player.

import { Position } from "../components/Position.js";
import { Pet } from "../components/Pet.js";
import { Player } from "../components/Player.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { MoveIntent } from "../components/Intents/MoveIntent.js";
import { findNearestValidTileAround } from "../utils/queries.js";

const FOLLOW_DISTANCE = 2;  // start following when farther than this
const TELEPORT_DISTANCE = 10; // teleport if farther than this

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function petFollowSystem(world) {
  // Find player
  let playerId = 0;
  let playerPos = null;
  for (const [id, _p, pos] of world.query(Player, Position)) {
    playerId = id;
    playerPos = { x: pos.x, y: pos.y };
    break;
  }
  if (!playerPos) return;

  for (const [id, _pet, pos] of world.query(Pet, Position)) {
    const dx = playerPos.x - pos.x;
    const dy = playerPos.y - pos.y;
    const dist = Math.abs(dx) + Math.abs(dy); // Manhattan distance

    // When adjacent (or same tile), drop carried items at player's feet
    if (dist <= 1) {
      const petInv = world.get(id, Inventory);
      if (petInv && petInv.items.length > 0) {
        for (const itemId of petInv.items) {
          const itemName = world.get(itemId, NamedIdentity)?.name || world.get(itemId, ItemInfo)?.description || 'item';
          try { world.add(itemId, Position, { x: playerPos.x, y: playerPos.y }); } catch {}
          try { world.emit?.('pet:deliver', { petId: id, actor: playerId, itemId, itemName }); } catch {}
        }
        petInv.items.length = 0;
      }
    }

    // Teleport if too far (floor transition, etc.)
    if (dist > TELEPORT_DISTANCE) {
      const teleportTile = findNearestValidTileAround(world, playerPos, {
        maxDistance: 1,
        exclude: [{ x: playerPos.x, y: playerPos.y }],
      });
      if (teleportTile) world.set(id, Position, teleportTile);
      continue;
    }

    // Already close enough — stay put
    if (dist <= FOLLOW_DISTANCE) continue;

    // Move one step toward the player
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    let mx = 0, my = 0;
    if (ax >= ay) { mx = Math.sign(dx); } else { my = Math.sign(dy); }

    if ((mx | my) === 0) continue;

    if (!world.has(id, MoveIntent)) {
      try { world.add(id, MoveIntent, { dx: mx, dy: my }); } catch {}
    }
  }
}
