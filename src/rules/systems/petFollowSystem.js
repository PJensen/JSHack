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

  const playerInv = world.get(playerId, Inventory);

  for (const [id, _pet, pos] of world.query(Pet, Position)) {
    const dx = playerPos.x - pos.x;
    const dy = playerPos.y - pos.y;
    const dist = Math.abs(dx) + Math.abs(dy); // Manhattan distance

    // When adjacent (or same tile), drop carried items to the player
    if (dist <= 1 && playerInv) {
      const petInv = world.get(id, Inventory);
      if (petInv && petInv.items.length > 0) {
        const toGive = petInv.items.slice();
        for (const itemId of toGive) {
          const info = world.get(itemId, ItemInfo);
          if (!info) continue;
          const count = info.count || 1;
          const ident = world.get(itemId, NamedIdentity)?.identity;
          const itemName = world.get(itemId, NamedIdentity)?.name || info.description || info.type || 'item';

          // Emit before stacking (which may destroy the item entity)
          try { world.emit?.('pet:deliver', { petId: id, actor: playerId, itemId, itemName, count }); } catch {}

          // Try to stack into existing player item
          let stacked = false;
          for (const pid of playerInv.items) {
            const n = world.get(pid, NamedIdentity);
            if (n && n.identity === ident) {
              world.mutate(pid, ItemInfo, (r) => { r.count = (r.count || 1) + count; });
              world.destroy(itemId);
              stacked = true;
              break;
            }
          }
          if (!stacked) {
            // Add as new item if player has room (currency always fits)
            const ignoreCapacity = info.type === 'currency';
            if (ignoreCapacity || playerInv.capacity == null || playerInv.items.length < playerInv.capacity) {
              playerInv.items.push(itemId);
            } else {
              // No room — drop on ground at player position
              try { world.add(itemId, Position, { x: playerPos.x, y: playerPos.y }); } catch {}
            }
          }
        }
        petInv.items.length = 0;
      }
    }

    // Teleport if too far (floor transition, etc.)
    if (dist > TELEPORT_DISTANCE) {
      world.set(id, Position, { x: playerPos.x + 1, y: playerPos.y });
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
