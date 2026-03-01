// src/rules/systems/channelingSystem.js
// Counts down active channel timers each tick. When a channel completes,
// injects a CastSpellIntent so castSpellSystem fires the spell.
// Cancellation from the app layer (ESC) removes Channeling directly.

import { Channeling } from "../components/Channeling.js";
import { CastSpellIntent } from "../components/Intents/CastSpellIntent.js";
import { Vitality } from "../components/Vitality.js";

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function channelingSystem(world) {
  for (const [id, ch] of world.query(Channeling)) {
    // Dead actors lose their channel
    const vit = world.get(id, Vitality);
    if (vit && (vit.hp | 0) <= 0) {
      try { world.remove(id, Channeling); } catch {}
      try { world.emit?.('channeling:cancelled', { actor: id, spellId: ch.spellId, reason: 'dead' }); } catch {}
      continue;
    }

    ch.turnsRemaining -= 1;

    if (ch.turnsRemaining <= 0) {
      // Channel complete — inject CastSpellIntent for castSpellSystem
      const castData = {
        spellId: ch.spellId,
        targetId: ch.targetId || id,
        _fromChanneling: true,
      };
      if (ch.x != null) castData.x = ch.x;
      if (ch.y != null) castData.y = ch.y;

      try { world.remove(id, Channeling); } catch {}
      try { world.add(id, CastSpellIntent, castData); } catch {}
      try { world.emit?.('channeling:complete', { actor: id, spellId: ch.spellId }); } catch {}
    } else {
      // Still channeling — emit progress for UI
      try {
        world.emit?.('channeling:tick', {
          actor: id,
          spellId: ch.spellId,
          turnsRemaining: ch.turnsRemaining,
          turnsTotal: ch.turnsTotal,
        });
      } catch {}
    }
  }
}
