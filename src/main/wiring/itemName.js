// main/wiring/itemName.js
// Central display name resolver for items.
// All callsites that need a player-facing item name should use this
// instead of directly reading NamedIdentity.name.

import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { FoodDecay } from "../../rules/components/FoodDecay.js";
import { isIdentified } from "../../rules/data/identification.js";
import { getUnidentifiedName, requiresIdentification } from "../../rules/data/itemAppearances.js";
import { getDecayStage } from "../../rules/data/food.js";
import { getAffix } from "../../rules/data/affixes.js";
import {
  getSpell,
  describeSpellDetailLines,
  describeSpellTargetEffects,
} from "../../rules/data/spells.js";

/**
 * Resolve the display name for an item entity.
 * - Gems: if the gem type is identified, return the true name; otherwise return the appearance.
 * - Identifiable items (equipment, scrolls, potions, wands): if not identified, return
 *   "Unidentified <Category>"; otherwise return the true name.
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

  // Check if this item requires identification
  if (info && requiresIdentification(info)) {
    const identity = ni?.identity || '';
    if (identity && !isIdentified(identity)) {
      return getUnidentifiedName(info) || 'Unidentified Item';
    }
  }

  // Identified or exempt items: true name → description → type fallback
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
 * @param {string} identity
 * @returns {string}
 */
function spellIdFromIdentity(identity) {
  const raw = String(identity || "").trim();
  if (!raw) return "";
  for (const prefix of ["book_", "scroll_", "wand_", "spell:"]) {
    if (raw.startsWith(prefix)) return raw.slice(prefix.length);
  }
  return "";
}

/**
 * Build a standardised display-data object for an item entity.
 * Used by inventory, chest, ground-pickup and any other UI that shows item info.
 * When an item is unidentified, bonuses, affixes, description, and spell details
 * are suppressed so the UI does not reveal hidden properties.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} itemId
 * @returns {object|null}
 */
export function buildItemDisplayData(world, itemId) {
  const info = world.get(itemId, ItemInfo);
  if (!info) return null;
  const ni = world.get(itemId, NamedIdentity);

  // Determine if this item is unidentified
  const identity = ni?.identity || '';
  const needsId = requiresIdentification(info);
  const identified = !needsId || (identity && isIdentified(identity));

  const spellId = identified ? spellIdFromIdentity(identity) : "";
  const linkedSpell = spellId ? getSpell(spellId) : null;
  const detailLines = linkedSpell ? describeSpellDetailLines(linkedSpell) : [];
  const targetEffects = linkedSpell ? describeSpellTargetEffects(linkedSpell) : [];
  const description = identified
    ? (linkedSpell
        ? String(linkedSpell.description || info.description || "").trim()
        : (info.description || ""))
    : "";

  return {
    id: itemId,
    type: info.type || 'item',
    name: resolveItemDisplayName(world, itemId),
    slot: info.slot || '',
    count: info.count || 1,
    rarityName: identified ? (info.rarityName || 'common') : 'common',
    description,
    bonuses: identified && info.bonuses && typeof info.bonuses === 'object' ? { ...info.bonuses } : {},
    affixes: identified ? resolveAffixes(info.affixes) : [],
    damageDice: identified ? (info.damageDice || null) : null,
    staminaCost: identified ? (info.staminaCost ?? null) : null,
    twoHanded: identified ? !!info.twoHanded : false,
    coating: identified && info.coating && typeof info.coating === 'object' ? { ...info.coating } : null,
    spellId: linkedSpell?.id || null,
    detailLines,
    targetEffects,
    identified,
  };
}
