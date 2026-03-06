// src/rules/systems/shopkeeperSystem.js
// Shopkeeper AI: guards shop, prevents theft, manages shop interactions

import { Position } from "../components/Position.js";
import { Player } from "../components/Player.js";
import { Inventory } from "../components/Inventory.js";
import { Unpaid } from "../components/Unpaid.js";
import { RoomMetadata } from "../components/RoomMetadata.js";
import { ShopInventory } from "../components/ShopInventory.js";
import { MoveIntent } from "../components/Intents/MoveIntent.js";
import { inventoryItems } from "../utils/inventoryFacade.js";

/**
 * Check if a position is inside a room
 */
function isInRoom(x, y, room) {
  return x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h;
}

/**
 * Get total unpaid bill for a player from a specific shopkeeper
 */
function calculateBill(world, playerId, shopkeeperId) {
  let total = 0;
  for (const itemId of inventoryItems(world, playerId)) {
    const unpaid = world.get(itemId, Unpaid);
    if (unpaid && unpaid.shopkeeperId === shopkeeperId) {
      total += unpaid.price;
    }
  }
  return total;
}

/**
 * Shopkeeper system: blocks player from leaving shop with unpaid items
 */
export function shopkeeperSystem(world) {
  // Find all shop rooms and their shopkeepers
  const shops = [];
  for (const [roomId, room] of world.query(RoomMetadata)) {
    if (room.roomType === 'shop' && room.shopkeeperId > 0) {
      shops.push({ roomId, room, shopkeeperId: room.shopkeeperId });
    }
  }

  if (shops.length === 0) return;

  // Check player movement relative to shops
  for (const [playerId, player, pos, inv] of world.query(Player, Position, Inventory)) {
    const moveIntent = world.get(playerId, MoveIntent);
    if (!moveIntent) continue;

    const nextX = pos.x + (moveIntent.dx || 0);
    const nextY = pos.y + (moveIntent.dy || 0);
    const currentlyInShop = shops.find(s => isInRoom(pos.x, pos.y, s.room));
    const movingToShop = shops.find(s => isInRoom(nextX, nextY, s.room));

    // Leaving a shop?
    if (currentlyInShop && !movingToShop) {
      const bill = calculateBill(world, playerId, currentlyInShop.shopkeeperId);

      if (bill > 0) {
        // Block exit and trigger payment interaction
        world.remove(playerId, MoveIntent);
        try {
          world.emit('shop:exit-blocked', {
            actor: playerId,
            shopkeeperId: currentlyInShop.shopkeeperId,
            bill,
            room: currentlyInShop.room,
          });
        } catch (e) { console.debug('[shopkeeperSystem] emit shop:exit-blocked failed:', e); }
      }
    }
  }
}
