import { Inventory } from "../../components/Inventory.js";
import { ItemInfo } from "../../components/ItemInfo.js";
import { NamedIdentity } from "../../components/NamedIdentity.js";
import { Position } from "../../components/Position.js";
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
 * @param {string} expr
 * @returns {{ count: number, sides: number, mod: number } | null}
 */
function parseDiceExpression(expr) {
  const src = String(expr || "").trim().toLowerCase();
  const match = /^(\d+)d(\d+)([+-]\d+)?$/.exec(src);
  if (!match) return null;
  const count = Math.max(1, Number(match[1]) | 0);
  const sides = Math.max(1, Number(match[2]) | 0);
  const mod = Number(match[3] || 0) | 0;
  return { count, sides, mod };
}

/**
 * @param {string} expr
 * @param {{ int: (min: number, max: number) => number }} localRng
 */
function rollDiceExpression(expr, localRng) {
  const parsed = parseDiceExpression(expr);
  if (!parsed) return 0;
  let total = parsed.mod;
  for (let i = 0; i < parsed.count; i++) {
    total += localRng.int(1, parsed.sides);
  }
  return total;
}

/**
 * @param {number} probability
 */
function normalizeChanceInput(probability) {
  const p = Number(probability || 0);
  if (!(p > 0)) return 0;
  if (p <= 1) return p * 100;
  return p;
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
    setMaterial(entityId, kind) {
      return tx.queueMutation({
        type: "setMaterial",
        entityId: entityId | 0,
        kind: String(kind || ""),
      });
    },
    spawnItem(itemId, x, y, opts = {}) {
      const options = (opts && typeof opts === "object") ? opts : {};
      return tx.queueMutation({
        type: "spawnItem",
        itemId: String(itemId || ""),
        x: Number(x),
        y: Number(y),
        count: Number(options.count || 0) | 0,
        affixes: Array.isArray(options.affixes) ? options.affixes.slice() : [],
        ownerId: Number(options.ownerId || 0) | 0,
        material: String(options.material || ""),
        patchItemInfo: (options.patchItemInfo && typeof options.patchItemInfo === "object")
          ? { ...options.patchItemInfo }
          : {},
        emitEvent: options.emitEvent !== false,
      });
    },
    spawnMonster(monsterId, x, y, opts = {}) {
      const options = (opts && typeof opts === "object") ? opts : {};
      return tx.queueMutation({
        type: "spawnMonster",
        monsterId: String(monsterId || ""),
        x: Number(x),
        y: Number(y),
        name: String(options.name || ""),
        faction: String(options.faction || "enemy"),
        maxHp: Number(options.maxHp),
        attackDerived: Number(options.attackDerived),
        defenseDerived: Number(options.defenseDerived),
        naturalDamageDice: String(options.naturalDamageDice || ""),
        sizeClass: String(options.sizeClass || ""),
        massKg: Number(options.massKg),
        resistances: (options.resistances && typeof options.resistances === "object")
          ? { ...options.resistances }
          : null,
        speed: Number(options.speed),
        tauntMessage: String(options.tauntMessage || ""),
        emitEvent: options.emitEvent !== false,
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

  const fx = Object.freeze({
    chance(probability) {
      return rng.chance(normalizeChanceInput(probability));
    },
    int(min, max) {
      return rng.int(min, max);
    },
    roll(diceExpr) {
      return rollDiceExpression(String(diceExpr || ""), rng);
    },
    pick(values, fallback = null) {
      if (!Array.isArray(values) || values.length <= 0) return fallback;
      return values[rng.int(0, values.length - 1)];
    },
    pickWeighted(entries, fallback = null) {
      if (!Array.isArray(entries) || entries.length <= 0) return fallback;
      let total = 0;
      for (let i = 0; i < entries.length; i++) {
        total += Math.max(0, Number(entries[i]?.weight || 0));
      }
      if (!(total > 0)) return fallback;
      let n = rng.next() * total;
      for (let i = 0; i < entries.length; i++) {
        const w = Math.max(0, Number(entries[i]?.weight || 0));
        if (w <= 0) continue;
        n -= w;
        if (n <= 0) return entries[i]?.value ?? fallback;
      }
      return entries[entries.length - 1]?.value ?? fallback;
    },
    damage(entityId, amount, source = "interaction") {
      return mutate.damage(entityId, amount, source);
    },
    heal(entityId, amount) {
      return mutate.heal(entityId, amount);
    },
    addEffect(entityId, effect) {
      return mutate.upsertTimedEffect(entityId, effect);
    },
    patchItemInfo(entityId, patch) {
      return mutate.patchItemInfo(entityId, patch);
    },
    setMaterial(entityId, kind) {
      return mutate.setMaterial(entityId, kind);
    },
    consume(itemId = primary, ownerId = actor) {
      return mutate.consume(itemId, ownerId);
    },
    adjacentPoint(entityId = actor) {
      const pos = query.get(entityId | 0, Position) || { x: 0, y: 0 };
      const dirs = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ];
      const dir = dirs[rng.int(0, dirs.length - 1)];
      return { x: (pos.x | 0) + dir.x, y: (pos.y | 0) + dir.y };
    },
    spawnItem(itemId, at = null, opts = {}) {
      const fallback = query.get(actor, Position) || { x: 0, y: 0 };
      const point = (at && typeof at === "object")
        ? { x: Number(at.x), y: Number(at.y) }
        : { x: Number.NaN, y: Number.NaN };
      const x = Number.isFinite(point.x) ? (point.x | 0) : (fallback.x | 0);
      const y = Number.isFinite(point.y) ? (point.y | 0) : (fallback.y | 0);
      return mutate.spawnItem(itemId, x, y, opts);
    },
    spawnMonster(monsterId, at = null, opts = {}) {
      const fallback = query.get(actor, Position) || { x: 0, y: 0 };
      const point = (at && typeof at === "object")
        ? { x: Number(at.x), y: Number(at.y) }
        : { x: Number.NaN, y: Number.NaN };
      const x = Number.isFinite(point.x) ? (point.x | 0) : (fallback.x | 0);
      const y = Number.isFinite(point.y) ? (point.y | 0) : (fallback.y | 0);
      return mutate.spawnMonster(monsterId, x, y, opts);
    },
    emit(event, payload = {}) {
      return io.emit(event, payload);
    },
    message(text, type = "system") {
      return io.message(text, type);
    },
    warn(code, detail) {
      return audit.warn(code, detail);
    },
    queue(op) {
      return mutate.queue(op);
    },
  });

  return { query, mutate, io, audit, rules, rng, fx };
}
