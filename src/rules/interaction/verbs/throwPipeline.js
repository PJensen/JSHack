import { Position } from "../../components/Position.js";
import { Faction } from "../../components/Faction.js";
import { Vitality } from "../../components/Vitality.js";
import { ScriptRef } from "../../components/ScriptRef.js";
import { findThrowPayload } from "../../content/items/throwPayloads.js";
import { ScriptVerb } from "../../scripting.js";
import { areFactionsHostile } from "../../utils/factionHostility.js";

/**
 * @param {any} value
 */
function normalizeThrowHookResult(value) {
  if (typeof value === "boolean") return { consumed: value };
  if (value && typeof value === "object") {
    return {
      consumed: value.consumed === true,
      cancelled: value.cancelled === true,
      skipBaseThrow: value.skipBaseThrow === true,
      code: value.code,
      message: value.message,
      consumesTurn: value.consumesTurn,
      detail: value.detail,
      at: value.at,
    };
  }
  return { consumed: false, cancelled: false, skipBaseThrow: false };
}

/**
 * @param {any} ctx
 * @param {any} payload
 * @param {any} state
 */
function runThrowHooks(ctx, payload, state) {
  const out = {};
  const phases = [
    ["beforeThrow", payload.beforeThrow],
    ["onThrow", payload.onThrow],
    ["afterThrow", payload.afterThrow],
  ];
  for (let i = 0; i < phases.length; i++) {
    const [phase, fn] = phases[i];
    if (typeof fn !== "function") continue;
    out[phase] = fn(ctx, state);
    if (ctx.cancelled) break;
  }
  return out;
}

/**
 * @param {any} point
 * @param {{ x: number, y: number }} fallback
 */
function normalizePoint(point, fallback) {
  if (!point || typeof point !== "object") {
    return { x: fallback.x | 0, y: fallback.y | 0 };
  }
  const x = Number(point.x);
  const y = Number(point.y);
  return {
    x: Number.isFinite(x) ? (x | 0) : (fallback.x | 0),
    y: Number.isFinite(y) ? (y | 0) : (fallback.y | 0),
  };
}

/**
 * @param {any} input
 * @param {{ x: number, y: number }} actorPos
 * @param {number} weight
 */
function normalizeThrowSpec(input, actorPos, weight) {
  const fallbackFrom = { x: actorPos.x | 0, y: actorPos.y | 0 };
  const fallbackTo = { x: fallbackFrom.x + 1, y: fallbackFrom.y };
  const rec = (input && typeof input === "object") ? input : {};

  const from = normalizePoint(rec.from, fallbackFrom);
  const to = normalizePoint(rec.to, fallbackTo);
  let dx = Number(rec.dx);
  let dy = Number(rec.dy);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
    dx = Math.sign((to.x | 0) - (from.x | 0));
    dy = Math.sign((to.y | 0) - (from.y | 0));
  }
  dx = Math.sign(dx);
  dy = Math.sign(dy);
  if (dx === 0 && dy === 0) dx = 1;

  let range = Number(rec.range);
  if (!Number.isFinite(range) || range <= 0) {
    range = Math.max(Math.abs((to.x | 0) - (from.x | 0)), Math.abs((to.y | 0) - (from.y | 0)));
  }
  range = Math.max(1, range | 0);

  let maxRange = Number(rec.maxRange);
  if (!Number.isFinite(maxRange) || maxRange <= 0) maxRange = range;
  maxRange = Math.max(1, maxRange | 0);

  return {
    from,
    to,
    dx,
    dy,
    range,
    maxRange,
    weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
  };
}

/**
 * @param {any} info
 */
function isThrowableWeapon(info) {
  return String(info?.type || "") === "equip" && String(info?.slot || "") === "weapon";
}

/**
 * @param {any} ctx
 * @param {number} actor
 * @param {number} targetId
 * @param {{ x:number, y:number }} landing
 */
function resolveThrowImpactTarget(ctx, actor, targetId, landing) {
  const preferred = Number(targetId || 0) | 0;
  if (preferred > 0 && preferred !== actor && ctx.query.alive(preferred)) {
    const p = ctx.query.get(preferred, Position);
    const v = ctx.query.get(preferred, Vitality);
    if (
      p && v
      && (v.hp | 0) > 0
      && (p.x | 0) === (landing.x | 0)
      && (p.y | 0) === (landing.y | 0)
    ) {
      return preferred;
    }
  }

  const ids = ctx.query.livingAt(landing.x, landing.y, { exclude: [actor] });
  return Array.isArray(ids) && ids.length > 0 ? (Number(ids[0]) | 0) : 0;
}

/**
 * @param {any} ctx
 * @param {{ damageDice?: string }} info
 * @param {number} actor
 */
function rollThrowImpactDamage(ctx, info, actor) {
  const dice = String(info?.damageDice || "1d2");
  const base = Math.max(1, Number(ctx.fx.roll(dice) || 0) | 0);
  const snapshot = ctx.query.combatSnapshot(actor, "ranged");
  const flat = Math.max(0, Number(snapshot?.damageFlatBonus || 0) | 0);
  return Math.max(1, base + flat);
}

/**
 * Canonical throw interaction pipeline.
 *
 * Behavior:
 * - runs throw hooks from item defs (`beforeThrow` / `onThrow` / `afterThrow`)
 * - if hooks do not consume the item, applies default throw behavior:
 *   remove from inventory and place on the landing tile
 * - supports hook opt-out via `{ skipBaseThrow: true }`
 *
 * @param {any} ctx
 */
