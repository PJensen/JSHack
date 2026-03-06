// rules/data/lootResolver.js
// Loot table resolution engine.
// Resolves table IDs into drop descriptors, then materializes them as ECS entities.

import { LOOT_TABLES } from './lootTables.js';
import { AFFIX_DEFS } from './affixes.js';
import { getCatalogItem, isCatalogEquipment } from './itemCatalog.js';
import { getGem, pickGem } from './gems.js';
import { createFrom } from '../../lib/ecs-js/archetype.js';
import { buildCatalogItem } from './itemCatalogLoader.js';
import { GoldStack, HealthPotion, ArrowsStack, ScrollOfMapping, GemItem } from '../archetypes/Items.js';
import { Ration, IronRation, WildBerries, WildHerbs } from '../archetypes/Food.js';
import { Position } from '../components/Position.js';
import { ItemInfo } from '../components/ItemInfo.js';
import { Brain } from '../components/Brain.js';
import { Player } from '../components/Player.js';
import { Inventory } from '../components/Inventory.js';
import { inventoryItems } from '../utils/inventoryFacade.js';

const MAX_NESTING = 5;

// Archetype name -> archetype object
const ARCHETYPE_MAP = {
  HealthPotion,
  GoldStack,
  ArrowsStack,
  ScrollOfMapping,
  Ration,
  IronRation,
  WildBerries,
  WildHerbs,
};

// ── Resolution ──────────────────────────────────────────────────────

/**
 * Resolve a loot table into an array of abstract drop descriptors.
 * @param {string} tableId
 * @param {Object} rng - createRng() instance
 * @param {number} depth - current dungeon depth
 * @param {number} [nest=0] - recursion guard
 * @param {Object} [opts] - optional context
 * @param {ReadonlySet<string>} [opts.knownSpells] - spells the player already knows (weight → 0)
 * @returns {Array<{kind:string, params:Object}>}
 */
export function resolveLootTable(tableId, rng, depth, nest = 0, opts) {
  if (nest >= MAX_NESTING) return [];
  const table = LOOT_TABLES[tableId];
  if (!table) return [];

  const results = [];
  const rollCount = rng.int(table.rolls.min, table.rolls.max);
  
  // Chest tables enforce max 1 weapon rule
  const isChest = tableId.startsWith("chest:");
  let weaponCount = 0;

  for (let r = 0; r < rollCount; r++) {
    const entry = weightedPick(table.entries, rng, opts);
    if (!entry) continue;

    switch (entry.type) {
      case "nothing":
        break;

      case "gold": {
        const base = (entry.count.base || 0) + depth * (entry.count.perDepth || 0);
        const count = Math.max(1, Math.round(base * (0.8 + rng.float(0, 0.4))));
        results.push({ kind: "gold", params: { count } });
        break;
      }

      case "archetype":
        results.push({ kind: "archetype", params: { archetype: entry.archetype } });
        break;

      case "equip": {
        const equipId = rng.choice(entry.pool);
        if (!equipId) break;
        
        // Check weapon limit for chests
        if (isChest) {
          const def = getCatalogItem(equipId);
          if (def && def.slot === "weapon") {
            if (weaponCount >= 1) break; // Skip this weapon
            weaponCount++;
          }
        }
        
        const affixes = rollAffixes(rng, equipId, entry.affixChance || 0, entry.affixCountMax || 1);
        results.push({ kind: "equip", params: { equipId, affixes } });
        break;
      }

      case "item":
        results.push({ kind: "item", params: { itemId: entry.itemId } });
        break;

      case "gem": {
        const gem = entry.gemId ? getGem(entry.gemId) : pickGem(rng, entry.materials ? { materials: entry.materials } : {});
        if (gem) results.push({ kind: "gem", params: { gemId: gem.id } });
        break;
      }

      case "table": {
        const nested = resolveLootTable(entry.tableId, rng, depth, nest + 1, opts);
        results.push(...nested);
        break;
      }
    }
  }

  return results;
}

/**
 * Return effective weight for an entry, accounting for:
 * - known-spell suppression (spellbook entries)
 * - on_loot_roll catalog hooks (e.g. scroll_homecoming suppressed when player has hearthstone)
 * @param {Object} entry
 * @param {any} [opts]
 * @returns {number}
 */
function effectiveWeight(entry, opts) {
  const w = entry.weight || 0;
  if (w <= 0) return 0;
  if (entry.type !== "item") return w;
  const id = entry.itemId || "";

  // Spellbook suppression: books for already-known spells weight → 0
  if (opts?.knownSpells && id.startsWith("book_")) {
    const spellId = id.slice(5); // strip "book_" prefix
    if (opts.knownSpells.has(spellId)) return 0;
  }

  // on_loot_roll hook: catalog item may veto its own appearance
  if (opts?.playerItemIds) {
    const def = getCatalogItem(id);
    const hook = def?.hooks?.on_loot_roll;
    if (typeof hook === "function") {
      try {
        const result = hook({ playerItemIds: opts.playerItemIds }, { itemId: id });
        if (result?.cancel) return 0;
      } catch { /* ignore hook errors */ }
    }
  }

  return w;
}

/**
 * Weighted random pick from entries.
 * @param {Array} entries
 * @param {Object} rng
 * @param {Object} [opts] - passed to effectiveWeight for known-spell filtering
 * @returns {Object|null}
 */
