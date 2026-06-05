/**
 * Normalize an object-shaped coordinate into an integer grid point.
 *
 * Returns null for absent or non-finite coordinates. World coordinates may be
 * negative, so this intentionally does not clamp.
 *
 * @param {any} value
 * @returns {{x:number, y:number} | null}
 */
export function normalizeGridPoint(value) {
  if (!value || !Number.isFinite(Number(value.x)) || !Number.isFinite(Number(value.y))) return null;
  return { x: Number(value.x) | 0, y: Number(value.y) | 0 };
}
