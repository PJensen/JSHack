// rules/utils/itemFactory.js
// Centralized item creation by ID. Single source of truth for spawning items.

import { createFrom } from '../../lib/ecs-js/archetype.js';
import { buildCatalogItem } from '../data/itemCatalogLoader.js';
import { ITEM_CATALOG, getCatalogItem } from '../data/itemCatalog.js';
import * as gems from '../data/gems.js';
import { ItemInfo } from '../components/ItemInfo.js';

// Archetypes
import { GoldStack, HealthPotion, ArrowsStack, FireArrowsStack, ScrollOfMapping, GemItem, Bone } from '../archetypes/Items.js';
import {
  FlourSack,
  IronIngot,
  WaterBucket,
  FirewoodBundle,
  LumberBundle,
  WorkHatchet,
  KitchenKnife,
  TownStew,
} from '../archetypes/TownGoods.js';

/**
 * Centralized item creation registry.
 * Maps item identity strings to their archetype constructors.
 */
const SIMPLE_ITEM_ARCHETYPES = {
  'gold': GoldStack,
  'potion_health': HealthPotion,
  'ammo_arrows': ArrowsStack,
  'ammo_fire_arrows': FireArrowsStack,
  'food_flour': FlourSack,
  'food_stew': TownStew,
  'water_bucket': WaterBucket,
  'fuel_firewood': FirewoodBundle,
  'material_iron': IronIngot,
  'material_lumber': LumberBundle,
  'tool_hatchet': WorkHatchet,
  'tool_kitchen_knife': KitchenKnife,
  'scroll_mapping': ScrollOfMapping,
  'bone': Bone,
};

/**
 * Create an item entity by its ID string.
 * Does NOT add Position - caller should place the item if needed.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world - ECS world
 * @param {string} itemId - Item identifier (e.g., 'gold', 'sword_plain', 'book_lightning')
 * @param {Object} opts - Options
 * @param {number} [opts.count] - Optional explicit stack count override
 * @param {string[]} [opts.affixes=[]] - Affix IDs for equipment
 * @returns {number|null} - Created entity ID, or null if unknown item
 */
export function createItemById(world, itemId, opts = {}) {
  const rawCount = Number(opts?.count);
  const hasExplicitCount = Number.isFinite(rawCount) && rawCount > 0;
  const count = hasExplicitCount ? (rawCount | 0) : 0;
  const affixes = opts.affixes || [];

  // 1. Check simple archetypes (gold, potions, food, ammo, etc.)
  if (SIMPLE_ITEM_ARCHETYPES[itemId]) {
    const id = createFrom(world, SIMPLE_ITEM_ARCHETYPES[itemId], {});
    // Set count for stackable items
    if (count > 1) {
      world.mutate(id, ItemInfo, r => { r.count = count; });
    }
    return id;
  }

  // 2. Check unified catalog definitions
  const catalogDef = getCatalogItem(itemId);
  if (catalogDef) {
    const buildOpts = { affixes };
    if (hasExplicitCount) buildOpts.count = count;
    return buildCatalogItem(world, itemId, buildOpts);
  }

  // 3. Check gem definitions
    const gemDef = gems.getGem(itemId);
  if (gemDef) {
    const params = gems.buildGemItemParams(gemDef);
    if (!params) return null;
    const id = createFrom(world, GemItem, params);
    return id;
  }

  // Unknown item
  return null;
}

/**
 * Check if an item ID is valid and can be created.
 * @param {string} itemId
 * @returns {boolean}
 */
export function isValidItemId(itemId) {
  return !!(
    SIMPLE_ITEM_ARCHETYPES[itemId] ||
    getCatalogItem(itemId) ||
    getGem(itemId)
  );
}

/**
 * Get all valid item IDs.
 * @returns {string[]}
 */
export function listAllItemIds() {
  const simpleIds = Object.keys(SIMPLE_ITEM_ARCHETYPES);
  const catalogIds = Object.keys(ITEM_CATALOG || {});
  return Array.from(new Set([...simpleIds, ...catalogIds]));
}
