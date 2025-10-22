// Trigger.js
// ECS Component: rules for proximity/activation triggers
import { defineComponent } from '../../lib/ecs/core.js';

export const Trigger = defineComponent('Trigger', {
  triggeredBy: 'any',   // 'any'|'player'|'monster'|'entity'
  triggerRadius: 0,     // proximity in tiles; 0 = same tile only
  cooldown: 0,          // turns until it can be triggered again; 0 = one-shot
  lastTriggered: -Infinity // last trigger tick/time; systems can update this
});
