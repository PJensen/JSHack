// src/rules/systems/channelingSystem.js
// Counts down active channel timers each tick. When a channel completes,
// injects a CastSpellIntent so castSpellSystem fires the spell.
// Cancellation from the app layer (ESC) removes Channeling directly.

import { Channeling } from "../components/Channeling.js";
import { CastSpellIntent } from "../components/Intents/CastSpellIntent.js";
import { Mana } from "../components/Mana.js";
import { Vitality } from "../components/Vitality.js";
import { getSpell } from "../data/spells.js";
import { MANA_REGEN_COOLDOWN } from "../data/regenConstants.js";
import { runSpellScript } from "../scripts/spells.js";
import { effectiveMaxMana } from "../utils/passiveBonuses.js";

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

    if (String(ch.mode || "cast") === "sustain") {
      const spell = getSpell(String(ch.spellId || ""));
      if (!spell) {
        try { world.remove(id, Channeling); } catch {}
        try { world.emit?.("channeling:cancelled", { actor: id, spellId: ch.spellId, reason: "invalid_spell" }); } catch {}
        continue;
      }

      const mana = world.get(id, Mana);
      const have = Number(mana?.mana ?? 0);
      const manaPerTick = Math.max(0, Number(ch.manaPerTick ?? spell.manaPerTick ?? spell.manaCost ?? 0));
      if (have < manaPerTick) {
        try { world.remove(id, Channeling); } catch {}
        try { world.emit?.("spell:oom", { actor: id, spellId: spell.id, need: manaPerTick, have }); } catch {}
        try { world.emit?.("channeling:cancelled", { actor: id, spellId: spell.id, reason: "oom" }); } catch {}
        continue;
      }

      if (mana) {
        mana.mana = have - manaPerTick;
        mana.regenCooldown = MANA_REGEN_COOLDOWN;
      }

      try {
        runSpellScript(world, id, spell, {
          targetId: ch.targetId || id,
          x: ch.x,
          y: ch.y,
          _fromChanneling: true,
          _channelTick: true,
        });
      } catch {}

      try {
        world.emit?.("channeling:tick", {
          actor: id,
          spellId: spell.id,
          mode: "sustain",
          manaPerTick,
          manaRemaining: Number(mana?.mana ?? have - manaPerTick),
          manaMax: effectiveMaxMana(world, id, mana),
        });
      } catch {}
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
          mode: 'cast',
          turnsRemaining: ch.turnsRemaining,
          turnsTotal: ch.turnsTotal,
        });
      } catch {}
    }
  }
}
