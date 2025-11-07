// display/input/gestureRecognizers.js
// Pure helper utilities for recognizing pointer gestures.

const MIN_BOUNDS = 30;
const MIN_TOTAL_LENGTH = 90;
const SEGMENT_FRACTIONS = [0.33, 0.66];

/**
 * Attempt to recognize a "Z" lightning gesture from a collection of canvas-space points.
 * @param {{x:number,y:number}[]} points
 * @returns {{ quality:number, bounds:{minX:number,minY:number,width:number,height:number}, normalizedPath:{x:number,y:number}[] }|null}
 */
export function recognizeLightningGesture(points) {
  if (!Array.isArray(points) || points.length < 6) return null;

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

  // Ensure gesture roughly travels left-to-right and top-to-bottom.
  if (p0.x > 0.4 || p0.y > 0.45) return null;
  if (p3.x < 0.6 || p3.y < 0.55) return null;

  const p1 = samplePointAtFraction(resampled, cumulative, SEGMENT_FRACTIONS[0]);
  const p2 = samplePointAtFraction(resampled, cumulative, SEGMENT_FRACTIONS[1]);
  if (!p1 || !p2) return null;

  const v1 = unitVector(p0, p1);
  const v2 = unitVector(p1, p2);
  const v3 = unitVector(p2, p3);

  if (!v1 || !v2 || !v3) return null;

  // First and third segments: mostly horizontal, moving right.
  if (v1.x <= 0.4) return null;
  if (Math.abs(v1.y) > Math.max(0.35, Math.abs(v1.x) * 0.45)) return null;
  if (v3.x <= 0.4) return null;
  if (Math.abs(v3.y) > Math.max(0.35, Math.abs(v3.x) * 0.45)) return null;

  // Middle segment: downward-left diagonal.
  if (v2.x >= -0.1) return null;
  if (v2.y <= 0.1) return null;
  const diagRatio = Math.abs(v2.y / (v2.x || 1e-6));
  if (diagRatio < 0.4 || diagRatio > 3.5) return null;

  // Turning direction should maintain the zig-zag (negative cross product for Z).
  if (crossZ(v1, v2) >= -0.05) return null;
  if (crossZ(v2, v3) >= -0.05) return null;

  // Ensure diagonal segment is substantial relative to total length.
  const segLens = [
    distance(p0, p1),
    distance(p1, p2),
    distance(p2, p3),
  ];
  if (segLens[1] < 0.18) return null;
  if (segLens[0] < 0.12 || segLens[2] < 0.12) return null;

  const bounds = { minX, minY, width, height };
  const quality = scoreQuality(segLens, v1, v2, v3);

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

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function scoreQuality(lengths, v1, v2, v3) {
  const idealDiag = 0.33;
  const diagScore = 1 - Math.abs(lengths[1] - idealDiag);
  const horizontalAlignment = 1 - (Math.abs(v1.y) + Math.abs(v3.y)) * 0.5;
  const diagonalAlignment = 1 - Math.abs(Math.abs(v2.x) - Math.abs(v2.y));
  const score = (diagScore * 0.4) + (horizontalAlignment * 0.3) + (diagonalAlignment * 0.3);
  return Math.max(0, Math.min(1, score));
}

export function _testRecognizeLightningGesture(points) {
  return recognizeLightningGesture(points);
}

