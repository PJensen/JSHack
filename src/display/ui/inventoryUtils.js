// display/ui/inventoryUtils.js
// Pure utility helpers for inventory item classification.
// Separated from overlay.js to avoid heavy transitive imports in tests.

/**
 * @param {any} it
 */
export function isInventoryItemEquippable(it) {
  const type = String(it?.type || '');
  const slot = String(it?.slot || '').toLowerCase();
  return type === 'equip' || type === 'ammo' || type === 'wand' || slot === 'ranged';
}

/**
 * @param {any} it
 */
export function isInventoryItemUsable(it) {
  if (!it) return false;
  if (it.canUse) return true;
  return it.type === 'potion'
    || it.type === 'learn'
    || it.type === 'book'
    || it.type === 'scroll'
    || it.type === 'wand'
    || it.type === 'food'
    || it.type === 'tool';
}

/**
 * @param {any} it
 * @returns {"none"|"apply"|"equip"|"use"|"set-spell"}
 */
export function getInventoryDefaultAction(it) {
  if (!it) return 'none';
  const canApply = !!it.canApply && Number(it.applyTargetCount || 0) > 0;
  if (isInventoryItemEquippable(it)) return 'equip';
  if (canApply && (it.type === 'scroll' || it.type === 'tool' || it.type === 'utility')) return 'apply';
  if (isInventoryItemUsable(it)) return 'use';
  if (canApply) return 'apply';
  if (it.type === 'spell') return 'set-spell';
  return 'none';
}
