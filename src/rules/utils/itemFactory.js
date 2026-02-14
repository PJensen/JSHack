// rules/utils/itemFactory.js
// Centralized item creation by ID. Single source of truth for spawning items.

import { createFrom } from '../../lib/ecs-js/archetype.js';
import { buildEquipmentItem } from '../data/equipmentLoader.js';
import { getEquipmentDef } from '../data/equipment.js';
import { getItem } from '../data/items.js';
import { getGem } from '../data/gems.js';
import { ItemInfo } from '../components/ItemInfo.js';

// Archetypes
import { GoldStack, HealthPotion, ArrowsStack, FireArrowsStack, ScrollOfMapping, MagicItem, GemItem } from '../archetypes/Items.js';
import { Ration, IronRation } from '../archetypes/Food.js';

/**
 * Centralized item creation registry.
 * Maps item identity strings to their archetype constructors.
 */
const SIMPLE_ITEM_ARCHETYPES = {
  'gold': GoldStack,
  'potion_health': HealthPotion,
  'ammo_arrows': ArrowsStack,
  'ammo_fire_arrows': FireArrowsStack,
  'food_ration': Ration,
  'food_iron_ration': IronRation,
  'scroll_mapping': ScrollOfMapping,
};

/**
 * Create an item entity by its ID string.
 * Does NOT add Position - caller should place the item if needed.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world - ECS world
 * @param {string} itemId - Item identifier (e.g., 'gold', 'sword_plain', 'book_lightning')
 * @param {Object} opts - Options
 * @param {number} [opts.count=1] - Stack count for stackable items
 * @param {string[]} [opts.affixes=[]] - Affix IDs for equipment
 * @returns {number|null} - Created entity ID, or null if unknown item
 */
export function createItemById(world, itemId, opts = {}) {
  const count = opts.count || 1;
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

  // 2. Check equipment definitions
  const equipDef = getEquipmentDef(itemId);
  if (equipDef) {
    return buildEquipmentItem(world, itemId, { affixes });
  }

  // 3. Check gem definitions
  const gemDef = getGem(itemId);
  if (gemDef) {
    const id = createFrom(world, GemItem, {
      name: gemDef.name,
      identity: gemDef.id,
      weight: gemDef.weight,
      value: gemDef.value,
      description: gemDef.appearance,
    });
    return id;
  }

  // 4. Check magic items (wands, scrolls, spellbooks) from ITEM_DEFS
  const itemDef = getItem(itemId);
  if (itemDef) {
    const id = createFrom(world, MagicItem, {
      name: itemDef.name,
      identity: itemDef.id,
      type: itemDef.type,
      slot: itemDef.slot,
      weight: 1,
      value: 0,
      description: itemDef.description,
      count: itemDef.charges || 1,
      rarity: itemDef.rarity || 1,
      rarityName: itemDef.rarityName || 'common',
    });
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
    getEquipmentDef(itemId) ||
    getGem(itemId) ||
    getItem(itemId)
  );
}

/**
 * Get all valid item IDs.
 * @returns {string[]}
 */
export function listAllItemIds() {
  const simpleIds = Object.keys(SIMPLE_ITEM_ARCHETYPES);
  const equipIds = Object.keys(getEquipmentDef.EQUIP_DEFS || {});
  const magicIds = Object.keys(getItem.ITEM_DEFS || {});
  return [...simpleIds, ...equipIds, ...magicIds];
}
