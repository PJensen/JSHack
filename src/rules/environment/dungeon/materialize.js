// rules/environment/dungeon/materialize.js
// Creates ECS entities for interactive features (doors, stairs, spawns).
// Floor and wall tiles are NOT entities — they live in the TileMap grid.

import { createFrom } from '../../../lib/ecs-js/archetype.js';
import { Door } from '../../archetypes/Door.js';
import { materializeSpawn } from './populate.js';
import { RoomMetadata } from '../../components/RoomMetadata.js';
import { Unpaid } from '../../components/Unpaid.js';
import { Position } from '../../components/Position.js';
import { Inventory } from '../../components/Inventory.js';
import { NamedIdentity } from '../../components/NamedIdentity.js';
import { inventoryItems } from '../../utils/inventoryFacade.js';
import { appraiseItemValue, getUnidentifiedGemAppraisal } from '../../utils/shopAppraisal.js';
import {
  CHUNK_SIZE, TILE_DOOR, TILE_STAIR_DOWN, TILE_STAIR_UP,
} from './constants.js';

const SHOP_FLOOR_ITEM_KINDS = new Set(["shop_item", "alchemy_shop_item", "book_shop_item", "general_store_item"]);
const SHOP_DISPLAY_IDENTITIES = new Set(["potion_shelf", "gem_display_case", "weapon_rack"]);

/**
 * Create ECS entities for interactive tiles and spawn features.
 * Floor/wall tiles are handled by the TileMap — no entities created for them.
 * @param {import('../../../lib/ecs-js/index.js').World} world
 * @param {import('./chunk.js').ChunkData} chunk
 * @param {Object} [opts]
 * @param {Function} [opts.createStairDown] - archetype creator for down stairs
 * @param {Function} [opts.createStairUp]   - archetype creator for up stairs
 * @returns {number[]} entity IDs created (for chunk tracking)
 */
export function materializeChunk(world, chunk, opts = {}) {
  const ids = [];
  const cs = CHUNK_SIZE;
  const ox = chunk.chunkX * cs;
  const oy = chunk.chunkY * cs;

  for (let ly = 0; ly < cs; ly++) {
    for (let lx = 0; lx < cs; lx++) {
      const tile = chunk.tiles[ly * cs + lx];
      const wx = ox + lx;
      const wy = oy + ly;

      switch (tile) {
        case TILE_DOOR:
          ids.push(createFrom(world, Door, { x: wx, y: wy }));
          break;
        case TILE_STAIR_DOWN:
          if (opts.createStairDown) {
            ids.push(opts.createStairDown(world, wx, wy));
          }
          break;
        case TILE_STAIR_UP:
          if (opts.createStairUp) {
            ids.push(opts.createStairUp(world, wx, wy));
          }
          break;
      }
    }
  }

  // Materialize spawn points (monsters, items)
  for (const sp of chunk.spawns) {
    const eid = spawnFeature(world, sp);
    if (eid != null) ids.push(eid);
  }

  // Post-process: Add Unpaid components to shop items with correct shopkeeperId
  for (const [roomId, room] of world.query(RoomMetadata)) {
    if (room.roomType === 'shop' && room.shopkeeperId > 0) {
      // Find authored floor stock in this room and mark it as unpaid shop goods.
      for (const sp of chunk.spawns) {
        if (SHOP_FLOOR_ITEM_KINDS.has(sp.kind) && sp._itemId && sp._calculatedPrice) {
          const itemId = sp._itemId;
          const pos = world.get(itemId, Position);
          if (pos &&
              pos.x >= room.x && pos.x < room.x + room.w &&
              pos.y >= room.y && pos.y < room.y + room.h) {
            // Add Unpaid component now that we know the shopkeeperId
            try {
              world.add(itemId, Unpaid, {
                shopkeeperId: room.shopkeeperId,
                price: sp._calculatedPrice
              });
            } catch {} // ECS: may already exist
          }
        }
      }

      for (const [displayId, inv, pos, named] of world.query(Inventory, Position, NamedIdentity)) {
        if (!SHOP_DISPLAY_IDENTITIES.has(String(named?.identity || ""))) continue;
        if (!(pos.x >= room.x && pos.x < room.x + room.w && pos.y >= room.y && pos.y < room.y + room.h)) continue;

        for (const itemId of inventoryItems(world, displayId)) {
          if (world.has(itemId, Unpaid)) continue;
          const price = Math.ceil(appraiseItemValue(world, itemId, {
            unidentifiedGemValue: getUnidentifiedGemAppraisal(world, itemId),
          }) * 1.3);
          try {
            world.add(itemId, Unpaid, {
              shopkeeperId: room.shopkeeperId,
              price,
            });
          } catch {}
        }
      }
    }
  }

  return ids;
}

/**
 * Create an entity from a spawn point descriptor.
 * @param {import('../../../lib/ecs-js/index.js').World} world
 * @param {{x:number, y:number, kind:string, params:Object}} spawn
 * @returns {number|null} entity ID or null
 */
function spawnFeature(world, spawn) {
  return materializeSpawn(world, spawn);
}
