import { ActiveEffects } from "../components/ActiveEffects.js";
import { Brain } from "../components/Brain.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Potion } from "../components/Potion.js";
import { Vitality } from "../components/Vitality.js";
import { getSpell } from "../data/spells.js";
import { runSpellScript } from "../scripts/spells.js";

/**
 * Base helpers shared by first-class action contexts.
 */
export class RuleActionContext {
  /**
   * @param {import("../../lib/ecs-js/index.js").World} world
   */
  constructor(world) {
    this.world = world;
  }

  /**
   * @param {string} eventName
   * @param {Record<string, any>} payload
   */
  emit(eventName, payload) {
    try { this.world.emit && this.world.emit(eventName, payload); } catch {}
  }

  /**
   * @param {number} entityId
   * @returns {{ effects:any[] }|null}
   */
  ensureEffects(entityId) {
    let ae = /** @type any */ (this.world.get(entityId, ActiveEffects));
    if (ae && Array.isArray(ae.effects)) return ae;
    try { this.world.add(entityId, ActiveEffects, { effects: [] }); } catch {}
    ae = /** @type any */ (this.world.get(entityId, ActiveEffects));
    return ae && Array.isArray(ae.effects) ? ae : null;
  }

  /**
   * @param {number} entityId
   * @param {{ key:string, turnsLeft:number, potency:number, stacks?:number, sourceId?:number }} effect
   */
  pushEffect(entityId, effect) {
    const ae = this.ensureEffects(entityId);
    if (!ae) return false;
    const next = { stacks: 1, ...effect };
    ae.effects.push(next);
    return true;
  }

  /**
   * @param {number} entityId
   * @param {number} amount
   * @param {string} [source]
   * @returns {number}
   */
  damage(entityId, amount, source = "action") {
    const vit = /** @type any */ (this.world.get(entityId, Vitality));
    if (!vit) return 0;
    const dealt = Math.max(0, amount | 0);
    if (dealt <= 0) return 0;
    vit.hp = Math.max(0, (vit.hp | 0) - dealt);
    this.emit("damage", { id: entityId, amount: dealt, source });
    if ((vit.hp | 0) <= 0) this.emit("died", { id: entityId, cause: source });
    return dealt;
  }

  /**
   * @param {number} entityId
   * @param {number} amount
   * @returns {number}
   */
  heal(entityId, amount) {
    const vit = /** @type any */ (this.world.get(entityId, Vitality));
    if (!vit) return 0;
    const delta = Math.max(0, amount | 0);
    if (delta <= 0) return 0;
    const next = Math.min(vit.maxHp | 0, (vit.hp | 0) + delta);
    const healed = Math.max(0, next - (vit.hp | 0));
    vit.hp = next;
    return healed;
  }

  /**
   * @param {number} entityId
   * @returns {string}
   */
  getIdentity(entityId) {
    const ni = /** @type any */ (this.world.get(entityId, NamedIdentity));
    return String(ni?.identity || "");
  }
}

export class ItemUseActionContext extends RuleActionContext {
  /**
   * @param {{
   *   world: import("../../lib/ecs-js/index.js").World,
   *   actor: number,
   *   itemId: number,
   *   intent: { targetId?: number } | null,
   *   info: { type?:string, description?:string, count?:number } | null,
   *   identity: string,
   * }} init
   */
  constructor(init) {
    super(init.world);
    this.actor = init.actor | 0;
    this.itemId = init.itemId | 0;
    this.intent = init.intent || null;
    this.info = init.info || null;
    this.identity = String(init.identity || "").toLowerCase();
  }

  /**
   * @param {string} prefix
   */
  spellIdFromIdentity(prefix) {
    const normalizedPrefix = String(prefix || "").toLowerCase();
    if (!normalizedPrefix || !this.identity.startsWith(normalizedPrefix)) return "";
    return this.identity.slice(normalizedPrefix.length);
  }

