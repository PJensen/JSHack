// src/rules/systems/affixTriggerSystem.js
// Installs event listeners that dispatch affix scripts on equipment for both attacker and defender contexts.

import { Equipment } from '../components/Equipment.js';
import { ItemInfo } from '../components/ItemInfo.js';
import { AFFIX_DEFS } from '../data/affixes.js';
import { getMonster } from '../data/monsters.js';
import { NamedIdentity } from '../components/NamedIdentity.js';
import { Vitality } from '../components/Vitality.js';
import { degradeFloorMemory } from '../environment/dungeon/transition.js';
import { runScript, ScriptVerb } from '../scripting.js';
import { dealDamage } from '../utils/dealDamage.js';
import { CombatCallbackContext } from '../data/callbacks/combat.js';
import { runCallbackList } from '../interaction/dispatch.js';

const AFFIX_TRIGGERS_KEY = Symbol.for('jshack.affixTriggers');

function eachAffix(world, entityId, cb) {
  const eq = world.get(entityId, Equipment);
  if (!eq) return;
  for (const slotId of [eq.weapon, eq.armor, eq.shield, eq.ring1, eq.ring2, eq.feet]) {
    if (!Number.isInteger(slotId)) continue;
    const info = world.get(slotId, ItemInfo);
    if (!info || !Array.isArray(info.affixes)) continue;
    for (const aId of info.affixes) {
      const a = AFFIX_DEFS[aId];
      if (a) cb(a, slotId);
    }
  }
}

function makeCtx(world, base) {
  // Attach helpers directly to the base object so scripts can mutate base.damage
  base.addBonus = (k, v) => { if (k === 'damage') base.damage += v; };
  base.retaliate = (amount) => {
    dealDamage(world, {
      target: base.attacker,
      amount: Math.max(0, amount | 0),
      source: base.defender,
      type: 'physical',
      cause: 'retaliation',
      bypassResist: true,
      noTrigger: true,
    });
  };
  base.heal = (entity, amount) => {
    const vit = world.get(entity, Vitality);
    if (!vit) return;
    vit.hp = Math.min(vit.maxHp, vit.hp + Math.max(0, amount|0));
  };
  base.healAttacker = (amount) => {
    const vit = world.get(base.attacker, Vitality);
    if (!vit) return;
    vit.hp = Math.min(vit.maxHp, vit.hp + Math.max(0, amount|0));
  };
  return base;
}

/**
 * @param {any} world
 * @param {number} entityId
 * @param {any} ctx
 * @param {{ degradeFloorMemory?:(rng:() => number, opts?:any) => { depth:number } } | null} deps
 */
function runMonsterOnDamaged(world, entityId, ctx, deps = null) {
  const ni = world.get(entityId, NamedIdentity);
  const def = ni ? getMonster(ni.identity) : null;
  const hooks = def?.hooks?.onDamaged;
  if (!hooks) return false;
  if (Array.isArray(hooks) && hooks.length > 0) {
    const cbCtx = new CombatCallbackContext(world, ctx, deps);
    runCallbackList(hooks, cbCtx);
    return true;
  }
  if (typeof hooks === 'function') {
    try { hooks({ world, ctx, deps }); } catch (e) { console.debug('[affixTriggerSystem] onDamaged hook failed:', e); }
    return true;
  }
  return false;
}

export function installAffixTriggers(world) {
  if (!world || world[AFFIX_TRIGGERS_KEY]) return;
  // Handle defender-side reactions on damage. Attacker-side hooks are applied by combatSystem for determinism.
  const off = world.on('damaged', ({ target, amount, source, noTrigger }) => {
    if (noTrigger) return;
    const base = { attacker: source, defender: target, weaponId: 0, damage: amount, world };
    const ctxT = makeCtx(world, base);
    // defender affixes with onDamaged
    eachAffix(world, target, (a) => {
      if (a.triggers?.includes('onDamaged') && a.script) {
        runScript(a.script, ScriptVerb.AffixOnDamaged, world, ctxT);
      }
    });
    // Innate monster on-damaged behavior from monster definition hooks
    runMonsterOnDamaged(world, target, ctxT, { degradeFloorMemory });
  });
  world[AFFIX_TRIGGERS_KEY] = off;
}