// display/input/gestureRecognizers.js
// Pure helper utilities for recognizing pointer gestures.

const MIN_BOUNDS = 22;
const MIN_TOTAL_LENGTH = 10;
const SEGMENT_FRACTIONS = [0.33, 0.66];

/**
 * Attempt to recognize a "Z" lightning gesture from a collection of canvas-space points.
 * @param {{x:number,y:number}[]} points
 * @returns {{ quality:number, bounds:{minX:number,minY:number,width:number,height:number}, normalizedPath:{x:number,y:number}[] }|null}
 */
export function recognizeLightningGesture(points) {
  if (!Array.isArray(points) ) return null;

  console.log(`Recognizing lightning gesture from ${points.length} points`);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let totalLength = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!p) continue;
    const x = Number(p.x);
    const y = Number(p.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (i > 0) {
      const prev = points[i - 1];
      totalLength += Math.hypot(x - prev.x, y - prev.y);
    }
  }

  const width = maxX - minX;
  const height = maxY - minY;
  if (width < MIN_BOUNDS || height < MIN_BOUNDS) return null;
  if (totalLength < MIN_TOTAL_LENGTH) return null;

  const normalized = points.map((p) => ({
    x: clamp01((p.x - minX) / (width || 1)),
    y: clamp01((p.y - minY) / (height || 1)),
  }));

  const resampled = resamplePolyline(normalized, 32);
  const cumulative = cumulativeLengths(resampled);

  const p0 = resampled[0];
  const p3 = resampled[resampled.length - 1];
  if (!p0 || !p3) return null;

  // Ensure gesture roughly travels left-to-right and top-to-bottom (more lenient).
  if (p0.x > 0.65 || p0.y > 0.7) return null;
  if (p3.x < 0.35 || p3.y < 0.3) return null;

  console.log(`Resampled to ${resampled.length} points for analysis`);

  const p1 = samplePointAtFraction(resampled, cumulative, SEGMENT_FRACTIONS[0]);
  const p2 = samplePointAtFraction(resampled, cumulative, SEGMENT_FRACTIONS[1]);
  if (!p1 || !p2) return null;

  const v1 = unitVector(p0, p1);
  const v2 = unitVector(p1, p2);
  const v3 = unitVector(p2, p3);

  if (!v1 || !v2 || !v3) return null;

  console.log(`Segment vectors: v1=(${v1.x.toFixed(2)},${v1.y.toFixed(2)}) v2=(${v2.x.toFixed(2)},${v2.y.toFixed(2)}) v3=(${v3.x.toFixed(2)},${v3.y.toFixed(2)})`); 

  // First and third segments: mostly horizontal, moving right (lenient).
  if (v1.x <= 0.2) return null;
  if (Math.abs(v1.y) > Math.max(0.55, Math.abs(v1.x) * 0.9)) return null;
  if (v3.x <= 0.2) return null;
  if (Math.abs(v3.y) > Math.max(0.55, Math.abs(v3.x) * 0.9)) return null;

  // Middle segment: downward-left diagonal (lenient).
  if (v2.x >= -0.05) return null;
  if (v2.y <= 0.0) return null;
  const diagRatio = Math.abs(v2.y / (v2.x || 1e-6));
  if (diagRatio < 0.3 || diagRatio > 6.0) return null;

  // Turning direction should maintain the zig-zag. Allow near-straight transitions.
  // New rule: only reject when both turns have the SAME sign (no zig-zag),
  // ignoring near-straight transitions and tiny wobble.
  const cz12 = crossZ(v1, v2);
  const cz23 = crossZ(v2, v3);
  const d12 = dot(v1, v2);
  const d23 = dot(v2, v3);
  const EPS = 0.05;                // tiny wobble tolerance on cross product
  const NEAR_STRAIGHT = 0.985;     // ~10° or less counted as straight
  const strong12 = Math.abs(cz12) >= EPS;
  const strong23 = Math.abs(cz23) >= EPS;
  const near12 = d12 > NEAR_STRAIGHT;
  const near23 = d23 > NEAR_STRAIGHT;
  if (strong12 && strong23 && !near12 && !near23) {
    const s12 = Math.sign(cz12);
    const s23 = Math.sign(cz23);
    if (s12 === s23) {
      console.log('Turns do not zig-zag');
      return null;
    }
  }

  console.log('Directionality checks passed');

  // Ensure diagonal segment is substantial relative to total length.
  const segLens = [
    distance(p0, p1),
    distance(p1, p2),
    distance(p2, p3),
  ];
  if (segLens[1] < 0.12) return null;
  if (segLens[0] < 0.08 || segLens[2] < 0.08) return null;

  const bounds = { minX, minY, width, height };
  const quality = scoreQuality(segLens, v1, v2, v3);

  console.debug(`Lightning gesture recognized with quality=${quality.toFixed(3)}`);

  return {
    quality,
    bounds,
    normalizedPath: resampled,
  };
}

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function resamplePolyline(points, segments) {
  if (!Array.isArray(points) || points.length === 0) return [];
  if (points.length === 1) return points.slice();
  const total = points.length - 1;
  if (total <= 0) return points.slice();

  const cumulative = cumulativeLengths(points);
  const totalLength = cumulative[cumulative.length - 1] || 0;
  if (totalLength <= 0) return points.slice();

  const result = [];
  for (let i = 0; i < segments; i++) {
    const fraction = i / (segments - 1);
    const target = fraction * totalLength;
    result.push(sampleAtLength(points, cumulative, target));
  }
  return result;
}

