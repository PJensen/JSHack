export const INTERACTION_CTX_SCHEMA_VERSION = 1;
export const INTERACTION_CTX_KIND = "interaction";

/**
 * @param {number} n
 * @returns {number}
 */
export function normalizeEntityId(n) {
  const v = Number(n) | 0;
  return v > 0 ? v : 0;
}

/**
 * @param {unknown} reason
 * @param {unknown} [detail]
 * @returns {{ code: string, message: string, consumesTurn?: boolean, detail?: unknown }}
 */
export function normalizeCancelReason(reason, detail) {
  if (reason && typeof reason === "object") {
    const rec = /** @type {{ code?: unknown, message?: unknown, consumesTurn?: unknown, detail?: unknown }} */ (reason);
    const out = {
      code: String(rec.code || "CANCELLED"),
      message: String(rec.message || "Action cancelled."),
    };
    if (typeof rec.consumesTurn === "boolean") out.consumesTurn = rec.consumesTurn;
    if (rec.detail !== undefined) out.detail = rec.detail;
    if (detail !== undefined) out.detail = detail;
    return out;
  }

  if (typeof reason === "string" && reason.length > 0) {
    return {
      code: reason,
      message: reason,
      ...(detail !== undefined ? { detail } : {}),
    };
  }

  return {
    code: "CANCELLED",
    message: "Action cancelled.",
    ...(detail !== undefined ? { detail } : {}),
  };
}
