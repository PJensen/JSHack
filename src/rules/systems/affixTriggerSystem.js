// Legacy compatibility shim.
// Affix/monster damaged reactions now run inside dealDamage().

const AFFIX_TRIGGERS_KEY = Symbol.for("jshack.affixTriggers");

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
export function installAffixTriggers(world) {
  if (!world || world[AFFIX_TRIGGERS_KEY]) return;
  world[AFFIX_TRIGGERS_KEY] = true;
}
