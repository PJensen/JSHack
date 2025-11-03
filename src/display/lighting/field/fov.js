// display/lighting/field/fov.js
// Fast recursive shadowcasting FOV on a tile grid.

// Helper to cast light in a single octant
function castOctant(visible, ox, oy, radius, startSlope, endSlope, xx, xy, yx, yy, isBlocked) {
  if (startSlope < endSlope) return;
  const radiusSq = radius * radius;
  for (let row = 1; row <= radius; row++) {
    let blocked = false;
    let newStart = startSlope;
    const dy = row;
    const xmin = -Math.floor(row * startSlope + 0.5);
    const xmax = Math.floor(row * endSlope + 0.5);
    for (let dx = xmin; dx <= xmax; dx++) {
      const X = ox + dx * xx + dy * xy;
      const Y = oy + dx * yx + dy * yy;
      const lSlope = (dx - 0.5) / (dy + 0.5);
      const rSlope = (dx + 0.5) / (dy - 0.5);

      const distSq = dx * dx + dy * dy;
      if (distSq <= radiusSq) visible.add(`${X},${Y}`);

      if (blocked) {
        if (isBlocked(X, Y)) {
          newStart = rSlope; // keep scanning
        } else {
          blocked = false;
          startSlope = newStart;
        }
      } else {
        if (isBlocked(X, Y) && row < radius) {
          blocked = true;
          castOctant(visible, ox, oy, radius, startSlope, lSlope, xx, xy, yx, yy, isBlocked);
          newStart = rSlope;
        }
      }
    }
    if (blocked) break;
  }
}

/**
 * Compute FOV visible tiles from origin (ox, oy) within radius using recursive shadowcasting.
 * @param {number} ox
 * @param {number} oy
 * @param {number} radius
 * @param {(x:number, y:number)=>boolean} isBlocked - true when tile blocks vision
 * @param {Set<string>=} out - optional set to reuse
 * @returns {Set<string>}
 */
export function computeFOV(ox, oy, radius, isBlocked, out) {
  const visible = out || new Set();
  visible.clear();
  visible.add(`${ox},${oy}`);
  // 8 octants
  castOctant(visible, ox, oy, radius, 1.0, 0.0, 1, 0, 0, 1, isBlocked);
  castOctant(visible, ox, oy, radius, 1.0, 0.0, 0, 1, 1, 0, isBlocked);
  castOctant(visible, ox, oy, radius, 1.0, 0.0, -1, 0, 0, 1, isBlocked);
  castOctant(visible, ox, oy, radius, 1.0, 0.0, 0, 1, -1, 0, isBlocked);
  castOctant(visible, ox, oy, radius, 1.0, 0.0, 1, 0, 0, -1, isBlocked);
  castOctant(visible, ox, oy, radius, 1.0, 0.0, 0, 1, 1, 0, (x,y)=>isBlocked(x,y));
  castOctant(visible, ox, oy, radius, 1.0, 0.0, -1, 0, 0, -1, isBlocked);
  castOctant(visible, ox, oy, radius, 1.0, 0.0, 0, 1, -1, 0, isBlocked);
  return visible;
}
