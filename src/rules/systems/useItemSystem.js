import { UseIntent } from "../components/Intents/UseIntent.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Consumable } from "../components/Consumable.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Brain } from "../components/Brain.js";
import { ITEM_USE_DEFS } from "../data/itemUseDefs.js";
import { getSpell } from "../data/spells.js";
import { runSpellScript } from "../scripts/spells.js";
import { runScript, ScriptVerb } from "../scripting.js";
/** @typedef {import('../../lib/ecs-js/index.js').World} World */

/**
 * useItemSystem — resolves UseIntent for generic item use.
 * Supports:
 * - Consumable items with an effectKey dispatched via the scripting registry
 * - Data-driven behaviors from itemUseDefs (wands, scrolls, spellbooks)
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
 * @param {{type?:string}|null} info
 * @param {string} identity
 * @param {{itemTypes?:string[], identityPrefix?:string}} match
 */
function matchesUseDef(info, identity, match) {
  if (!match || typeof match !== "object") return false;
  const type = String(info?.type || "").toLowerCase();
  const normalizedIdentity = String(identity || "").toLowerCase();

  const itemTypes = Array.isArray(match.itemTypes)
    ? match.itemTypes.map((v) => String(v || "").toLowerCase()).filter(Boolean)
    : [];
  const identityPrefix = String(match.identityPrefix || "").toLowerCase();

  if (itemTypes.length > 0 && !itemTypes.includes(type)) return false;
  if (identityPrefix && !normalizedIdentity.startsWith(identityPrefix)) return false;

  return itemTypes.length > 0 || !!identityPrefix;
}

/**
 * @param {{type?:string}|null} info
 * @param {string} identity
 */
function findUseDef(info, identity) {
  for (let i = 0; i < ITEM_USE_DEFS.length; i++) {
    const def = ITEM_USE_DEFS[i];
    if (matchesUseDef(info, identity, def.match)) return def;
  }
  return null;
}

/**
 * @param {string} identity
 * @param {string} prefix
 */
function spellIdFromIdentity(identity, prefix) {
  const normalizedIdentity = String(identity || "").toLowerCase();
  const normalizedPrefix = String(prefix || "").toLowerCase();
  if (!normalizedPrefix || !normalizedIdentity.startsWith(normalizedPrefix)) return "";
  return normalizedIdentity.substring(normalizedPrefix.length);
}

/**
 * @param {World} world
 * @param {number} actor
 * @returns {{learnedSpellIds?:string[], intelligence?:number}|null}
 */
function ensureBrain(world, actor) {
  /** @type {{learnedSpellIds?:string[], intelligence?:number}|null} */
  let brain = /** @type any */ (world.get(actor, Brain));
  if (!brain) {
    try { world.add(actor, Brain, {}); } catch {}
    brain = /** @type any */ (world.get(actor, Brain));
  }
  return brain;
}

/**
 * @param {World} world
 * @param {number} actor
 * @param {{targetId?:number}|null} intent
 * @param {string} identity
 */
function createUseActionHelpers(world, actor, intent, identity) {
  return {
    /**
     * @param {{ identityPrefix:string, targetMode?:"intentTarget"|"self"|"none", castEventSource?:string, consumeOnSuccess?:boolean }} action
     */
    castSpellFromIdentity(action) {
      const consumeOnSuccess = action.consumeOnSuccess !== false;
      const spellId = spellIdFromIdentity(identity, String(action.identityPrefix || ""));
      if (!spellId) return false;
      const spell = getSpell(spellId);
      if (!spell) return false;

      const targetMode = String(action.targetMode || "self");
      const runIntent = targetMode === "intentTarget" ? { targetId: intent?.targetId } : {};
      try { runSpellScript(world, actor, spell, runIntent); } catch {}

      const castEvent = {
        actor,
        spellId: spell.id,
        targetId: targetMode === "intentTarget" ? (intent?.targetId || actor) : actor,
      };
      if (action.castEventSource) castEvent.source = action.castEventSource;
      try { world.emit && world.emit("castSpell", castEvent); } catch {}
      return consumeOnSuccess;
    },

    /**
     * @param {{ identityPrefix:string, consumeOnSuccess?:boolean }} action
     */
    learnSpellFromIdentity(action) {
      const consumeOnSuccess = action.consumeOnSuccess !== false;
      const spellId = spellIdFromIdentity(identity, String(action.identityPrefix || ""));
      if (!spellId) return false;
      const spell = getSpell(spellId);
      if (!spell) {
        try { world.emit && world.emit("spell:learn-denied", { actor, reason: "unknown-spell", spellId }); } catch {}
        return false;
      }

      const brain = ensureBrain(world, actor);
      if (!brain) {
        try { world.emit && world.emit("spell:learn-denied", { actor, reason: "no-brain", spellId: spell.id }); } catch {}
        return false;
      }
      if (Array.isArray(brain.learnedSpellIds) && brain.learnedSpellIds.includes(spell.id)) {
        try { world.emit && world.emit("spell:already-known", { actor, spellId: spell.id }); } catch {}
        return false;
      }

      if (!Array.isArray(brain.learnedSpellIds)) brain.learnedSpellIds = [];
      brain.learnedSpellIds.push(spell.id);
      try { world.emit && world.emit("spell:learned", { actor, spellId: spell.id }); } catch {}
      return consumeOnSuccess;
    },

    /**
     * @param {string} eventName
     * @param {Record<string, any>} payload
     */
    emit(eventName, payload) {
      try { world.emit && world.emit(eventName, payload); } catch {}
    },
  };
}

/**
 * @param {(context:any) => boolean} action
 * @param {any} context
 */
function executeUseAction(action, context) {
  if (typeof action !== "function") return false;
  try {
    const out = action(context);
    if (typeof out === "boolean") return out;
    if (out && typeof out === "object" && typeof out.consumed === "boolean") return out.consumed;
  } catch {}
  return false;
}

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
    /** @type {{effectKey?:string, effectParams?:object, remainingUses?:number}|null} */
    const cons = /** @type any */ (world.get(itemId, Consumable));
    const identity = String(ni?.identity || "").toLowerCase();

    let consumed = false;

    // Path 1: consumable with a scripting-registry effectKey
    if (cons && cons.effectKey) {
      try { runScript(cons.effectKey, ScriptVerb.ItemUse, world, { actor, itemId, params: { ...cons.effectParams } }); } catch {}
      consumed = true;
    } else if (info) {
      const def = findUseDef(info, identity);
      if (def) {
        const helpers = createUseActionHelpers(world, actor, intent, identity);
        consumed = executeUseAction(def.action, {
          world,
          actor,
          itemId,
          intent,
          info,
          identity,
          helpers,
        });
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
      try { world.emit && world.emit("item:used", { actor, itemId }); } catch {}
    }

    // clear intent
    world.remove(actor, UseIntent);
  }
}
