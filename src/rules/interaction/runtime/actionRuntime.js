import { RuleActionContext } from "../../utils/actionContexts.js";
import { createFacets } from "../facets/createFacets.js";
import { buildInteractionResult } from "./results.js";
import {
  INTERACTION_CTX_KIND,
  INTERACTION_CTX_SCHEMA_VERSION,
  normalizeCancelReason,
  normalizeEntityId,
} from "./schema.js";

/**
 * Keep result params serializable and replay-friendly.
 * @param {Record<string, unknown>} params
 * @returns {Record<string, unknown>}
 */
function sanitizePublicParams(params) {
  const out = {};
  const keys = Object.keys(params || {});
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = params[key];
    if (typeof value === "function") continue;
    if (key === "payload" && value && typeof value === "object") {
      out.payload = "[payload-hooks]";
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * @param {import("../../../lib/ecs-js/index.js").World} world
 * @param {{
 *   verb: string,
 *   actor: number,
 *   primary: number,
 *   target?: number,
 *   params?: Record<string, unknown>,
 *   pipeline: (ctx: any) => unknown,
 * }} spec
 */
export function executeInteraction(world, spec) {
  if (!world || !spec || typeof spec.pipeline !== "function") {
    throw new Error("executeInteraction requires { world, pipeline }");
  }

  const actor = normalizeEntityId(spec.actor);
  const primary = normalizeEntityId(spec.primary);
  const target = normalizeEntityId(spec.target);
  const verb = String(spec.verb || "");
  const params = (spec.params && typeof spec.params === "object")
    ? /** @type {Record<string, unknown>} */ (spec.params)
    : {};
  const publicParams = sanitizePublicParams(params);

  const tx = new RuleActionContext(world);
  /** @type {Array<{ event?: string, payload?: Record<string, unknown>, instance?: object, factory?: Function }>} */
  const eventBuffer = [];
  /** @type {Array<{ step: string, data?: unknown }>} */
  const breadcrumbs = [];
  /** @type {Array<{ code: string, detail?: unknown }>} */
  const warnings = [];

  const facets = createFacets({
    world,
    tx,
    actor,
    primary,
    target,
    verb,
    eventBuffer,
    breadcrumbs,
    warnings,
  });
  const helpers = facets.fx;
  const trace = Object.freeze({
    rule(ruleId) {
      breadcrumbs.push({ step: "rule", data: { ruleId: String(ruleId || "") } });
    },
    considered(candidateId) {
      breadcrumbs.push({ step: "considered", data: { candidateId: String(candidateId || "") } });
    },
    weight(candidateId, weight) {
      breadcrumbs.push({
        step: "weight",
        data: { candidateId: String(candidateId || ""), weight: Number(weight || 0) },
      });
    },
    skipped(candidateId, reason) {
      breadcrumbs.push({
        step: "skipped",
        data: { candidateId: String(candidateId || ""), reason: String(reason || "") },
      });
    },
    selected(candidateId, data = {}) {
      breadcrumbs.push({
        step: "selected",
        data: { candidateId: String(candidateId || ""), ...(data || {}) },
      });
    },
    rejected(ruleId, reason) {
      breadcrumbs.push({
        step: "rejected",
        data: { ruleId: String(ruleId || ""), reason: String(reason || "") },
      });
    },
  });

  const ctx = {
    schemaVersion: INTERACTION_CTX_SCHEMA_VERSION,
    kind: INTERACTION_CTX_KIND,
    verb,
    actor,
    primary,
    target,
    params,
    publicParams,
    world: facets.world,
    query: facets.query,
    mutate: facets.mutate,
    io: facets.io,
    audit: facets.audit,
    rules: facets.rules,
    rng: facets.rng,
    stats: facets.stats,
    status: facets.status,
    trace,
    helpers,
    fx: helpers,
    _breadcrumbs: breadcrumbs,
    /**
     * @param {unknown} reason
     * @param {unknown} [detail]
     */
    cancel(reason, detail) {
      tx.cancel(normalizeCancelReason(reason, detail));
      return false;
    },
  };

  Object.defineProperty(ctx, "cancelled", {
    get() { return tx.cancelled; },
  });
  Object.defineProperty(ctx, "cancelReason", {
    get() { return tx.cancelReason; },
  });

  let payloadResult = null;
  let pipelineMetrics = {};

  try {
    const out = spec.pipeline(ctx);
    if (out && typeof out === "object") {
      const rec = /** @type {{ payload?: unknown, metrics?: Record<string, unknown> }} */ (out);
      if (rec.payload !== undefined) payloadResult = rec.payload;
      if (rec.metrics && typeof rec.metrics === "object") pipelineMetrics = { ...rec.metrics };
    } else if (out !== undefined) {
      payloadResult = out;
    }
  } catch (error) {
    const detail = { message: String(error?.message || error || "unknown pipeline error") };
    warnings.push({ code: "pipeline:error", detail });
    tx.cancel(normalizeCancelReason({
      code: "PIPELINE_ERROR",
      message: "Interaction pipeline failed.",
      detail,
    }));
  }

  if (tx.cancelled) {
    tx.discard();
    return buildInteractionResult(ctx, {
      ok: false,
      canceled: true,
      reason: String(tx.cancelReason?.code || "CANCELLED"),
      detail: tx.cancelReason || null,
      metrics: {
        committedOps: 0,
        emittedEvents: 0,
        ...pipelineMetrics,
      },
      payload: payloadResult,
      warnings,
    });
  }

  const applied = tx.commit();
  let emittedEvents = 0;
  for (let i = 0; i < eventBuffer.length; i++) {
    const ev = eventBuffer[i];
    if (!ev) continue;
    if (ev.factory) {
      world.emit(ev.factory());
      emittedEvents += 1;
      continue;
    }
    if (ev.instance) {
      world.emit(ev.instance);
      emittedEvents += 1;
      continue;
    }
    if (!ev.event) continue;
    world.emit(ev.event, ev.payload);
    emittedEvents += 1;
  }

  return buildInteractionResult(ctx, {
    ok: true,
    canceled: false,
    metrics: {
      committedOps: applied.length,
      emittedEvents,
      ...pipelineMetrics,
    },
    payload: payloadResult,
    warnings,
  });
}
