import { PrayIntent } from "../components/Intents/PrayIntent.js";
import { Devotion } from "../components/Devotion.js";
import { Player } from "../components/Player.js";
import { Vitality } from "../components/Vitality.js";
import { Hunger } from "../components/Hunger.js";
import { Status } from "../components/Status.js";
import { getDeityInstance } from "./deitySystem.js";

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

          // Emit event for logging/UI feedback
          try {
            world.emit && world.emit('prayer', {
              actor: id,
              deityId: devotion.deityId,
              distress
            });
          } catch { /* */ }
        }
      }
    }

    // Consume the intent
    try { world.remove(id, PrayIntent); } catch {}
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
    if (hunger.hunger > 800) {
      needs.push('food');
      severity += 0.9; // Starving
    } else if (hunger.hunger > 400) {
      needs.push('food');
      severity += 0.5; // Very hungry
    } else if (hunger.hunger > 200) {
      needs.push('food');
      severity += 0.2; // Hungry
    }
  }

  // Check for harmful status effects
  if (world.has(playerId, Status)) {
    const status = world.get(playerId, Status);
    for (const s of status.statuses || []) {
      if (s.type === 'diseased' || s.type === 'poisoned') {
        needs.push('cure');
        severity += 0.6;
      } else if (s.type === 'cursed') {
        needs.push('blessing');
        severity += 0.7;
      } else if (s.type === 'bleeding') {
        needs.push('healing');
        severity += 0.5;
      }
    }
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
