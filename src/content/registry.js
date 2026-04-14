// src/content/registry.js
// Central content registry. All defineItem() / defineMonster() calls
// register their compiled outputs here. installContent() reads from here
// and wires everything into the existing engine registries.

/** @type {Map<string, object>} id → compiled catalog-compatible item def */
const _items = new Map();

/** @type {Map<string, object>} id → compiled MonsterDef-compatible object */
const _monsters = new Map();

/** @type {Map<string, { glyph: string, fg: string, glow?: string, baseScale?: number }>} */
const _palettes = new Map();

// ── Items ──────────────────────────────────────────────────────────

export function registerItem(id, compiledDef) {
  if (_items.has(id)) {
    throw new Error(`[content] Duplicate item definition: "${id}"`);
  }
  _items.set(id, compiledDef);
}

export function getContentItem(id) { return _items.get(id) || null; }
export function allContentItems() { return _items; }

// ── Monsters ───────────────────────────────────────────────────────

export function registerMonster(id, compiledDef) {
  if (_monsters.has(id)) {
    throw new Error(`[content] Duplicate monster definition: "${id}"`);
  }
  _monsters.set(id, compiledDef);
}

export function getContentMonster(id) { return _monsters.get(id) || null; }
export function allContentMonsters() { return _monsters; }

// ── Palette ────────────────────────────────────────────────────────

export function registerPalette(identity, entry) {
  _palettes.set(identity, entry);
}

export function allContentPalettes() { return _palettes; }

// ── Testing ────────────────────────────────────────────────────────

/** Reset all registries. Test-only. */
export function clearContentRegistry() {
  _items.clear();
  _monsters.clear();
  _palettes.clear();
}
