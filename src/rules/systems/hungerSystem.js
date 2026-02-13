// src/rules/systems/hungerSystem.js
// Per-tick hunger escalation system.
// Phase: effects (after effectSystem, before manaRegenerationSystem)
// Queries entities with Hunger, increments hunger counter, applies severity effects,
// projects status into Status component for HUD display.

import { Hunger } from '../components/Hunger.js';
import { Vitality } from '../components/Vitality.js';
import { Status } from '../components/Status.js';
import { HUNGER_STATUS_TYPES, HUNGER_POTENCY, getHungerLevel } from '../data/food.js';

/**
 * hungerSystem — processes hunger escalation each tick.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function hungerSystem(world) {
  for (const [id, hc] of world.query(Hunger)) {
    if (!hc) continue;

    // 1) Tick satiation or hunger
    if (hc.satiation > 0) {
      hc.satiation -= 1;
    } else {
      hc.hunger += 1;
    }

    const level = getHungerLevel(hc.hunger);
    const turn = world.step | 0;

    // 2) Apply HP effects based on severity
    const vit = world.get(id, Vitality);
    if (vit) {
      // Starving: 1 HP damage every 5 turns
      if (level === 'starving' && turn % 5 === 0) {
        const dmg = 1;
        vit.hp = Math.max(0, vit.hp - dmg);
        try { world.emit && world.emit('damage', { id, amount: dmg, source: 'starvation' }); } catch { /* */ }
        if (vit.hp <= 0) {
          try { world.emit && world.emit('died', { id, cause: 'starvation' }); } catch { /* */ }
        }
      }
      // Wasting: 2 HP damage every 3 turns
      if (level === 'wasting' && turn % 3 === 0) {
        const dmg = 2;
        vit.hp = Math.max(0, vit.hp - dmg);
        try { world.emit && world.emit('damage', { id, amount: dmg, source: 'starvation' }); } catch { /* */ }
        if (vit.hp <= 0) {
          try { world.emit && world.emit('died', { id, cause: 'starvation' }); } catch { /* */ }
        }
      }
      // Satiated bonus: heal 1 HP every 5 turns
      if (hc.satiation > 0 && turn % 5 === 0) {
        const before = vit.hp;
        vit.hp = Math.min(vit.maxHp, vit.hp + 1);
        if (vit.hp > before) {
          try { world.emit && world.emit('healed', { id, amount: 1 }); } catch { /* */ }
        }
      }
    }

    // 3) Project hunger status into Status component for HUD display
    const stat = world.get(id, Status);
    if (stat && Array.isArray(stat.statuses)) {
      // Remove any previous hunger-related statuses
      stat.statuses = stat.statuses.filter(s => !HUNGER_STATUS_TYPES.has(s.type));

      // Add current hunger status (skip 'normal' as it's invisible)
      if (hc.satiation > 0) {
        stat.statuses.push({ type: 'satiated', duration: hc.satiation, potency: 1, stacks: 1 });
      } else if (level !== 'normal') {
        stat.statuses.push({
          type: level,
          duration: 9999,
          potency: HUNGER_POTENCY[level] || 0,
          stacks: 1,
        });
      }
    }

    // 4) Emit event for UI/bridge
    try {
      world.emit && world.emit('hunger:changed', {
        id, hunger: hc.hunger, satiation: hc.satiation, level,
      });
    } catch { /* */ }
  }
}
