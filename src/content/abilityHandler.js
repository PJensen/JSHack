// src/content/abilityHandler.js
// Generic handler for content-DSL weapon abilities.
// Replaces per-weapon hardcoded event handlers (like scrollWandWiring's
// sunsword:ray) with a single data-driven handler.
//
// When a DSL item's onUse emits 'content:ability:request', this handler
// opens targeting (if needed) and runs the ability's onActivate script.

import { NamedIdentity } from '../rules/components/NamedIdentity.js';
import { ActiveEffects } from '../rules/components/ActiveEffects.js';
import { Position } from '../rules/components/Position.js';
import { getAbility } from './registry.js';
import { ScriptCtx } from './scriptCtx.js';
import { createWorldFacade } from './worldFacade.js';
import { emitSafe } from '../rules/utils/emitSafe.js';
import { isItemOnCooldown, getItemCooldownRemaining } from '../rules/utils/itemCooldowns.js';

const _installed = Symbol.for('jshack:content:abilityHandler:installed');

/**
 * Install the content ability handler. Call once at display wiring time
 * alongside installContentVfxWiring.
 *
 * @param {{
 *   world: any,
 *   targeting: { openEnemyTargeting: Function },
 *   playerEntity: () => { id: number, pos: { x: number, y: number } } | null,
 *   scanVisibleEnemies: Function,
 * }} deps
 */
export function installContentAbilityHandler({ world, targeting, playerEntity, scanVisibleEnemies }) {
  if (/** @type {any} */ (world)[_installed]) return;
  /** @type {any} */ (world)[_installed] = true;

  world.on('content:ability:request', ({ actor, itemId, abilityId, identity }) => {
    const spec = getAbility(identity, abilityId);
    if (!spec || typeof spec.onActivate !== 'function') return;

    // ── Cooldown gate ───────────────────────────────────────────
    if (spec.cooldown > 0 && isItemOnCooldown(world, itemId)) {
      const remaining = getItemCooldownRemaining(world, itemId);
      const name = world.get(itemId, NamedIdentity)?.name || 'Item';
      emitSafe(world, 'message', { text: `${name} is still cooling down (${remaining} turns).`, type: 'warning' });
      return;
    }

    // ── No targeting needed: fire immediately ───────────────────
    if (spec.targeting === 'none' || !spec.targeting) {
      _runAbility(world, actor, itemId, identity, 0, spec);
      return;
    }

    // ── Enemy targeting ─────────────────────────────────────────
    if (spec.targeting === 'enemy') {
      const pe = playerEntity();
      if (!pe) return;
      const px = (pe.pos?.x ?? 0) | 0;
      const py = (pe.pos?.y ?? 0) | 0;
      const range = spec.range || 6;

      const enemies = scanVisibleEnemies(world, px, py, range, { playerId: pe.id });
      if (enemies.length === 0) {
        emitSafe(world, 'message', { text: 'No visible enemies in range.', type: 'system' });
        return;
      }

      targeting.openEnemyTargeting({
        spellId: `__content_${identity}_${abilityId}__`,
        spellName: `${world.get(itemId, NamedIdentity)?.name || identity} — ${spec.name}`,
        range,
        enemies,
        onConfirm: (enemyId) => {
          _runAbility(world, actor, itemId, identity, enemyId, spec);
        },
      });
      return;
    }
  });
}

function _runAbility(world, actor, itemId, identity, targetId, spec) {
  try {
    const facade = createWorldFacade(world, actor, itemId);
    const state = { actor, itemId, target: targetId, identity };
    const ctx = new ScriptCtx(facade, state);
    spec.onActivate(ctx);
  } catch (err) {
    console.error(`[abilityHandler] Error in "${identity}:${spec.id}":`, err);
  }
}
