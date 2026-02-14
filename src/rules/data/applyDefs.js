// rules/data/applyDefs.js
// Maps item identities to their "Apply" behavior.
// targetMode: "inventory" = pick a target from inventory
// targetFilter: type string to filter target items by ItemInfo.type

export const APPLY_DEFS = {
  stone_touchstone: { targetMode: "inventory", targetFilter: "gem" },
};

/**
 * Get the apply definition for an item identity.
 * @param {string} identity
 * @returns {{ targetMode: string, targetFilter: string } | null}
 */
export function getApplyDef(identity) {
  return APPLY_DEFS[identity] || null;
}
