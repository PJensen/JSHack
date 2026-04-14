// src/content/install.js
// Wires all DSL-registered content into the existing engine registries.
// Call installContent() once at game startup, after all content files
// have been imported (so their defineItem/defineMonster calls have run).

import { allContentItems, allContentMonsters, allContentPalettes } from './registry.js';
import { registerCatalogItem } from '../rules/data/itemCatalog.js';
import { registerMonsterDef } from '../rules/data/monsters.js';
import { registerPaletteEntries } from '../display/palette/base.js';

/**
 * Install all DSL-defined content into the engine's existing registries.
 * Safe to call multiple times (idempotent per id — skips already-registered).
 */
export function installContent() {
  // ── Items → unified catalog ───────────────────────────────────
  for (const [id, def] of allContentItems()) {
    registerCatalogItem(id, def);
  }

  // ── Monsters → monster registry ───────────────────────────────
  for (const [_id, def] of allContentMonsters()) {
    registerMonsterDef(def);
  }

  // ── Palette entries ───────────────────────────────────────────
  const paletteEntries = {};
  for (const [identity, entry] of allContentPalettes()) {
    paletteEntries[identity] = entry;
  }
  if (Object.keys(paletteEntries).length > 0) {
    registerPaletteEntries(paletteEntries);
  }
}
