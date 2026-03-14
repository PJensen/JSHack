import { PrayIntent } from "../components/Intents/PrayIntent.js";
import { Devotion } from "../components/Devotion.js";
import { Player } from "../components/Player.js";
import { Vitality } from "../components/Vitality.js";
import { Hunger } from "../components/Hunger.js";
import { Equipment, NON_AMMO_GEAR_SLOTS } from "../components/Equipment.js";
import { Beatitude } from "../components/Beatitude.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { getDeityInstance } from "./deitySystem.js";
import { hasStatus } from "../utils/statusFacade.js";
import { getHungerLevel } from "../data/food.js";

/**
 * praySystem — processes PrayIntent by calling deity.pray()
 * Detects player distress and boosts prayer effectiveness when in need.
 * (Spam is handled by deity's Supplicant system — predictability angers gods)
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function praySystem(world) {
  for (const [id] of world.query(PrayIntent)) {
    // Only players with devotion can pray
    if (world.has(id, Player)) {
      const devotion = world.get(id, Devotion);
      if (devotion?.deityId) {
        const deity = getDeityInstance(devotion.deityId);
        if (deity) {
          // Assess player distress to determine prayer urgency
          const distress = assessDistress(world, id);

          // Normal prayer
          deity.pray();

          // If player is suffering, boost serenity to increase miracle chance
          if (distress.desperate) {
            // Desperate plea — offer suffering as devotion, which pleases healing deities
            deity.offer('suffering', {
              value: distress.severity,
              alignment: 'lawful' // Suffering offerings appeal to order/healing deities
            });
          } else if (distress.troubled) {
            // Moderate need — small serenity boost via lesser offering
            deity.offer('plea', {
              value: distress.severity * 0.5,
              alignment: 'neutral'
            });
          }

          // Prayer-based curse removal: a healthy player can focus spiritual energy
          if (!distress.desperate && !distress.troubled) {
            const vit = world.get(id, Vitality);
            const hpPct = vit ? (vit.hp / vit.maxHp) : 0;
            if (hpPct > 0.8) {
              const eq = world.get(id, Equipment);
              if (eq) {
                for (const slot of NON_AMMO_GEAR_SLOTS) {
                  const itemId = eq[slot];
                  if (!Number.isInteger(itemId) || itemId <= 0) continue;
                  const beat = world.get(itemId, Beatitude);
                  if (beat && beat.state === 'cursed') {
                    beat.state = 'uncursed';
                    const itemName = world.get(itemId, NamedIdentity)?.name || 'item';
                    try {
                      world.emit && world.emit('prayer:curse-removed', {
                        actor: id,
                        itemId,
                        name: itemName,
                        deityId: devotion.deityId,
                      });
                    } catch (e) { console.debug('[praySystem] emit prayer:curse-removed failed:', e); }
                    break; // one item per prayer
                  }
                }
              }
            }
          }

          // Emit event for logging/UI feedback
          try {
            world.emit && world.emit('prayer', {
              actor: id,
              deityId: devotion.deityId,
              distress
            });
          } catch (e) { console.debug('[praySystem] emit prayer failed:', e); }
        }
      }
    }

    // Consume the intent
    try { world.remove(id, PrayIntent); } catch {} // ECS: may not exist
  }
}

/**
 * Assess how much the player is suffering.
 * @returns {{ desperate: boolean, troubled: boolean, severity: number, needs: string[] }}
 */
function assessDistress(world, playerId) {
  const needs = [];
  let severity = 0;

  // Check vitality (HP)
  if (world.has(playerId, Vitality)) {
    const vit = world.get(playerId, Vitality);
    const hpPercent = vit.hp / vit.maxHp;
    if (hpPercent < 0.2) {
      needs.push('healing');
      severity += 0.8; // Critical HP
    } else if (hpPercent < 0.4) {
      needs.push('healing');
      severity += 0.4; // Low HP
    }
  }

  // Check hunger
  if (world.has(playerId, Hunger)) {
    const hunger = world.get(playerId, Hunger);
    if (hunger?.satiation > 0) {
      // Satiated actors are not in food distress.
    } else {
      const level = getHungerLevel(Number(hunger?.hunger || 0));
      if (level === 'wasting' || level === 'starving') {
        needs.push('food');
        severity += 0.9;
      } else if (level === 'famished') {
        needs.push('food');
        severity += 0.5;
      } else if (level === 'hungry' || level === 'peckish') {
        needs.push('food');
        severity += 0.2;
      }
    }
  }

  // Check for harmful status effects (active-effects first).
  if (hasStatus(world, playerId, 'disease') || hasStatus(world, playerId, 'poisoned')) {
    needs.push('cure');
    severity += 0.6;
  }
  if (hasStatus(world, playerId, 'cursed')) {
    needs.push('blessing');
    severity += 0.7;
  }
  if (hasStatus(world, playerId, 'bleeding')) {
    needs.push('healing');
    severity += 0.5;
  }

  // Cap severity at 1.0
  severity = Math.min(1.0, severity);

  return {
    desperate: severity > 0.7,
    troubled: severity > 0.3 && severity <= 0.7,
    severity,
    needs
  };
}
