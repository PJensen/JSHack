import { Inventory } from "../../components/Inventory.js";
import { ItemInfo } from "../../components/ItemInfo.js";
import { NamedIdentity } from "../../components/NamedIdentity.js";
import { runSpellScript } from "../../scripts/spells.js";
import { runScript } from "../../scripting.js";
import { combatSeed, mulberry32 } from "../../utils/rng.js";

/**
 * @param {string} text
 * @returns {number}
 */
function hashText32(text) {
  let h = 0x811c9dc5;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * @param {number} seed
 */
function createDeterministicRng(seed) {
  const nextFn = mulberry32(seed >>> 0);
  return Object.freeze({
    next() {
      return nextFn();
    },
    int(min, max) {
      const lo = Math.min(min | 0, max | 0);
      const hi = Math.max(min | 0, max | 0);
      return lo + Math.floor(nextFn() * (hi - lo + 1));
    },
    chance(pct) {
      const n = Number(pct || 0);
      if (!(n > 0)) return false;
      return nextFn() * 100 < n;
    },
    fork(salt = 0) {
      const forkSeed = ((seed >>> 0) ^ (Number(salt) >>> 0)) >>> 0;
      return createDeterministicRng(forkSeed);
    },
  });
}

/**
 * @param {{
 *   world: import("../../../lib/ecs-js/index.js").World,
 *   tx: import("../../utils/actionContexts.js").RuleActionContext,
 *   actor: number,
 *   primary: number,
 *   target: number,
 *   verb: string,
 *   eventBuffer: Array<{ event: string, payload: Record<string, unknown> }>,
 *   breadcrumbs: Array<{ step: string, data?: unknown }>,
 *   warnings: Array<{ code: string, detail?: unknown }>,
 * }} init
 */
export function createFacets(init) {
  const { world, tx, actor, primary, target, verb, eventBuffer, breadcrumbs, warnings } = init;
  const rngSeed = combatSeed(world.seed >>> 0, world.step | 0, actor | 0, primary | 0, (target | 0) ^ hashText32(verb));
  const rng = createDeterministicRng(rngSeed);

  const query = Object.freeze({
    alive(entityId) {
      return world.isAlive(entityId | 0);
    },
    has(entityId, Comp) {
      return world.has(entityId | 0, Comp);
    },
    get(entityId, Comp) {
      return world.get(entityId | 0, Comp);
    },
    inventory(entityId) {
      return /** @type any */ (world.get(entityId | 0, Inventory));
    },
    itemInfo(entityId) {
      return /** @type any */ (world.get(entityId | 0, ItemInfo));
    },
    identity(entityId) {
      const ni = /** @type any */ (world.get(entityId | 0, NamedIdentity));
      return String(ni?.identity || "");
    },
    name(entityId) {
      const ni = /** @type any */ (world.get(entityId | 0, NamedIdentity));
      return String(ni?.name || "");
    },
  });

  const mutate = Object.freeze({
    damage(entityId, amount, source = "interaction") {
      return tx.damage(entityId | 0, amount | 0, source);
    },
    heal(entityId, amount) {
      return tx.heal(entityId | 0, amount | 0);
    },
    pushEffect(entityId, effect) {
      return tx.pushEffect(entityId | 0, effect);
    },
    consume(itemId, ownerId) {
      return tx.queueMutation({
        type: "consume",
        entityId: itemId | 0,
        inventoryOwnerId: ownerId | 0,
      });
    },
    appendDamageChannels(entityId, channels) {
      return tx.queueMutation({
        type: "appendDamageChannels",
        entityId: entityId | 0,
        channels: Array.isArray(channels) ? channels.map((c) => ({ ...c })) : [],
      });
    },
    upsertTimedEffect(entityId, effect) {
      return tx.queueMutation({
        type: "upsertTimedEffect",
        entityId: entityId | 0,
        effect: { ...effect },
      });
    },
    patchItemInfo(entityId, patch) {
      return tx.queueMutation({
        type: "patchItemInfo",
        entityId: entityId | 0,
        patch: (patch && typeof patch === "object") ? { ...patch } : {},
      });
    },
    learnSpell(entityId, spellId) {
      return tx.queueMutation({
        type: "learnSpell",
        entityId: entityId | 0,
        spellId: String(spellId || ""),
      });
    },
    destroy(entityId) {
      return tx.queueMutation({ type: "destroy", entityId: entityId | 0 });
    },
    queue(op) {
      return tx.queueMutation(op);
    },
  });

  const io = Object.freeze({
    emit(event, payload = {}) {
      eventBuffer.push({
        event: String(event || ""),
        payload: /** @type any */ ({ ...payload }),
      });
      return true;
    },
    message(text, type = "system") {
      eventBuffer.push({
        event: "message",
        payload: { text: String(text || ""), type: String(type || "system") },
      });
      return true;
    },
  });

  const audit = Object.freeze({
    breadcrumb(step, data) {
      breadcrumbs.push({ step: String(step || "step"), data });
      return true;
    },
    warn(code, detail) {
      warnings.push({ code: String(code || "warning"), detail });
      return true;
    },
  });

  const rules = Object.freeze({
    hasItemInInventory(ownerId, itemId) {
      const inv = /** @type any */ (world.get(ownerId | 0, Inventory));
      return !!(inv && Array.isArray(inv.items) && inv.items.includes(itemId | 0));
    },
    resolveTarget(defaultId) {
      const preferred = target | 0;
      if (preferred > 0 && world.isAlive(preferred)) return preferred;
      return defaultId | 0;
    },
    runScript(ref, scriptVerb, context = {}) {
      return runScript(
        ref,
        String(scriptVerb || ""),
        world,
        (context && typeof context === "object") ? { ...context } : {},
      );
    },
    runSpell(actorId, spell, intent = {}) {
      runSpellScript(
        world,
        actorId | 0,
        spell,
        (intent && typeof intent === "object") ? { ...intent } : {},
      );
      return true;
    },
  });

  return { query, mutate, io, audit, rules, rng };
}
