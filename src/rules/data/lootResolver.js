// rules/data/lootResolver.js
// Loot table resolution engine.
// Resolves table IDs into drop descriptors, then materializes them as ECS entities.

import { LOOT_TABLES } from './lootTables.js';
import { AFFIX_DEFS } from './affixes.js';
import { getEquipmentDef } from './equipment.js';
import { getItem } from './items.js';
import { createFrom } from '../../lib/ecs-js/archetype.js';
import { buildEquipmentItem } from './equipmentLoader.js';
import { GoldStack, HealthPotion, ArrowsStack, ScrollOfMapping, MagicItem } from '../archetypes/Items.js';
import { Ration, IronRation } from '../archetypes/Food.js';
import { Position } from '../components/Position.js';
import { ItemInfo } from '../components/ItemInfo.js';

const MAX_NESTING = 5;

// Archetype name -> archetype object
const ARCHETYPE_MAP = {
  HealthPotion,
  GoldStack,
  ArrowsStack,
  ScrollOfMapping,
  Ration,
  IronRation,
};

// ── Resolution ──────────────────────────────────────────────────────

/**
 * Resolve a loot table into an array of abstract drop descriptors.
 * @param {string} tableId
 * @param {Object} rng - createRng() instance
 * @param {number} depth - current dungeon depth
 * @param {number} [nest=0] - recursion guard
 * @returns {Array<{kind:string, params:Object}>}
 */
export function resolveLootTable(tableId, rng, depth, nest = 0) {
  if (nest >= MAX_NESTING) return [];
  const table = LOOT_TABLES[tableId];
  if (!table) return [];

  const results = [];
  const rollCount = rng.int(table.rolls.min, table.rolls.max);

  for (let r = 0; r < rollCount; r++) {
    const entry = weightedPick(table.entries, rng);
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
        const affixes = rollAffixes(rng, equipId, entry.affixChance || 0, entry.affixCountMax || 1);
        results.push({ kind: "equip", params: { equipId, affixes } });
        break;
      }

      case "item":
        results.push({ kind: "item", params: { itemId: entry.itemId } });
        break;

      case "table": {
        const nested = resolveLootTable(entry.tableId, rng, depth, nest + 1);
        results.push(...nested);
        break;
      }
    }
  }

  return results;
}

/**
 * Weighted random pick from entries.
 * @param {Array} entries
 * @param {Object} rng
 * @returns {Object|null}
 */
function weightedPick(entries, rng) {
  const total = entries.reduce((s, e) => s + (e.weight || 0), 0);
  if (total <= 0) return null;
  let roll = rng.float(0, total);
  for (const entry of entries) {
    roll -= (entry.weight || 0);
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

  const def = getEquipmentDef(equipId);
  if (!def) return [];

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
      const id = buildEquipmentItem(world, drop.params.equipId, {
        affixes: drop.params.affixes || [],
      });
      world.add(id, Position, { x: pos.x, y: pos.y });
      return id;
    }

    case "item": {
      const def = getItem(drop.params.itemId);
      if (!def) return null;
      const id = createFrom(world, MagicItem, {
        name: def.name, identity: def.id,
        type: def.type, slot: def.slot, weight: 1, value: 0,
        description: def.description, count: def.charges || 1,
        rarity: def.rarity || 1, rarityName: def.rarityName || 'common',
      });
      world.add(id, Position, { x: pos.x, y: pos.y });
      return id;
    }

    default:
      return null;
  }
}

/**
 * Convenience: resolve a table and materialize all drops at a position.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {string} tableId
 * @param {Object} rng - createRng() instance
 * @param {number} depth
 * @param {{x:number, y:number}} pos
 * @returns {number[]} entity IDs created
 */
export function dropLoot(world, tableId, rng, depth, pos) {
  const drops = resolveLootTable(tableId, rng, depth);
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
