/**
 * Normalize faction keys for table lookups.
 * @param {unknown} key
 * @returns {string}
 */
function normalizeFactionKey(key) {
  return String(key || "").trim().toLowerCase();
}

/**
 * Explicit faction hostility table.
 * - player + pet + stone_taunter are allies
 * - enemy is hostile to that ally group
 * - neutral/shopkeeper are non-hostile by default
 * Unknown factions fall back to legacy behavior (different faction => hostile).
 * @type {Readonly<Record<string, ReadonlySet<string>>>}
 */
const HOSTILITY = Object.freeze({
  player: Object.freeze(new Set(["enemy"])),
  pet: Object.freeze(new Set(["enemy"])),
  stone_taunter: Object.freeze(new Set(["enemy"])),
  enemy: Object.freeze(new Set(["player", "pet", "stone_taunter"])),
  neutral: Object.freeze(new Set()),
  shopkeeper: Object.freeze(new Set()),
});

/**
 * Return whether attacker faction is hostile toward defender faction.
 * @param {unknown} attackerFaction
 * @param {unknown} defenderFaction
 * @returns {boolean}
 */
export function areFactionsHostile(attackerFaction, defenderFaction) {
  const attacker = normalizeFactionKey(attackerFaction);
  const defender = normalizeFactionKey(defenderFaction);

  // Preserve legacy behavior for entities with no faction metadata.
  if (!attacker || !defender) return true;
  if (attacker === defender) return false;

  const explicit = HOSTILITY[attacker];
  if (explicit) return explicit.has(defender);

  // Legacy fallback for unknown factions.
  return true;
}