export function throwPipeline(ctx) {
  const actor = ctx.actor | 0;
  const itemId = ctx.primary | 0;
  const targetId = ctx.target | 0;
  const intent = (ctx.params?.intent && typeof ctx.params.intent === "object")
    ? ctx.params.intent
    : null;

  const metrics = {
    consumed: false,
    dropped: false,
    impacted: false,
    impactDamage: 0,
    payloadMatched: false,
    path: "none",
    range: 0,
    maxRange: 0,
    weight: 0,
  };

  if (!(actor > 0) || !(itemId > 0)) {
    ctx.cancel({ code: "THROW_GATE_INVALID", message: "Missing actor or item for throw action." });
    return { metrics };
  }
  if (!ctx.query.alive(actor)) {
    ctx.cancel({ code: "THROW_GATE_NO_ACTOR", message: "Actor is not alive." });
    return { metrics };
  }
  if (!ctx.query.alive(itemId)) {
    ctx.cancel({ code: "THROW_GATE_NO_ITEM", message: "Item no longer exists." });
    return { metrics };
  }
  if (!ctx.rules.hasItemInInventory(actor, itemId)) {
    ctx.cancel({ code: "THROW_GATE_NOT_OWNED", message: "Item is not in inventory." });
    return { metrics };
  }

  const actorPos = ctx.query.get(actor, Position);
  if (!actorPos) {
    ctx.cancel({ code: "THROW_GATE_NO_POSITION", message: "Actor position is required to throw." });
    return { metrics };
  }

  const info = ctx.query.itemInfo(itemId);
  const identity = String(ctx.query.identity(itemId) || "").toLowerCase();
  const rawWeight = Number(info?.weight);
  const weight = Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : 1;
  const throwSpec = normalizeThrowSpec(ctx.params?.throwSpec, actorPos, weight);
  metrics.range = throwSpec.range;
  metrics.maxRange = throwSpec.maxRange;
  metrics.weight = throwSpec.weight;

  const state = {
    actor,
    itemId,
    targetId,
    identity,
    info,
    intent,
    throw: throwSpec,
    targetX: throwSpec.to.x,
    targetY: throwSpec.to.y,
    weight: throwSpec.weight,
  };

  const payload = findThrowPayload(state);
  if (payload) {
    metrics.payloadMatched = true;
    metrics.path = String(payload.source || "payload");
  }

  const hookOut = payload ? runThrowHooks(ctx, payload, state) : {};
  let scriptOut;
  if (!ctx.cancelled) {
    const scriptRef = ctx.query.get(itemId, ScriptRef);
    if (scriptRef) {
      scriptOut = ctx.rules.runScript(scriptRef, ScriptVerb.ItemThrow, {
        ...state,
        targetId,
        targetX: throwSpec.to.x,
        targetY: throwSpec.to.y,
        interaction: ctx,
      });
    }
  }
  if (ctx.cancelled) {
    return {
      metrics,
      payload: {
        defId: payload ? String(payload.id || "") : null,
        path: payload ? String(payload.source || "payload") : "none",
        hooks: hookOut,
        script: scriptOut,
        throw: throwSpec,
      },
    };
  }

  const hookResult = normalizeThrowHookResult(
    hookOut.onThrow !== undefined ? hookOut.onThrow : scriptOut,
  );
  if (hookResult.cancelled) {
    ctx.cancel({
      code: String(hookResult.code || "THROW_CANCELLED"),
      message: String(hookResult.message || "Throw action cancelled."),
      consumesTurn: hookResult.consumesTurn === true,
      detail: hookResult.detail,
    });
    return {
      metrics,
      payload: {
        defId: payload ? String(payload.id || "") : null,
        path: payload ? String(payload.source || "payload") : "none",
        hooks: hookOut,
        script: scriptOut,
        hookResult,
        throw: throwSpec,
      },
    };
  }

  if (hookResult.consumed) {
    ctx.mutate.consume(itemId, actor);
    metrics.consumed = true;
  } else if (!hookResult.skipBaseThrow) {
    const landing = normalizePoint(hookResult.at, throwSpec.to);
    let impact = null;

    if (isThrowableWeapon(info)) {
      const defender = resolveThrowImpactTarget(ctx, actor, targetId, landing);
      if (defender > 0) {
        const af = ctx.query.get(actor, Faction)?.key || "";
        const df = ctx.query.get(defender, Faction)?.key || "";
        if (areFactionsHostile(af, df)) {
          const damage = rollThrowImpactDamage(ctx, info || {}, actor);
          ctx.mutate.queue({
            type: "damage",
            entityId: defender,
            amount: damage,
            source: actor,
            damageType: "physical",
          });
          metrics.impacted = true;
          metrics.impactDamage = damage;
          impact = { targetId: defender, damage };
          ctx.io.emit("item:throw-impact", {
            actor,
            itemId,
            targetId: defender,
            at: { ...landing },
            damage,
          });
        }
      }
    }

    ctx.mutate.queue({
      type: "dropFromInventory",
      entityId: itemId,
      inventoryOwnerId: actor,
      x: landing.x,
      y: landing.y,
      emitEvent: false,
    });
    metrics.dropped = true;
    ctx.io.emit("item:thrown", {
      actor,
      itemId,
      targetId,
      from: { ...throwSpec.from },
      to: { ...landing },
      range: throwSpec.range,
      maxRange: throwSpec.maxRange,
      weight: throwSpec.weight,
      path: metrics.path,
      impact,
    });
  }

  return {
    metrics,
    payload: {
      defId: payload ? String(payload.id || "") : null,
      path: payload ? String(payload.source || "payload") : "none",
      hooks: hookOut,
      script: scriptOut,
      hookResult,
      throw: throwSpec,
    },
  };
}
