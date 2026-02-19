/**
 * Drink payload hooks keyed by item identity.
 * Hooks run inside the drink pipeline and may use ctx.query/mutate/io/audit/rng.
 *
 * Shape:
 * {
 *   [identity: string]: {
 *     beforeDrink?: (ctx) => unknown,
 *     onDrink?: (ctx) => unknown,
 *     afterDrink?: (ctx) => unknown,
 *   }
 * }
 */
export const DRINK_PAYLOADS = Object.freeze({
  // Add item-specific drink behavior here.
});

/**
 * @param {string} identity
 */
export function getDrinkPayloadByIdentity(identity) {
  const key = String(identity || "").toLowerCase();
  return DRINK_PAYLOADS[key] || null;
}
