// main/wiring/itemName.js
// Central display name resolver for items.
// All callsites that need a player-facing item name should use this
// instead of directly reading NamedIdentity.name.

import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { isIdentified } from "../../rules/data/identification.js";

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
  return ni?.name || info?.description || info?.type || 'item';
}
