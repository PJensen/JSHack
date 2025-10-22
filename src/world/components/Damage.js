// Damage.js
// ECS Component: Represents a damage instance or damage-over-time (DoT) effect.
//
// This component is designed to be attached to short-lived entities that
// represent damage events (for example, an impact, explosion, or a DoT
// effect). Systems that process damage should consume entities with
// `Damage` + `Position` (or other targeting components), apply the damage
// to valid targets, and then remove or update the damage entity accordingly.
import { defineComponent } from '../../lib/ecs/core.js';

export const Damage = defineComponent('Damage', {
  // primary amount. For DoT effects this can represent total damage or
  // damage per tick depending on system conventions; see `duration` below.
  amount: 1,

  // semantic type of damage (used for resistances/weaknesses): e.g. 'physical',
  // 'fire', 'poison', 'arcane', etc. Systems can use this to select mitigation.
  type: 'physical',

  // entity id (number/string) that caused this damage, if known
  source: null,

  // AoE radius in tiles (0 = single-target / same tile). Systems should
  // query entities within this radius to apply the damage.
  area: 0,

  // Duration in ticks/turns for DoT effects. 0 means instant (single application).
  // If >0, the system may apply damage repeatedly according to tickInterval.
  duration: 0,

  // When duration > 0, apply damage every `tickInterval` ticks. Defaults to 1.
  tickInterval: 1,

  // Armor/mitigation handling. `armorPenetration` reduces armor protection by
  // this amount. `ignoreArmor` bypasses armor entirely when true.
  armorPenetration: 0,
  ignoreArmor: false,

  // If true, this damage will affect allies/owner depending on game rules.
  // Systems should use `source` and team/faction info to resolve friendly fire.
  allowFriendlyFire: false,

  // Critical hit marker; systems can modify damage by multipliers when true.
  critical: false,

  // Optional knockback vector: {dx, dy, force}
  knockback: null,

  // Optional status/effect to apply when damage hits (e.g., 'stunned', 'bleed')
  // Can be an Effect id or a key used by the status system.
  status: null,

  // Generic tags for custom logic (strings). Useful for identifying
  // special behaviours (e.g., ['aoe','explosive','splash']).
  tags: []
});
