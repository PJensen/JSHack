import { CastSpellIntent } from "../components/Intents/CastSpellIntent.js";
import { Brain } from "../components/Brain.js";
import { Mana } from "../components/Mana.js";
import { getSpell } from "../data/spells.js";
import { runSpellScript } from "../scripts/spells.js";
import { MANA_REGEN_COOLDOWN } from "../data/regenConstants.js";
import { combatSeed, mulberry32 } from "../utils/rng.js";
import { statusStrength } from "../utils/statusFacade.js";
/** @typedef {import('../../lib/ecs-js/index.js').World} World */

/**
 * @param {string} value
 * @returns {number}
 */
function hashString32(value) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i) & 0xff;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * @param {World} world
 * @param {number} actor
 * @param {{ id:string }} intendedSpell
 * @param {string[]} learnedSpellIds
 * @returns {{ kind: "normal"|"miscast"|"fizzle", spell: any }}
 */
function resolveConfusedCast(world, actor, intendedSpell, learnedSpellIds) {
  const confusePower = statusStrength(world, actor, "confused");
  if (confusePower <= 0) return { kind: "normal", spell: intendedSpell };
  // Blink handles confusion/hallucination inside its own targeting rules.
  if (String(intendedSpell?.id || "") === "blink" || String(intendedSpell?.id || "") === "phase_strike") {
    return { kind: "normal", spell: intendedSpell };
  }

  const alternatives = [];
  for (let i = 0; i < learnedSpellIds.length; i++) {
    const id = String(learnedSpellIds[i] || "");
    if (!id || id === intendedSpell.id) continue;
    const def = getSpell(id);
    if (def) alternatives.push(def);
  }
  if (alternatives.length === 0) return { kind: "fizzle", spell: intendedSpell };

  const salt = hashString32(intendedSpell.id) ^ 0xC05FACE;
  const r = mulberry32(combatSeed(world.seed, world.step, actor, alternatives.length, salt));
  const idx = (r() * alternatives.length) | 0;
  return { kind: "miscast", spell: alternatives[idx] };
}

/**
 * Resolve CastSpellIntent:
 * - Validate that actor knows the spell
 * - Check Mana and deduct cost
 * - Confused casters miscast to another learned spell, or fizzle if none exists
 * - Emit 'castSpell' semantic event for bridge/display to react to
 * - Clear intent
 * Emits on failure:
 * - 'spell:unknown' | 'spell:not-known' | 'spell:oom' | 'spell:fizzle'
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
      try { world.emit && world.emit('spell:unknown', { actor, spellId }); } catch (e) { console.debug('[castSpellSystem] emit spell:unknown failed:', e); }
      world.remove(actor, CastSpellIntent);
      continue;
    }

    /** @type {{ learnedSpellIds?: string[] }|null} */
    const brain = /** @type any */ (world.get(actor, Brain));
    if (!brain || !Array.isArray(brain.learnedSpellIds) || !brain.learnedSpellIds.includes(spell.id)) {
      try { world.emit && world.emit('spell:not-known', { actor, spellId: spell.id }); } catch (e) { console.debug('[castSpellSystem] emit spell:not-known failed:', e); }
      world.remove(actor, CastSpellIntent);
      continue;
    }

    /** @type {{ mana?: number, maxMana?:number }|null} */
    const mana = /** @type any */ (world.get(actor, Mana));

    const confusion = resolveConfusedCast(world, actor, spell, brain.learnedSpellIds);
    const resolvedSpell = confusion.spell;

    const have = Number(mana?.mana ?? 0);
    const cost = Number(resolvedSpell.manaCost || 0);
    if (have < cost) {
      try { world.emit && world.emit('spell:oom', { actor, spellId: resolvedSpell.id, need: cost, have }); } catch (e) { console.debug('[castSpellSystem] emit spell:oom failed:', e); }
      world.remove(actor, CastSpellIntent);
      continue;
    }

    // Deduct mana and suppress regen this turn
    if (mana) {
      mana.mana = have - cost;
      mana.regenCooldown = MANA_REGEN_COOLDOWN;
    }

    if (confusion.kind === "fizzle") {
      try { world.emit && world.emit("spell:fizzle", { actor, spellId: spell.id, confused: true }); } catch (e) { console.debug('[castSpellSystem] emit spell:fizzle failed:', e); }
      world.remove(actor, CastSpellIntent);
      continue;
    }

    if (confusion.kind === "miscast") {
      try {
        world.emit && world.emit("spell:miscast", {
          actor,
          fromSpellId: spell.id,
          toSpellId: resolvedSpell.id,
          confused: true,
        });
      } catch (e) { console.debug('[castSpellSystem] emit spell:miscast failed:', e); }
    }

    // Run scripted behavior (pure rules)
    try { runSpellScript(world, actor, resolvedSpell, intent); } catch (e) { console.error('[castSpellSystem] runSpellScript failed for "' + (resolvedSpell?.id || '?') + '":', e); }
    // Emit semantic cast event that bridge/display can turn into effects
    try {
      world.emit && world.emit('castSpell', {
        actor,
        spellId: resolvedSpell.id,
        targetId: intent.targetId || actor,
        miscast: confusion.kind === "miscast",
        intendedSpellId: confusion.kind === "miscast" ? spell.id : undefined,
      });
    } catch (e) { console.debug('[castSpellSystem] emit castSpell failed:', e); }
    world.remove(actor, CastSpellIntent);
  }
}
