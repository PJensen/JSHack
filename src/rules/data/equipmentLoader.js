// rules/data/equipmentLoader.js
// Data-driven helpers to construct equipment items and integrate affixes.
// This stays rules-side and produces pure ECS items (no visuals),
// leaving glyph/color usage to app/display.

import { EQUIP_DEFS, getEquipmentDef } from './equipment.js';
import { AFFIX_DEFS } from './affixes.js';
import { ItemInfo } from '../components/ItemInfo.js';
import { NamedIdentity } from '../components/NamedIdentity.js';
import { ScriptRef } from '../components/ScriptRef.js';

/**
 * listEquipment()
 * @returns {Array<{id:string, name:string, slot:string, rarity:number, rarityName:string, bonuses?:object}>}
 */
export function listEquipment() { return Object.values(EQUIP_DEFS); }

/**
 * buildEquipmentItem(world, equipId, opts?)
 * Creates an item entity in the world from a base equipment definition.
 * - Adds NamedIdentity (identity = equipId) and ItemInfo with type 'equip' and slot info
 * - Optionally attaches ScriptRef if base definition contains a script function
 * - Does not set Position; caller should place it
 */
export function buildEquipmentItem(world, equipId, opts = {}) {
  const base = getEquipmentDef(equipId);
  if (!base) throw new Error(`Unknown equipment id: ${equipId}`);
  const id = world.create();
  world.add(id, NamedIdentity, { name: base.name, identity: base.id });
  const info = {
    type: 'equip',
    slot: base.slot || '',
    weight: Number(base.weight || 1),
    value: Number(base.value || 0),
    description: base.desc || base.name || '',
    count: 1,
    // Carry bonuses and rarity on the item record to enable future systems to derive effects
    bonuses: base.bonuses || {},
    rarity: base.rarity || 1,
    rarityName: base.rarityName || 'common',
    affixes: Array.isArray(opts.affixes) ? opts.affixes.slice() : [],
    damageDice: base.damageDice || null,
    subtype: base.subtype || null,
    range: base.range || null,
  };
  world.add(id, ItemInfo, info);
  // Attach script reference when supplied (for onEquip/onHit, etc.)
  if (typeof base.script === 'function') {
    world.add(id, ScriptRef, { ref: base.script, params: { from: base.id } });
  }
  return id;
}
