// src/rules/systems/hungerSystem.js
// Per-tick hunger escalation system.
// Phase: effects (after effectSystem, before manaRegenerationSystem)
// Queries entities with Hunger, increments hunger counter, applies severity effects,
// projects status into Status component for HUD display.

import { Hunger } from '../components/Hunger.js';
import { Vitality } from '../components/Vitality.js';
import { Status } from '../components/Status.js';
import { Settings } from '../components/Settings.js';
import { HUNGER_STATUS_TYPES, HUNGER_POTENCY, getHungerLevel } from '../data/food.js';
import { TURNS_PER_DAY } from '../data/calendar.js';
import { dealDamage } from '../utils/dealDamage.js';
import { getPassiveBonuses, effectiveMaxHp } from '../utils/passiveBonuses.js';
import { Traits } from '../components/Traits.js';
import { statusStrength } from '../utils/statusFacade.js';
import { emitSafe } from '../utils/emitSafe.js';

const STARVING_DAMAGE_INTERVAL = Math.max(1, Math.floor(TURNS_PER_DAY / 8));
const WASTING_DAMAGE_INTERVAL = Math.max(1, Math.floor(TURNS_PER_DAY / 16));

/**
 * hungerSystem — processes hunger escalation each tick.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function hungerSystem(world) {
  for (const [id, hc] of world.query(Hunger)) {
    if (!hc) continue;

    // Skip hunger processing if disabled in settings
    const settings = world.get(id, Settings);
    if (settings && settings.hungerEnabled === false) continue;

    // Flag gluttonous trait when satiation hits the 200 cap
    if (hc.satiation >= 200) {
      const tr = world.get(id, Traits);
      if (tr) { tr.gluttonous = true; }
      else { world.add(id, Traits, { gluttonous: true }); }
    }

    // 1) Tick satiation or hunger (equipment hungerRate adds extra ticks)
    const passive = getPassiveBonuses(world, id);
    const extraHunger = Math.max(0, Number(passive?.hungerRateDerived || 0) | 0);
    const ravenousPot = statusStrength(world, id, "ravenous");
    const hungerTicks = 1 + extraHunger + (ravenousPot > 0 ? ravenousPot : 0);
    if (hc.satiation > 0) {
      hc.satiation = Math.max(0, hc.satiation - hungerTicks);
    } else {
      hc.hunger += hungerTicks;
    }

    const level = getHungerLevel(hc.hunger);
    const turn = world.step | 0;

    // 2) Apply HP effects based on severity
    const vit = world.get(id, Vitality);
    if (vit) {
      // Starving: 1 HP damage every ~1/8 day
      if (level === 'starving' && turn % STARVING_DAMAGE_INTERVAL === 0) {
        dealDamage(world, { target: id, amount: 1, type: 'starvation', cause: 'starvation', bypassInvuln: true, bypassResist: true });
      }
      // Wasting: 2 HP damage every ~1/16 day
      if (level === 'wasting' && turn % WASTING_DAMAGE_INTERVAL === 0) {
        dealDamage(world, { target: id, amount: 2, type: 'starvation', cause: 'starvation', bypassInvuln: true, bypassResist: true });
      }
      // Satiated bonus: heal 1 HP every 5 turns
      if (hc.satiation > 0 && turn % 5 === 0) {
        const before = vit.hp;
        vit.hp = Math.min(effectiveMaxHp(world, id, vit), vit.hp + 1);
        if (vit.hp > before) {
          emitSafe(world, 'healed', { id, amount: 1 });
        }
      }
    }

    // 3) Project hunger status into Status component for HUD display
    const stat = world.get(id, Status);
    const nextStatuses = Array.isArray(stat?.statuses)
      ? stat.statuses.filter(s => !HUNGER_STATUS_TYPES.has(s.type))
      : [];

    // Add current hunger status (skip 'normal' as it's invisible)
    if (hc.satiation > 0) {
      nextStatuses.push({ type: 'satiated', duration: hc.satiation, potency: 1, stacks: 1 });
    } else if (level !== 'normal') {
      nextStatuses.push({
        type: level,
        duration: 9999,
        potency: HUNGER_POTENCY[level] || 0,
        stacks: 1,
      });
    }

    try {
      if (stat) world.set(id, Status, { statuses: nextStatuses });
      else if (nextStatuses.length > 0) world.add(id, Status, { statuses: nextStatuses });
    } catch { /* deferred during tick; will flush post-tick */ }

    // 4) Emit event for UI/bridge
    emitSafe(world, 'hunger:changed', {
      id, hunger: hc.hunger, satiation: hc.satiation, level,
    });
  }
}