function cumulativeLengths(points) {
  const arr = [0];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    arr[i] = arr[i - 1] + Math.hypot(cur.x - prev.x, cur.y - prev.y);
  }
  return arr;
}

function sampleAtLength(points, cumulative, target) {
  for (let i = 1; i < cumulative.length; i++) {
    if (cumulative[i] >= target) {
      const prevLen = cumulative[i - 1];
      const nextLen = cumulative[i];
      const t = (target - prevLen) / Math.max(1e-6, nextLen - prevLen);
      const a = points[i - 1];
      const b = points[i];
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      };
    }
  }
  const last = points[points.length - 1];
  return { x: last.x, y: last.y };
}

function samplePointAtFraction(points, cumulative, fraction) {
  if (!points.length) return null;
  const totalLength = cumulative[cumulative.length - 1] || 0;
  if (totalLength <= 0) return null;
  return sampleAtLength(points, cumulative, fraction * totalLength);
}

function unitVector(a, b) {
  if (!a || !b) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len <= 1e-6) return null;
  return { x: dx / len, y: dy / len };
}

function crossZ(a, b) {
  return a.x * b.y - a.y * b.x;
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function scoreQuality(lengths, v1, v2, v3) {
  const idealDiag = 0.33;
  const diagScore = 1 - Math.abs(lengths[1] - idealDiag);
  const horizontalAlignment = 1 - (Math.abs(v1.y) + Math.abs(v3.y)) * 0.5;
  const diagonalAlignment = 1 - Math.min(1, Math.abs(Math.abs(v2.x) - Math.abs(v2.y)));
  const score = (diagScore * 0.35) + (horizontalAlignment * 0.3) + (diagonalAlignment * 0.35);
  return Math.max(0, Math.min(1, score));
}

export function _testRecognizeLightningGesture(points) {
  return recognizeLightningGesture(points);
}

/**
 * Recognize a diagonal slash (left- or right-leaning).
 * Looser than lightning: prefers a mostly straight diagonal path.
 * Returns same shape as lightning recognizer.
 * @param {{x:number,y:number}[]} points
 * @returns {{ quality:number, bounds:{minX:number,minY:number,width:number,height:number}, normalizedPath:{x:number,y:number}[] }|null}
 */
export function recognizeMeteorGesture(points) {
  if (!Array.isArray(points) || points.length < 6) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let totalLength = 0;
  console.log(`Recognizing meteor gesture from ${points.length} points`);
  for (let i = 0; i < points.length; i++) {
    const p = points[i]; if (!p) continue;
    const x = Number(p.x), y = Number(p.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (i > 0) { const q = points[i - 1]; totalLength += Math.hypot(x - q.x, y - q.y); }
  }
  const width = maxX - minX; const height = maxY - minY;
  // Use a diagonal-based size test that's more forgiving for slashes
  const localMin = Math.max(12, Math.floor(MIN_BOUNDS * 0.8));
  const diag = Math.hypot(width, height);
  if (diag < localMin) return null;
  if (totalLength < MIN_TOTAL_LENGTH) return null;

  const normalized = points.map((p) => ({
    x: clamp01((p.x - minX) / (width || 1)),
    y: clamp01((p.y - minY) / (height || 1)),
  }));

  

  const resampled = resamplePolyline(normalized, 32);
  if (!Array.isArray(resampled) || resampled.length < 2) return null;
  const p0 = resampled[0];
  const pN = resampled[resampled.length - 1];
  if (!p0 || !pN) return null;
  const v = unitVector(p0, pN);
  if (!v) return null;
  // Require both components substantial (diagonal-ish)
  if (Math.abs(v.x) < 0.35 || Math.abs(v.y) < 0.35) {
    console.log(`Meteor gesture not diagonal enough: vx=${v.x.toFixed(3)} vy=${v.y.toFixed(3)}`);
    return null;
  }
  // Straightness: average perpendicular error to the segment
  let err = 0;
  const ax = p0.x, ay = p0.y, bx = pN.x, by = pN.y;
  const dx = bx - ax, dy = by - ay; const segLen = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < resampled.length - 1; i++) {
    const p = resampled[i];
    // cross product magnitude over segment length ~ distance to line (normalized)
    const dist = Math.abs((p.x - ax) * dy - (p.y - ay) * dx) / segLen;
    err += dist;
  }
  err /= Math.max(1, resampled.length - 2);
  if (err > 0.20){
    console.log(`Meteor gesture too wobbly: err=${err.toFixed(3)}`);
     return null; // too wobbly
  }

  // Quality favors diagonal balance and low error
  const diagBalance = 1 - Math.abs(Math.abs(v.x) - Math.abs(v.y));
  const quality = Math.max(0, Math.min(1, (diagBalance * 0.6) + ((1 - Math.min(1, err / 0.3)) * 0.4)));
  return {
    quality,
    bounds: { minX, minY, width, height },
    normalizedPath: resampled,
  };
}
