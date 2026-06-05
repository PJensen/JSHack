import { normalizeGridPoint } from "../math/point.js";

/**
 * Build a normalized status event payload for rules -> UI communication.
 * Contract fields: { id, kind, effect?, source?, at? }.
 */
export function createStatusEvent({ id, kind, effect, source, at, masked } = {}) {
  const out = {
    id: Number(id || 0) | 0,
    kind: String(kind || "").trim().toLowerCase(),
  };
  if (effect != null && String(effect).trim().length > 0) out.effect = String(effect).trim().toLowerCase();
  if (source != null) out.source = Number(source || 0) | 0;
  const normalizedAt = normalizeGridPoint(at);
  if (normalizedAt) out.at = normalizedAt;
  if (masked) out.masked = true;
  return out;
}

/**
 * Normalize incoming status payloads for display readers.
 */
export function normalizeStatusEvent(ev) {
  return createStatusEvent(ev || {});
}
