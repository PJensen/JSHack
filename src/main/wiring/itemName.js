// main/wiring/itemName.js
// Central display name resolver for items.
// All callsites that need a player-facing item name should use this
// instead of directly reading NamedIdentity.name.

import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { FoodDecay } from "../../rules/components/FoodDecay.js";
import { isIdentified } from "../../rules/data/identification.js";
import { getDecayStage } from "../../rules/data/food.js";
import { getAffix } from "../../rules/data/affixes.js";

/**
 * Resolve the display name for an item entity.
 * - Gems: if the gem type is identified, return the true name; otherwise return the appearance.
 * - All other items: existing fallback chain.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} entityId
 * @returns {string}
 */
export function resolveItemDisplayName(world, entityId) {
  const ni = world.get(entityId, NamedIdentity);
  const info = world.get(entityId, ItemInfo);

  if (info && info.type === 'gem') {
    const identity = ni?.identity || '';
    if (identity && isIdentified(identity)) {
      return ni?.name || info.description || info.type || 'gem';
    }
    // Unidentified gem: show appearance (e.g. "red gem")
    return info.description || info.type || 'gem';
  }

  // Non-gem items: true name → description → type fallback
  let name = ni?.name || info?.description || info?.type || 'item';

  // Prepend decay stage for food that has gone off
  const decay = world.get(entityId, FoodDecay);
  if (decay) {
    const { stage } = getDecayStage(decay.turnsHeld, decay.shelfLife);
    if (stage !== 'fresh') {
      const prefix = stage.charAt(0).toUpperCase() + stage.slice(1);
      name = `${prefix} ${name}`;
    }
  }

  return name;
}

/**
 * Resolve affix IDs into display-friendly objects.
 * @param {any[]} rawAffixes
 * @returns {{ id: string, name: string, description: string }[]}
 */
export function resolveAffixes(rawAffixes) {
  return (Array.isArray(rawAffixes) ? rawAffixes : []).map(aid => {
    const def = getAffix(aid);
    return { id: aid, name: def?.name || aid, description: def?.description || '' };
  });
}

/**
 * Build a standardised display-data object for an item entity.
 * Used by inventory, chest, ground-pickup and any other UI that shows item info.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} itemId
 * @returns {object|null}
 */
export function buildItemDisplayData(world, itemId) {
  const info = world.get(itemId, ItemInfo);
  if (!info) return null;
  return {
    id: itemId,
    type: info.type || 'item',
    name: resolveItemDisplayName(world, itemId),
    slot: info.slot || '',
    count: info.count || 1,
    rarityName: info.rarityName || 'common',
    description: info.description || '',
    bonuses: info.bonuses && typeof info.bonuses === 'object' ? { ...info.bonuses } : {},
    affixes: resolveAffixes(info.affixes),
    damageDice: info.damageDice || null,
    staminaCost: info.staminaCost ?? null,
    twoHanded: !!info.twoHanded,
    coating: info.coating && typeof info.coating === 'object' ? { ...info.coating } : null,
  };
}
