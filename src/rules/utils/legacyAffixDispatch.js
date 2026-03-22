import { Vitality } from "../components/Vitality.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { getMonster } from "../data/monsters.js";
import { CombatCallbackContext } from "../data/callbacks/combat.js";
import { runCallbackList } from "../interaction/dispatch.js";
import { degradeFloorMemory } from "../environment/dungeon/floorMemory.js";
import { effectiveMaxHp } from "./passiveBonuses.js";

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {{ attacker:number, defender:number, weaponId:number, damage:number, world:any }} base
 * @param {{ retaliate?:(amount:number)=>void, heal?:(entity:number, amount:number)=>void, healAttacker?:(amount:number)=>void }} [helpers]
 */
export function createLegacyCombatFrame(world, base, helpers = {}) {
  base.addBonus = (key, value) => {
    if (key === "damage") base.damage += value;
  };
  base.retaliate = (amount) => {
    if (typeof helpers.retaliate === "function") {
      helpers.retaliate(amount);
    }
  };
  base.heal = (entity, amount) => {
    if (typeof helpers.heal === "function") {
      helpers.heal(entity, amount);
      return;
    }
    const vit = world.get(entity, Vitality);
    if (!vit) return;
    vit.hp = Math.min(effectiveMaxHp(world, entity, vit), vit.hp + Math.max(0, amount | 0));
  };
  base.healAttacker = (amount) => {
    if (typeof helpers.healAttacker === "function") {
      helpers.healAttacker(amount);
      return;
    }
    const vit = world.get(base.attacker, Vitality);
    if (!vit) return;
    vit.hp = Math.min(effectiveMaxHp(world, base.attacker, vit), vit.hp + Math.max(0, amount | 0));
  };
  return base;
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} entityId
 * @param {"onBeforeHit"|"onHit"|"onDamaged"} hookName
 * @param {any} frame
 */
export function runLegacyMonsterHook(world, entityId, hookName, frame) {
  const ni = world.get(entityId, NamedIdentity);
  const def = ni ? getMonster(ni.identity) : null;
  const hooks = def?.hooks?.[hookName];
  if (!hooks) return false;
  if (Array.isArray(hooks) && hooks.length > 0) {
    const ctx = new CombatCallbackContext(world, frame, { degradeFloorMemory });
    runCallbackList(hooks, ctx);
    return true;
  }
  if (typeof hooks === "function") {
    try {
      hooks({ world, ctx: frame, deps: { degradeFloorMemory } });
    } catch (error) {
      console.debug(`[legacyAffixDispatch] ${hookName} hook failed:`, error);
    }
    return true;
  }
  return false;
}
