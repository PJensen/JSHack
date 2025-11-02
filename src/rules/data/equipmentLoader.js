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
  try {
    world.add(id, NamedIdentity, { name: base.name, identity: base.id });
  } catch {}
  try {
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
    };
    world.add(id, ItemInfo, info);
  } catch {}
  // Attach script reference when supplied (for onEquip/onHit, etc.)
  if (typeof base.script === 'function') {
    try { world.add(id, ScriptRef, { ref: base.script, params: { from: base.id } }); } catch {}
  }
  return id;
}

/**
 * equipmentPaletteEntries()
 * Produces a mapping suitable for display palettes keyed by identity.
 * Returns only visual fields (glyph, fg) and ignores gameplay data.
 * Intended to be consumed from app/display wiring, not rules.
 */
export function equipmentPaletteEntries() {
  const out = Object.create(null);
  for (const rec of Object.values(EQUIP_DEFS)) {
    const key = rec.id;
    if (!key) continue;
    const glyph = rec.glyph || '•';
    const fg = rec.color || '#cfe8ff';
    out[key] = { glyph, fg, glow: fg };
  }
  return out;
}
