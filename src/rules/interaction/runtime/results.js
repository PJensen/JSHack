/**
 * @param {any} ctx
 * @param {{
 *   ok: boolean,
 *   canceled: boolean,
 *   reason?: string | null,
 *   detail?: unknown,
 *   metrics?: Record<string, unknown>,
 *   payload?: unknown,
 *   warnings?: Array<{ code: string, detail?: unknown }>,
 * }} init
 */
export function buildInteractionResult(ctx, init) {
  return {
    schemaVersion: ctx.schemaVersion,
    kind: ctx.kind,
    ok: init.ok === true,
    canceled: init.canceled === true,
    verb: String(ctx.verb || ""),
    actor: ctx.actor | 0,
    primary: ctx.primary | 0,
    target: ctx.target | 0,
    params: ctx.publicParams || {},
    reason: init.reason || null,
    detail: init.detail,
    metrics: init.metrics || {},
    payload: init.payload ?? null,
    breadcrumbs: Array.isArray(ctx._breadcrumbs) ? ctx._breadcrumbs.slice() : [],
    warnings: Array.isArray(init.warnings) ? init.warnings.slice() : [],
  };
}
