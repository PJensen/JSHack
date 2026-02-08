// shared/math/fov.js
// Recursive shadowcasting FOV on a tile grid.
// Based on the rot.js implementation (Ondrej Zara, BSD license).

/**
 * @param {(x:number,y:number)=>void} setVisible
 * @param {number} ox  @param {number} oy
 * @param {number} row  @param {number} visSlopeStart  @param {number} visSlopeEnd
 * @param {number} radius
 * @param {number} xx  @param {number} xy  @param {number} yx  @param {number} yy
 * @param {(x:number,y:number)=>boolean} isBlocked
 */
function castVisibility(setVisible, ox, oy, row, visSlopeStart, visSlopeEnd, radius, xx, xy, yx, yy, isBlocked) {
  if (visSlopeStart < visSlopeEnd) return;
  const radiusSq = radius * radius;
  for (let i = row; i <= radius; i++) {
    let dx = -i - 1;
    const dy = -i;
    let blocked = false;
    let newStart = 0;

    while (dx <= 0) {
      dx++;
      const mapX = ox + dx * xx + dy * xy;
      const mapY = oy + dx * yx + dy * yy;
      const slopeStart = (dx - 0.5) / (dy + 0.5);
      const slopeEnd = (dx + 0.5) / (dy - 0.5);

      if (slopeEnd > visSlopeStart) continue;
      if (slopeStart < visSlopeEnd) break;

      if ((dx * dx + dy * dy) <= radiusSq) setVisible(mapX, mapY);

      if (blocked) {
        if (isBlocked(mapX, mapY)) {
          newStart = slopeEnd;
        } else {
          blocked = false;
          visSlopeStart = newStart;
        }
      } else if (isBlocked(mapX, mapY)) {
        if (i < radius) {
          blocked = true;
          castVisibility(setVisible, ox, oy, i + 1, visSlopeStart, slopeStart, radius, xx, xy, yx, yy, isBlocked);
          newStart = slopeEnd;
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
 * @param {Set<string>|((x:number,y:number)=>void)=} out - optional set to reuse, or a setter callback
 * @returns {Set<string>|null}
 */
export function computeFOV(ox, oy, radius, isBlocked, out) {
  /** @type {(x:number,y:number)=>void} */
  let setVisible;
  let visible = null;
  if (typeof out === 'function') {
    setVisible = out;
  } else {
    visible = out || new Set();
    visible.clear();
    setVisible = (x, y) => visible.add(`${x},${y}`);
  }

  setVisible(ox, oy);
  // 8 octants
  castVisibility(setVisible, ox, oy, 1, 1.0, 0.0, radius,  1,  0,  0,  1, isBlocked);
  castVisibility(setVisible, ox, oy, 1, 1.0, 0.0, radius,  1,  0,  0, -1, isBlocked);
  castVisibility(setVisible, ox, oy, 1, 1.0, 0.0, radius, -1,  0,  0,  1, isBlocked);
  castVisibility(setVisible, ox, oy, 1, 1.0, 0.0, radius, -1,  0,  0, -1, isBlocked);
  castVisibility(setVisible, ox, oy, 1, 1.0, 0.0, radius,  0,  1,  1,  0, isBlocked);
  castVisibility(setVisible, ox, oy, 1, 1.0, 0.0, radius,  0,  1, -1,  0, isBlocked);
  castVisibility(setVisible, ox, oy, 1, 1.0, 0.0, radius,  0, -1,  1,  0, isBlocked);
  castVisibility(setVisible, ox, oy, 1, 1.0, 0.0, radius,  0, -1, -1,  0, isBlocked);
  return visible;
}
