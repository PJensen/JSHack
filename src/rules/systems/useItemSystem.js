import { UseIntent } from "../components/Intents/UseIntent.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Consumable } from "../components/Consumable.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Brain } from "../components/Brain.js";
import { getSpell } from "../data/spells.js";
import { runSpellScript } from "../scripts/spells.js";
/** @typedef {import('../../lib/ecs-js/index.js').World} World */

/**
 * useItemSystem — resolves UseIntent for generic item use.
 * Supports:
 * - Consumable items with a useEffect(world, actor, item) function
 * - Learning spells from items of kind "learn" (e.g., spellbooks)
 *
 * Semantics:
 * - The item must be present in the actor's Inventory
 * - When consumed, reduce stack count (ItemInfo.count) or destroy if single
 * - Emits events:
 *   - 'item:used' { actor, itemId }
 *   - 'spell:learned' { actor, spellId }
 *   - 'spell:learn-denied' { actor, reason, spellId? }
 *   - 'spell:already-known' { actor, spellId }
 */
/**
 * @param {World} world
 */
export function useItemSystem(world) {
  for (const [actor, intent] of world.query(UseIntent)) {
    const itemId = intent.itemId | 0;
    if (!(itemId > 0)) { world.remove(actor, UseIntent); continue; }

  /** @type {{items:number[]}|null} */
  const inv = /** @type any */ (world.get(actor, Inventory));
    if (!inv || !Array.isArray(inv.items)) { world.remove(actor, UseIntent); continue; }

    // ensure item is in inventory
    const idx = inv.items.indexOf(itemId);
    if (idx === -1) { world.remove(actor, UseIntent); continue; }

  /** @type {{type?:string, description?:string, count?:number}|null} */
  const info = /** @type any */ (world.get(itemId, ItemInfo));
  /** @type {{identity?:string}|null} */
  const ni = /** @type any */ (world.get(itemId, NamedIdentity));
  /** @type {{useEffect?:(w:any,a:number,i:number)=>void, remainingUses?:number}|null} */
  const cons = /** @type any */ (world.get(itemId, Consumable));

    let consumed = false;
    let learnedSpellId = null;

    // Path 1: explicit consumable with useEffect
    if (cons && typeof cons.useEffect === 'function') {
      try { cons.useEffect(world, actor, itemId); } catch {}
      // By default, consumables are consumed on use
      consumed = true;
    } else if (info && (info.type === 'learn' || info.type === 'scroll' || info.type === 'wand' || info.type === 'book')) {
      const identity = (ni?.identity || '').toLowerCase();

      // Path 2a: WANDS fire spell from charges, no mana cost, auto-targets like bow
      if (info.type === 'wand') {
        const spellIdFromId = identity.startsWith('wand_') ? identity.substring('wand_'.length) : '';
        const spell = getSpell(spellIdFromId);
        if (!spell) { world.remove(actor, UseIntent); continue; }
        try { runSpellScript(world, actor, spell, { targetId: intent.targetId }); } catch {}
        try { world.emit && world.emit('castSpell', { actor, spellId: spell.id, targetId: intent.targetId || actor, source: 'wand' }); } catch {}
        consumed = true;

      // Path 2b: SCROLLS cast directly without knowledge/mana requirements
      } else if (info.type === 'scroll' || identity.startsWith('scroll_')) {
        const spellIdFromId = identity.startsWith('scroll_') ? identity.substring('scroll_'.length) : '';
        const spell = getSpell(spellIdFromId);
        if (!spell) { world.remove(actor, UseIntent); continue; }
        try { runSpellScript(world, actor, spell, {}); } catch {}
        try { world.emit && world.emit('castSpell', { actor, spellId: spell.id, targetId: actor }); } catch {}
        consumed = true;
      } else {
        // Path 2c: learning from a spellbook-like item
        if (identity.startsWith('book_')) {
          learnedSpellId = identity.substring('book_'.length);
        }
        if (!learnedSpellId) { world.remove(actor, UseIntent); continue; }

        const spell = getSpell(learnedSpellId);
        if (!spell) { world.emit && world.emit('spell:learn-denied', { actor, reason: 'unknown-spell', spellId: learnedSpellId }); world.remove(actor, UseIntent); continue; }

        /** @type {{learnedSpellIds?:string[], intelligence?:number}|null} */
        let brain = /** @type any */ (world.get(actor, Brain));
        if (!brain) { try { world.add(actor, Brain, {}); brain = world.get(actor, Brain); } catch {} }
        if (!brain) { world.emit && world.emit('spell:learn-denied', { actor, reason: 'no-brain', spellId: spell.id }); world.remove(actor, UseIntent); continue; }

        // already known
        if (Array.isArray(brain.learnedSpellIds) && brain.learnedSpellIds.includes(spell.id)) {
          try { world.emit && world.emit('spell:already-known', { actor, spellId: spell.id }); } catch {}
          world.remove(actor, UseIntent);
          continue;
        }

        // learn
        if (!Array.isArray(brain.learnedSpellIds)) brain.learnedSpellIds = [];
        brain.learnedSpellIds.push(spell.id);
        try { world.emit && world.emit('spell:learned', { actor, spellId: spell.id }); } catch {}
        consumed = true;
      }
    }

    // If consumed, decrement stack or destroy and remove from inventory
    if (consumed) {
  if (info && Number.isFinite(info?.count) && (info?.count ?? 0) > 1) {
        world.mutate(itemId, ItemInfo, /** @param {any} r */ (r) => { r.count = (r.count | 0) - 1; });
      } else {
        // remove from inventory list first to avoid dangling id
        if (idx >= 0) inv.items.splice(idx, 1);
        try { world.destroy(itemId); } catch {}
      }
      try { world.emit && world.emit('item:used', { actor, itemId }); } catch {}
    }

    // clear intent
    world.remove(actor, UseIntent);
  }
}
