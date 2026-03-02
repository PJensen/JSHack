import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Creature taxonomy used for targeting, damage modifiers, and spell effects.
 *
 * Spells, weapon affixes, and deity mechanics can query this component to
 * apply type-specific rules (e.g. Turn Undead, holy weapons vs demons,
 * beast-calming spells, construct immunity to poison, etc.).
 *
 * Set via the `creatureType` param in the Creature archetype.
 * Defaults to "humanoid" for the base Creature archetype.
 */
export const CREATURE_TYPES = Object.freeze({
  humanoid:  "humanoid",   // goblins, orcs, kobolds, humans
  undead:    "undead",     // skeletons, zombies, liches, vampires
  beast:     "beast",      // rats, wolves, giant insects, snakes
  demon:     "demon",      // demons, devils, corrupted spirits
  construct: "construct",  // golems, animated statues, clockwork
  plant:     "plant",      // shambling mounds, shriekers, fungal horrors
  elemental: "elemental",  // fire elementals, water weirds, earth titans
});

export const CreatureType = defineComponent("CreatureType", {
  type: CREATURE_TYPES.humanoid,
});

/**
 * Infer a CREATURE_TYPES value from a monster definition's `tags` array.
 * Priority order: undead > demon > construct > plant > elemental > beast > humanoid.
 *
 * Used in toMonsterSpawnParams() so that CreatureType is populated correctly
 * at spawn time from the existing tags-based monster data.
 *
 * @param {string[]} tags
 * @returns {string}
 */
export function creatureTypeFromTags(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return CREATURE_TYPES.humanoid;
  if (tags.includes("undead")    || tags.includes("skeletal"))  return CREATURE_TYPES.undead;
  if (tags.includes("demon"))                                    return CREATURE_TYPES.demon;
  if (tags.includes("construct") || tags.includes("mechanical")) return CREATURE_TYPES.construct;
  if (tags.includes("plant")     || tags.includes("fungal"))    return CREATURE_TYPES.plant;
  if (tags.includes("elemental"))                                return CREATURE_TYPES.elemental;
  if (tags.includes("beast")     || tags.includes("vermin")
   || tags.includes("insect")    || tags.includes("reptile"))   return CREATURE_TYPES.beast;
  return CREATURE_TYPES.humanoid;
}
