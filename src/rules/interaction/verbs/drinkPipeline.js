import { Potion } from "../../components/Potion.js";
import { Vitality } from "../../components/Vitality.js";

/**
 * @param {any} hookOwner
 * @param {string} key
 * @returns {((ctx: any) => unknown) | null}
 */
function getHook(hookOwner, key) {
  if (!hookOwner || typeof hookOwner !== "object") return null;
  const fn = hookOwner[key];
  return typeof fn === "function" ? fn : null;
}

/**
 * @param {any} ctx
 * @param {{
 *   beforeDrink?: ((ctx: any, state?: any) => unknown) | null,
 *   onDrink?: ((ctx: any, state?: any) => unknown) | null,
 *   afterDrink?: ((ctx: any, state?: any) => unknown) | null,
 * }} hooks
 * @param {any} state
 */
function runPayloadHooks(ctx, hooks, state) {
  const payload = {};
  const phases = [
    ["beforeDrink", hooks.beforeDrink],
    ["onDrink", hooks.onDrink],
    ["afterDrink", hooks.afterDrink],
  ];
  for (let i = 0; i < phases.length; i++) {
    const [phase, hook] = phases[i];
    if (typeof hook !== "function") continue;
    const out = hook(ctx, state);
    payload[phase] = out;
    if (ctx.cancelled) break;
  }
  return payload;
}

/**
 * @param {any} effect
 * @param {any} ctx
 * @param {number} target
 * @param {{ route?: string, name?: string, masked?: boolean }} potionMeta
 * @returns {any}
 */
function normalizePotionEffect(effect, ctx, target, potionMeta) {
  const input = effect && typeof effect === "object" ? effect : {};
  const out = {
    key: String(input.key || ""),
    potency: Number(input.potency || 0),
    onsetLeft: Math.max(0, Number(input.onset ?? input.onsetLeft ?? 0) | 0),
    peakLeft: Math.max(0, Number(input.peak ?? input.peakLeft ?? 0) | 0),
    turnsLeft: Math.max(0, Number(input.duration ?? input.turnsLeft ?? 0) | 0),
    stack: String(input.stack || "add"),
    maxStacks: Math.max(1, Number(input.maxStacks ?? 1) | 0),
    sourceId: ctx.primary | 0,
    startedAtTurn: Number(ctx.params?.stepHint || 0) | 0,
    meta: {
      route: String(potionMeta?.route || "oral"),
      name: String(potionMeta?.name || "Potion"),
      ...(input.meta && typeof input.meta === "object" ? input.meta : {}),
      masked: !!potionMeta?.masked,
    },
  };

  const pct = Number(input?.meta?.percentOfMaxHp);
  if (Number.isFinite(pct)) {
    const vit = ctx.query.get(target, Vitality);
    const normalizedPct = Math.max(0, Math.min(1, pct));
    const resolved = Math.max(1, Math.floor(Number(vit?.maxHp || 0) * normalizedPct));
    out.potency = resolved;
  }

  return out;
}

/**
 * Canonical drink interaction pipeline.
 * Mechanics:
 * - universal gates (actor/item/route)
 * - queue consumption + effect application
 * - payload hooks for content-specific behavior
 * - canonical emitted events
 * @param {any} ctx
 */
