// rules/interaction/dispatch.js
// Run an ordered list of callbacks, short-circuiting on cancellation.

/**
 * Execute callbacks in order. Stops immediately if ctx.cancelled becomes true.
 * @param {Array<(ctx: any) => void> | undefined | null} callbacks
 * @param {any} ctx — must expose a `cancelled` property
 * @returns {boolean} true if all callbacks ran without cancellation
 */
export function runCallbackList(callbacks, ctx) {
  if (!Array.isArray(callbacks)) return true;
  for (let i = 0; i < callbacks.length; i++) {
    if (ctx.cancelled) return false;
    const fn = callbacks[i];
    if (typeof fn === "function") fn(ctx);
  }
  return !ctx.cancelled;
}
