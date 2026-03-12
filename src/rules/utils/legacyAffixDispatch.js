import { Equipment, NON_AMMO_GEAR_SLOTS } from "../components/Equipment.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Vitality } from "../components/Vitality.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import {
  affixHasTrigger,
  getAffix,
  getAffixTriggerScripts,
} from "../data/affixes.js";
import { getMonster } from "../data/monsters.js";
import { CombatCallbackContext } from "../data/callbacks/combat.js";
import { runCallbackList } from "../interaction/dispatch.js";
import { runScript, ScriptVerb } from "../scripting.js";
import { degradeFloorMemory } from "../environment/dungeon/transition.js";

const TRIGGER_TO_VERB = Object.freeze({
  onBeforeHit: ScriptVerb.AffixOnBeforeHit,
  onHit: ScriptVerb.AffixOnHit,
  onDamaged: ScriptVerb.AffixOnDamaged,
});

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} entityId
 * @param {(affixId:string, affix:any, slotId:number, slot:string) => void} fn
 * @param {{ includeSlots?: string[] | null, excludeSlots?: string[] | null }} [options]
 */
export function forEachLegacyAffix(world, entityId, fn, options = {}) {
  const eq = world.get(entityId, Equipment);
  if (!eq) return;
  const includeSlots = Array.isArray(options.includeSlots) ? new Set(options.includeSlots) : null;
  const excludeSlots = new Set(Array.isArray(options.excludeSlots) ? options.excludeSlots : []);
  for (const slot of NON_AMMO_GEAR_SLOTS) {
    if (includeSlots && !includeSlots.has(slot)) continue;
    if (excludeSlots.has(slot)) continue;
    const slotId = Number(eq[slot] || 0) | 0;
    if (!(slotId > 0)) continue;
    const info = world.get(slotId, ItemInfo);
    if (!info || !Array.isArray(info.affixes)) continue;
    for (const affixId of info.affixes) {
      const affix = getAffix(affixId);
      if (affix) fn(String(affixId), affix, slotId, slot);
    }
  }
}

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
    vit.hp = Math.min(vit.maxHp, vit.hp + Math.max(0, amount | 0));
  };
  base.healAttacker = (amount) => {
    if (typeof helpers.healAttacker === "function") {
      helpers.healAttacker(amount);
      return;
    }
    const vit = world.get(base.attacker, Vitality);
    if (!vit) return;
    vit.hp = Math.min(vit.maxHp, vit.hp + Math.max(0, amount | 0));
  };
  return base;
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} entityId
 * @param {"onBeforeHit"|"onHit"|"onDamaged"} trigger
 * @param {any} frame
 * @param {{ includeSlots?: string[] | null, excludeSlots?: string[] | null, onAffix?:(affixId:string, affix:any, slotId:number, slot:string)=>void }} [options]
 */
export function runLegacyAffixScripts(world, entityId, trigger, frame, options = {}) {
  const verb = TRIGGER_TO_VERB[trigger];
  if (!verb) return;
  forEachLegacyAffix(world, entityId, (affixId, affix, slotId, slot) => {
    const triggerScripts = getAffixTriggerScripts(affixId, trigger);
    if (!affixHasTrigger(affixId, trigger) || triggerScripts.length === 0) return;
    for (let i = 0; i < triggerScripts.length; i++) {
      runScript(triggerScripts[i], verb, world, frame);
    }
    if (typeof options.onAffix === "function") options.onAffix(affixId, affix, slotId, slot);
  }, options);
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

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {{ attacker:number, defender:number, amount:number, weaponId?:number, noTrigger?:boolean }} params
 * @param {{ retaliate?:(amount:number)=>void, heal?:(entity:number, amount:number)=>void, healAttacker?:(amount:number)=>void }} [helpers]
 */
export function runLegacyOnDamagedReactions(world, params, helpers = {}) {
  if (params?.noTrigger) return null;
  const frame = createLegacyCombatFrame(world, {
    attacker: Number(params?.attacker || 0) | 0,
    defender: Number(params?.defender || 0) | 0,
    weaponId: Number(params?.weaponId || 0) | 0,
    damage: Math.max(0, Number(params?.amount || 0) | 0),
    world,
  }, helpers);
  runLegacyAffixScripts(world, frame.defender, "onDamaged", frame);
  runLegacyMonsterHook(world, frame.defender, "onDamaged", frame);
  return frame;
}
