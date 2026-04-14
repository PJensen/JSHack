// src/content/weaponHookBridge.js
// Bridge between combatSystem and content-DSL weapon hooks.
// Called from combatSystem after legacy monster hooks,
// before defender reaction procs.

import { NamedIdentity } from '../rules/components/NamedIdentity.js';
import { getCatalogItem } from '../rules/data/itemCatalog.js';
import { ScriptCtx } from './scriptCtx.js';
import { createWorldFacade } from './worldFacade.js';

/**
 * If the weapon has a content-DSL onHit hook, build a ScriptCtx and call it.
 * @param {any} world
 * @param {number} attacker
 * @param {number} defender
 * @param {number} weaponId
 * @param {number} damage
 * @param {boolean} crit
 */
export function runWeaponContentHook(world, attacker, defender, weaponId, damage, crit) {
  if (!weaponId) return;
  const ni = world.get(weaponId, NamedIdentity);
  if (!ni?.identity) return;

  const def = getCatalogItem(ni.identity);
  const hookFn = def?._contentCombatHooks?.onHit;
  if (typeof hookFn !== 'function') return;

  try {
    const facade = createWorldFacade(world, attacker, weaponId);
    const state = {
      actor: attacker,
      itemId: weaponId,
      target: defender,
      identity: ni.identity,
      damage,
      crit,
    };
    const ctx = new ScriptCtx(facade, state);
    // Expose combat specifics
    ctx.hitDamage = damage;
    ctx.wasCrit = !!crit;
    hookFn(ctx);
  } catch (err) {
    console.error(`[weaponHookBridge] Error in onHit for "${ni.identity}":`, err);
  }
}
