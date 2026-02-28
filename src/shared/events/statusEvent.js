/**
 * Build a normalized status event payload for rules -> UI communication.
 * Contract fields: { id, kind, effect?, source?, at? }.
 */
export function createStatusEvent({ id, kind, effect, source, at } = {}) {
  const out = {
    id: Number(id || 0) | 0,
    kind: String(kind || "").trim().toLowerCase(),
  };
  if (effect != null && String(effect).trim().length > 0) out.effect = String(effect).trim().toLowerCase();
  if (source != null) out.source = Number(source || 0) | 0;
  if (at && Number.isFinite(Number(at.x)) && Number.isFinite(Number(at.y))) {
    out.at = { x: Number(at.x) | 0, y: Number(at.y) | 0 };
  }
  return out;
}

/**
 * Normalize incoming status payloads for display readers.
 */
export function normalizeStatusEvent(ev) {
  return createStatusEvent(ev || {});
}
