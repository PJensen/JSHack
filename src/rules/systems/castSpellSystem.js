import { CastSpellIntent } from "../components/Intents/CastSpellIntent.js";
import { Brain } from "../components/Brain.js";
import { Mana } from "../components/Mana.js";
import { getSpell } from "../data/spells.js";
import { runSpellScript } from "../scripts/spells.js";
/** @typedef {import('../../lib/ecs-js/index.js').World} World */

// castSpellSystem — placeholder implementation that consumes CastSpellIntent
// and emits a semantic event. Extend with actual spell resolution later.
/**
 * Resolve CastSpellIntent:
 * - Validate that actor knows the spell
 * - Check Mana and deduct cost
 * - Emit 'castSpell' semantic event for bridge/display to react to
 * - Clear intent
 * Emits on failure:
 * - 'spell:unknown' | 'spell:not-known' | 'spell:oom'
 * @param {World} world
 */
export function castSpellSystem(world) {
  for (const [actor, intent] of world.query(CastSpellIntent)) {
    /** @type {{ learnedSpellIds?: string[] }|null} */
    const brain0 = /** @type any */ (world.get(actor, Brain));
    let spellId = intent.spellId;
    // If no spell specified, default to first learned
    if (!spellId || spellId === 0) {
      const first = (brain0 && Array.isArray(brain0.learnedSpellIds) && brain0.learnedSpellIds[0]) || null;
      if (first) spellId = first;
    }
    const spell = getSpell(spellId);
    if (!spell) {
      try { world.emit && world.emit('spell:unknown', { actor, spellId }); } catch {}
      world.remove(actor, CastSpellIntent);
      continue;
    }

    /** @type {{ learnedSpellIds?: string[] }|null} */
    const brain = /** @type any */ (world.get(actor, Brain));
    if (!brain || !Array.isArray(brain.learnedSpellIds) || !brain.learnedSpellIds.includes(spell.id)) {
      try { world.emit && world.emit('spell:not-known', { actor, spellId: spell.id }); } catch {}
      world.remove(actor, CastSpellIntent);
      continue;
    }

    /** @type {{ mana?: number, maxMana?:number }|null} */
    const mana = /** @type any */ (world.get(actor, Mana));
    console.log('Casting spell', spell.id, 'for actor', actor, 'with mana', mana);
    const have = Number(mana?.mana ?? 0);
    const cost = Number(spell.manaCost || 0);
    if (have < cost) {
      try { world.emit && world.emit('spell:oom', { actor, spellId: spell.id, need: cost, have }); } catch {}
      world.remove(actor, CastSpellIntent);
      continue;
    }

    // Deduct mana
    if (mana) mana.mana = have - cost;

    // Run scripted behavior (pure rules)
    try { runSpellScript(world, actor, spell, intent); } catch {}
    // Emit semantic cast event that bridge/display can turn into effects
    try { world.emit && world.emit('castSpell', { actor, spellId: spell.id, targetId: intent.targetId || actor }); } catch {}
    world.remove(actor, CastSpellIntent);
  }
}