export function drinkPipeline(ctx) {
  const actor = ctx.actor | 0;
  const itemId = ctx.primary | 0;
  const target = ctx.rules.resolveTarget(actor);

  const metrics = {
    consumed: false,
    queuedChannels: 0,
    queuedEffects: 0,
    hangoverQueued: false,
  };

  if (!(actor > 0) || !(itemId > 0)) {
    ctx.cancel({ code: "DRINK_INVALID", message: "Missing actor or item for drink action." });
    return { metrics };
  }
  if (!ctx.query.alive(actor)) {
    ctx.cancel({ code: "DRINK_NO_ACTOR", message: "Actor is not alive." });
    return { metrics };
  }
  if (!ctx.query.alive(itemId)) {
    ctx.cancel({ code: "DRINK_NO_ITEM", message: "Item no longer exists." });
    return { metrics };
  }
  if (!ctx.rules.hasItemInInventory(actor, itemId)) {
    ctx.cancel({ code: "DRINK_NOT_OWNED", message: "Item is not in inventory." });
    return { metrics };
  }
  if (!ctx.query.has(itemId, Potion)) {
    ctx.cancel({ code: "DRINK_NOT_POTION", message: "That item cannot be drunk." });
    return { metrics };
  }
  if (!ctx.query.alive(target)) {
    ctx.cancel({ code: "DRINK_BAD_TARGET", message: "Drink target is invalid." });
    return { metrics };
  }

  const potion = ctx.query.get(itemId, Potion);
  if (!potion) {
    ctx.cancel({ code: "DRINK_BAD_POTION", message: "Potion data missing." });
    return { metrics };
  }

  const route = String(potion.route || "oral");
  const routeAllowed = route === "oral" || route === "inhale" || route === "inject" || route === "topical" || route === "splash";
  if (!routeAllowed) {
    ctx.cancel({ code: "DRINK_ROUTE", message: `Unsupported route '${route}'.` });
    return { metrics };
  }

  ctx.audit.breadcrumb("drink:begin", { actor, itemId, target, route });

  const paramsPayload = ctx.params?.payload && typeof ctx.params.payload === "object"
    ? ctx.params.payload
    : null;
  const identity = String(ctx.query.identity(itemId) || "").toLowerCase();
  const identified = ctx.query.isIdentified(identity);
  const state = {
    actor,
    itemId,
    target,
    identity,
    identified,
    potion,
  };
  const hooks = {
    beforeDrink: getHook(paramsPayload, "beforeDrink") || getHook(potion, "beforeDrink"),
    onDrink: getHook(paramsPayload, "onDrink") || getHook(potion, "onDrink"),
    afterDrink: getHook(paramsPayload, "afterDrink") || getHook(potion, "afterDrink"),
  };
  const payload = runPayloadHooks(ctx, { beforeDrink: hooks.beforeDrink }, state);
  if (ctx.cancelled) return { metrics, payload };

  ctx.mutate.consume(itemId, actor);
  metrics.consumed = true;

  if (Array.isArray(potion.channels) && potion.channels.length > 0) {
    ctx.mutate.appendDamageChannels(target, potion.channels);
    metrics.queuedChannels += potion.channels.length;
  }

  const effects = Array.isArray(potion.effects) ? potion.effects : [];
  for (let i = 0; i < effects.length; i++) {
    const normalized = normalizePotionEffect(effects[i], ctx, target, { route, name: potion.name, masked: !identified });
    if (!normalized.key || normalized.turnsLeft <= 0) continue;
    ctx.mutate.upsertTimedEffect(target, normalized);
    metrics.queuedEffects += 1;
  }

  const hangoverPotency = Number(potion?.toxicity?.hangover || 0);
  if (hangoverPotency > 0) {
    const avgDuration = effects.length > 0
      ? Math.max(1, Math.round(effects.reduce((sum, e) => sum + Number(e?.duration || e?.turnsLeft || 0), 0) / effects.length))
      : 1;
    const delay = Math.max(1, Math.round(avgDuration * 0.6));
    ctx.mutate.upsertTimedEffect(target, {
      key: "hangover",
      potency: hangoverPotency,
      onsetLeft: delay,
      peakLeft: 0,
      turnsLeft: Math.max(2, delay),
      stack: "add",
      maxStacks: 1,
      sourceId: itemId,
      meta: { name: `${String(potion.name || "Potion")} (rebound)`, route },
    });
    metrics.hangoverQueued = true;
    metrics.queuedEffects += 1;
  }

  const restPayload = runPayloadHooks(ctx, { onDrink: hooks.onDrink, afterDrink: hooks.afterDrink }, state);
  Object.assign(payload, restPayload);
  if (ctx.cancelled) return { metrics, payload };

  ctx.io.emit("effectsChanged", { entity: target });
  ctx.io.emit("drank", { actor, itemId, target, feel: potion.feel || null, identified });
  ctx.io.emit("item:used", { actor, itemId });

  ctx.audit.breadcrumb("drink:queued", metrics);
  return { metrics, payload };
}