function weightedPick(entries, rng, opts) {
  const total = entries.reduce((s, e) => s + effectiveWeight(e, opts), 0);
  if (total <= 0) return null;
  let roll = rng.float(0, total);
  for (const entry of entries) {
    roll -= effectiveWeight(entry, opts);
    if (roll <= 0) return entry;
  }
  return entries[entries.length - 1];
}

// ── Affix rolling ───────────────────────────────────────────────────

/**
 * Roll affixes for equipment. Filters by slot, uses AFFIX_DEFS.weight,
 * no duplicate affixes per item.
 * @param {Object} rng
 * @param {string} equipId
 * @param {number} affixChance - 0.0 to 1.0
 * @param {number} maxCount
 * @returns {string[]} affix IDs
 */
function rollAffixes(rng, equipId, affixChance, maxCount) {
  if (rng.next() >= affixChance) return [];

  const def = getCatalogItem(equipId);
  if (!def || !isCatalogEquipment(def)) return [];

  // Map equipment slot to affix slot: shield -> armor for affix purposes
  const slot = def.slot === 'shield' ? 'armor' : def.slot;

  const eligible = Object.entries(AFFIX_DEFS)
    .filter(([, affix]) => affix.slots.includes(slot))
    .map(([id, affix]) => ({ id, weight: affix.weight }));

  if (eligible.length === 0) return [];

  const count = rng.int(1, Math.min(maxCount, eligible.length));
  const selected = [];
  const remaining = [...eligible];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const total = remaining.reduce((s, e) => s + e.weight, 0);
    let roll = rng.float(0, total);
    let idx = remaining.length - 1;
    for (let j = 0; j < remaining.length; j++) {
      roll -= remaining[j].weight;
      if (roll <= 0) { idx = j; break; }
    }
    selected.push(remaining[idx].id);
    remaining.splice(idx, 1);
  }

  return selected;
}

// ── Materialization ─────────────────────────────────────────────────

/**
 * Create an ECS entity from a drop descriptor at a position.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {{kind:string, params:Object}} drop
 * @param {{x:number, y:number}} pos
 * @returns {number|null} entity ID
 */
export function materializeDrop(world, drop, pos) {
  switch (drop.kind) {
    case "gold": {
      const id = createFrom(world, GoldStack, {});
      world.add(id, Position, { x: pos.x, y: pos.y });
      world.mutate(id, ItemInfo, r => { r.count = drop.params.count; });
      return id;
    }

    case "archetype": {
      const arch = ARCHETYPE_MAP[drop.params.archetype];
      if (!arch) return null;
      const id = createFrom(world, arch, {});
      world.add(id, Position, { x: pos.x, y: pos.y });
      return id;
    }

    case "equip": {
      const id = buildCatalogItem(world, drop.params.equipId, {
        affixes: drop.params.affixes || [],
      });
      world.add(id, Position, { x: pos.x, y: pos.y });
      return id;
    }

    case "gem": {
      const gem = getGem(drop.params.gemId);
      if (!gem) return null;
      const id = createFrom(world, GemItem, {
        name: gem.name, identity: gem.id,
        weight: gem.weight, value: gem.value,
        description: gem.appearance,
      });
      world.add(id, Position, { x: pos.x, y: pos.y });
      return id;
    }

    case "item": {
      let id = null;
      try { id = buildCatalogItem(world, drop.params.itemId); } catch { return null; }
      if (!(id > 0)) return null;
      world.add(id, Position, { x: pos.x, y: pos.y });
      return id;
    }

    default:
      return null;
  }
}

/**
 * Build a Set of item identities the player currently carries.
 * Used to suppress loot rolls via on_loot_roll hooks.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @returns {Set<string>|null}
 */
function getPlayerItemIdentities(world) {
  for (const [id] of world.query(Player)) {
    const ids = new Set();
    for (const itemEid of inventoryItems(world, id)) {
      const info = /** @type {any} */ (world.get(itemEid, ItemInfo));
      if (info?.identity) ids.add(String(info.identity));
    }
    return ids;
  }
  return null;
}

/**
 * Build a Set of spell IDs the player currently knows.
 * Returns null if no player or no Brain component is found.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @returns {Set<string>|null}
 */
function getPlayerKnownSpells(world) {
  for (const [id] of world.query(Player)) {
    const brain = world.get(id, Brain);
    if (brain && Array.isArray(brain.learnedSpellIds) && brain.learnedSpellIds.length > 0) {
      return new Set(brain.learnedSpellIds);
    }
    return null;
  }
  return null;
}

/**
 * Convenience: resolve a table and materialize all drops at a position.
 * Known spells are automatically suppressed from spellbook drops.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {string} tableId
 * @param {Object} rng - createRng() instance
 * @param {number} depth
 * @param {{x:number, y:number}} pos
 * @returns {number[]} entity IDs created
 */
export function dropLoot(world, tableId, rng, depth, pos) {
  const knownSpells = getPlayerKnownSpells(world);
  const playerItemIds = getPlayerItemIdentities(world);
  const opts = (knownSpells || playerItemIds) ? {
    knownSpells: knownSpells ?? undefined,
    playerItemIds: playerItemIds ?? undefined,
  } : undefined;
  const drops = resolveLootTable(tableId, rng, depth, 0, opts);
  const ids = [];
  for (const drop of drops) {
    const eid = materializeDrop(world, drop, pos);
    if (eid != null) {
      ids.push(eid);
      try { world.emit && world.emit('item:dropped', { itemId: eid, count: 1, at: { x: pos.x, y: pos.y } }); } catch { /* */ }
    }
  }
  return ids;
}
