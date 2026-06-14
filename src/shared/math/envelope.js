function durationTicks(value) {
  return Math.max(0, Number(value) | 0);
}

/**
 * Piecewise-linear envelope interpolation.
 *
 * Phases:
 *   [0, rampIn)            : startValue -> toValue
 *   [rampIn, rampIn+hold)  : toValue
 *   [rampIn+hold, total]   : toValue -> endValue
 *
 * @param {number} startValue
 * @param {number} toValue
 * @param {number} endValue
 * @param {number} rampIn
 * @param {number} hold
 * @param {number} rampOut
 * @param {number} elapsed
 * @returns {number}
 */
export function computeEnvelopeValue(startValue, toValue, endValue, rampIn, hold, rampOut, elapsed) {
  const inTicks = durationTicks(rampIn);
  const holdTicks = durationTicks(hold);
  const outTicks = durationTicks(rampOut);

  if (elapsed <= 0) return startValue;
  const total = inTicks + holdTicks + outTicks;
  if (elapsed > total) return endValue;

  if (inTicks > 0 && elapsed <= inTicks) {
    const t = elapsed / inTicks;
    return startValue + (toValue - startValue) * t;
  }

  if (elapsed <= inTicks + holdTicks) {
    return toValue;
  }

  if (outTicks <= 0) return toValue;
  const t = (elapsed - inTicks - holdTicks) / outTicks;
  return toValue + (endValue - toValue) * Math.min(1, t);
}