  /**
   * @param {{ identityPrefix:string, targetMode?:"intentTarget"|"self"|"none", castEventSource?:string, consumeOnSuccess?:boolean }} opts
   */
  castSpellFromIdentity(opts) {
    const spellId = this.spellIdFromIdentity(opts.identityPrefix);
    if (!spellId) return false;
    const spell = getSpell(spellId);
    if (!spell) return false;
    const targetMode = String(opts?.targetMode || "self");
    const runIntent = targetMode === "intentTarget" ? { targetId: this.intent?.targetId } : {};
    try { runSpellScript(this.world, this.actor, spell, runIntent); } catch { return false; }
    const castEvent = {
      actor: this.actor,
      spellId: spell.id,
      targetId: targetMode === "intentTarget" ? (this.intent?.targetId || this.actor) : this.actor,
    };
    if (opts?.castEventSource) castEvent.source = opts.castEventSource;
    this.emit("castSpell", castEvent);
    return opts?.consumeOnSuccess !== false;
  }

  /**
   * @returns {{ learnedSpellIds?:string[] }|null}
   */
  ensureBrain() {
    let brain = /** @type any */ (this.world.get(this.actor, Brain));
    if (!brain) {
      try { this.world.add(this.actor, Brain, {}); } catch {}
      brain = /** @type any */ (this.world.get(this.actor, Brain));
    }
    return brain || null;
  }

  /**
   * @param {{ identityPrefix:string, consumeOnSuccess?:boolean }} opts
   */
  learnSpellFromIdentity(opts) {
    const spellId = this.spellIdFromIdentity(opts.identityPrefix);
    if (!spellId) return false;
    const spell = getSpell(spellId);
    if (!spell) {
      this.emit("spell:learn-denied", { actor: this.actor, reason: "unknown-spell", spellId });
      return false;
    }

    const brain = this.ensureBrain();
    if (!brain) {
      this.emit("spell:learn-denied", { actor: this.actor, reason: "no-brain", spellId: spell.id });
      return false;
    }
    if (!Array.isArray(brain.learnedSpellIds)) brain.learnedSpellIds = [];
    if (brain.learnedSpellIds.includes(spell.id)) {
      this.emit("spell:already-known", { actor: this.actor, spellId: spell.id });
      return false;
    }

    brain.learnedSpellIds.push(spell.id);
    this.emit("spell:learned", { actor: this.actor, spellId: spell.id });
    return opts?.consumeOnSuccess !== false;
  }
}

export class ItemApplyActionContext extends RuleActionContext {
  /**
   * @param {{
   *   world: import("../../lib/ecs-js/index.js").World,
   *   actor: number,
   *   toolId: number,
   *   targetId: number,
   * }} init
   */
  constructor(init) {
    super(init.world);
    this.actor = init.actor | 0;
    this.toolId = init.toolId | 0;
    this.targetId = init.targetId | 0;
  }

  /**
   * @returns {{items:number[]} | null}
   */
  getInventory() {
    return /** @type any */ (this.world.get(this.actor, Inventory));
  }

  /**
   * @returns {boolean}
   */
  hasBothItemsInInventory() {
    const inv = this.getInventory();
    if (!inv || !Array.isArray(inv.items)) return false;
    return inv.items.includes(this.toolId) && inv.items.includes(this.targetId);
  }

  /**
   * @param {number} entityId
   * @returns {{type?:string,description?:string,count?:number,bonuses?:any,affixes?:string[]}|null}
   */
  getItemInfo(entityId) {
    return /** @type any */ (this.world.get(entityId, ItemInfo));
  }

  /**
   * @param {number} entityId
   * @returns {string}
   */
  getItemType(entityId) {
    return String(this.getItemInfo(entityId)?.type || "");
  }

  /**
   * @returns {string}
   */
  getToolIdentity() {
    return this.getIdentity(this.toolId);
  }

  /**
   * @returns {string}
   */
  getTargetIdentity() {
    return this.getIdentity(this.targetId);
  }

  /**
   * Consume one use/dose of the tool item.
   * @returns {boolean}
   */
  consumeTool() {
    const inv = this.getInventory();
    if (!inv || !Array.isArray(inv.items)) return false;
    const idx = inv.items.indexOf(this.toolId);
    if (idx === -1) return false;

    const potion = /** @type any */ (this.world.get(this.toolId, Potion));
    if (potion && Number.isFinite(potion.doses) && (potion.doses | 0) > 1) {
      potion.doses = (potion.doses | 0) - 1;
      return true;
    }

    const info = this.getItemInfo(this.toolId);
    if (info && Number.isFinite(info.count) && (info.count | 0) > 1) {
      info.count = (info.count | 0) - 1;
      if (potion) potion.doses = 1;
      return true;
    }

    inv.items.splice(idx, 1);
    try { this.world.destroy(this.toolId); } catch {}
    return true;
  }
}

