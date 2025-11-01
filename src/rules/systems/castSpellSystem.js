import { CastSpellIntent } from "../components/Intents/CastSpellIntent.js";

// castSpellSystem — placeholder implementation that consumes CastSpellIntent
// and emits a semantic event. Extend with actual spell resolution later.
export function castSpellSystem(world) {
  for (const [actor, intent] of world.query(CastSpellIntent)) {
    try { world.emit && world.emit('castSpell', { actor, spellId: intent.spellId || 0, targetId: intent.targetId || actor }); } catch {}
    try { world.remove(actor, CastSpellIntent); } catch {}
  }
}
