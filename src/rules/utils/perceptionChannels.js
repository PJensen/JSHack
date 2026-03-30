import { Player } from "../components/Player.js";
import { Pet } from "../components/Pet.js";
import { Vitality } from "../components/Vitality.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Faction } from "../components/Faction.js";
import { Traits } from "../components/Traits.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { getMonsterTags } from "../data/monsters.js";
import { areFactionsHostile } from "./factionHostility.js";

import { chebyshev as chebyshevDistance } from "./distance.js";
export { chebyshevDistance };

/**
 * Hostile/living actors are canonical perception targets.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} id
 * @param {string} playerFactionKey
 */
export function isPerceptionMonster(world, id, playerFactionKey) {
  if (!(Number(id || 0) > 0)) return false;
  if (!world.has(id, Vitality)) return false;
  if (world.has(id, Player)) return false;
  const factionKey = String(world.get(id, Faction)?.key || "").trim().toLowerCase();
  if (!playerFactionKey || !factionKey) return true;
  return areFactionsHostile(playerFactionKey, factionKey);
}

/**
 * ESP ignores mindless targets.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} id
 */
export function hasMindForEsp(world, id) {
  const tr = /** @type {any} */ (world.get(id, Traits));
  if (tr && tr.mindless === true) return false;
  const tags = getMonsterTags(String(world.get(id, NamedIdentity)?.identity || ""));
  return !tags.includes("mindless");
}

/**
 * Static/non-item world objects can be remembered on explored tiles.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} id
 */
export function isFixedDecorationEntity(world, id) {
  if (!(Number(id || 0) > 0)) return false;
  if (world.has(id, Player)) return false;
  if (world.has(id, Pet)) return false;
  if (world.has(id, Vitality)) return false;
  if (world.has(id, ItemInfo)) return false;
  return true;
}

