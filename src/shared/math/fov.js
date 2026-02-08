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

/**
 * Pack two 16-bit signed coords into a 32-bit integer key.
 * Note: valid range per axis is [-32768..32767].
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function packKey16(x, y) {
  return ((x & 0xffff) << 16) | (y & 0xffff);
}

/**
 * Unpack a 32-bit integer key into [x,y].
 * @param {number} key
 * @returns {[number, number]}
 */
export function unpackKey16(key) {
  const x = (key >> 16);
  const y = (key << 16) >> 16; // sign-extend lower 16
  return [x, y];
}

/**
 * Pack two 32-bit signed coords into a 64-bit BigInt key.
 * Note: valid range per axis is [-2147483648..2147483647].
 * @param {number} x
 * @param {number} y
 * @returns {bigint}
 */
export function packKey32(x, y) {
  const bx = BigInt.asIntN(32, BigInt(x));
  const by = BigInt.asIntN(32, BigInt(y));
  return (bx << 32n) | (by & 0xffffffffn);
}

/**
 * Unpack a 64-bit BigInt key into [x,y].
 * @param {bigint} key
 * @returns {[number, number]}
 */
export function unpackKey32(key) {
  const x = Number(BigInt.asIntN(32, key >> 32n));
  const y = Number(BigInt.asIntN(32, key));
  return [x, y];
}

/**
 * Compute FOV using packed integer keys in the output Set.
 * @param {number} ox
 * @param {number} oy
 * @param {number} radius
 * @param {(x:number, y:number)=>boolean} isBlocked
 * @param {Set<number>=} out
 * @returns {Set<number>}
 */
export function computeFOVKeys(ox, oy, radius, isBlocked, out) {
  const visible = out || new Set();
  visible.clear();
  computeFOV(ox, oy, radius, isBlocked, (x, y) => {
    visible.add(packKey16(x, y));
  });
  return visible;
}

/**
 * Compute FOV using packed BigInt keys in the output Set.
 * Example:
 *   const visible = computeFOVKeys32(px, py, 8, isBlocked);
 *   if (visible.has(packKey32(px + 1, py))) { /* tile is visible */ }
 * @param {number} ox
 * @param {number} oy
 * @param {number} radius
 * @param {(x:number, y:number)=>boolean} isBlocked
 * @param {Set<bigint>=} out
 * @returns {Set<bigint>}
 */
export function computeFOVKeys32(ox, oy, radius, isBlocked, out) {
  const visible = out || new Set();
  visible.clear();
  computeFOV(ox, oy, radius, isBlocked, (x, y) => {
    visible.add(packKey32(x, y));
  });
  return visible;
}
