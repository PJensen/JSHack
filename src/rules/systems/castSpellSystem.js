import { CastSpellIntent } from "../components/Intents/CastSpellIntent.js";
import { Brain } from "../components/Brain.js";
import { Mana } from "../components/Mana.js";
import { Channeling } from "../components/Channeling.js";
import { getSpell } from "../data/spells.js";
import { runSpellScript } from "../scripts/spells.js";
import { MANA_REGEN_COOLDOWN } from "../data/regenConstants.js";
import { combatSeed, hashString32, mulberry32 } from "../utils/rng.js";
import { statusStrength } from "../utils/statusFacade.js";
import { resolveDerivedStats } from "../utils/derivedStats.js";
import { Player } from "../components/Player.js";
import { isSpellOnCooldown, setSpellCooldown } from "../utils/spellCooldowns.js";
import { Position } from "../components/Position.js";
import { isTargetHiddenByInvisibility } from "../utils/spellTargeting.js";
import { getChannelInterruptionReason } from "../utils/channelInterruptionPolicy.js";
/** @typedef {import('../../lib/ecs-js/index.js').World} World */

/**
 * Accept both raw ids ("flash_heal") and item-style ids ("spell:flash_heal").
 * @param {any} value
 * @returns {string}
 */
function normalizeSpellId(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw.startsWith("spell:") ? raw.slice(6) : raw;
}

/**
 * @param {any} brain
 * @returns {string[]}
 */
function normalizedLearnedSpellIds(brain) {
  const raw = Array.isArray(brain?.learnedSpellIds) ? brain.learnedSpellIds : [];
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  for (let i = 0; i < raw.length; i++) {
    const id = normalizeSpellId(raw[i]);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
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
  // Spells marked clearMindedCasting resolve normally even when confused
  // (e.g. blink handles confusion inside its own targeting, flash_heal is
  // a desperate reflex, phase_strike muscle memory).
  if (intendedSpell?.clearMindedCasting) {
    return { kind: "normal", spell: intendedSpell };
  }

  const alternatives = [];
  for (let i = 0; i < learnedSpellIds.length; i++) {
    const id = normalizeSpellId(learnedSpellIds[i]);
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
    let spellId = normalizeSpellId(intent?.spellId);
    const learned0 = normalizedLearnedSpellIds(brain0);
    // If no spell specified, default to first learned
    if (!spellId) {
      const first = learned0[0] || null;
      if (first) spellId = first;
    }
    const spell = getSpell(spellId);
    if (!spell) {
      try { world.emit && world.emit('spell:unknown', { actor, spellId }); } catch (e) { console.debug('[castSpellSystem] emit spell:unknown failed:', e); }
      world.remove(actor, CastSpellIntent);
      continue;
    }

    const interruption = getChannelInterruptionReason(world, actor);
    if (interruption) {
      try {
        world.emit?.("spell:fizzle", {
          actor,
          spellId: spell.id,
          reason: interruption,
        });
      } catch (e) { console.debug('[castSpellSystem] emit spell:fizzle(interruption) failed:', e); }
      world.remove(actor, CastSpellIntent);
      continue;
    }

    const targetId = Number(intent?.targetId || 0) | 0;
    if (targetId > 0 && targetId !== actor) {
      const sourcePos = world.get(actor, Position);
      const targetPos = world.get(targetId, Position);
      if (isTargetHiddenByInvisibility(world, {
        sourceId: actor,
        targetId,
        sourcePos,
        targetPos,
        allowAdjacentInvisibleTarget: true,
        hostileOnly: true,
      })) {
        try {
          world.emit?.("spell:fizzle", {
            actor,
            spellId: spell.id,
            reason: "target_invisible",
            targetId,
          });
        } catch (e) { console.debug('[castSpellSystem] emit spell:fizzle(target_invisible) failed:', e); }
        world.remove(actor, CastSpellIntent);
        continue;
      }
    }

    /** @type {{ learnedSpellIds?: string[] }|null} */
    const brain = /** @type any */ (world.get(actor, Brain));
    const learned = normalizedLearnedSpellIds(brain);
    const fromChanneling = !!intent._fromChanneling;
    if (!fromChanneling && (!brain || !learned.includes(spell.id))) {
      try { world.emit && world.emit('spell:not-known', { actor, spellId: spell.id }); } catch (e) { console.debug('[castSpellSystem] emit spell:not-known failed:', e); }
      world.remove(actor, CastSpellIntent);
      continue;
    }
    if (Array.isArray(brain.learnedSpellIds)) {
      // One-time migration of legacy "spell:*" ids to canonical ids.
      if (brain.learnedSpellIds.length !== learned.length || brain.learnedSpellIds.some((id, i) => String(id ?? "") !== learned[i])) {
        brain.learnedSpellIds = learned.slice();
      }
    }

    const minIntelligence = Math.max(0, Number(spell?.minIntelligence || 0) | 0);
    if (minIntelligence > 0) {
      const resolved = resolveDerivedStats(world, actor);
      const currentIntelligence = Math.max(
        Number(resolved?.intelligence || 0),
        Number(brain?.intelligence || 0),
      );
      if (currentIntelligence < minIntelligence) {
        try {
          world.emit && world.emit("spell:int-too-low", {
            actor,
            spellId: spell.id,
            need: minIntelligence,
            have: currentIntelligence,
          });
        } catch (e) { console.debug('[castSpellSystem] emit spell:int-too-low failed:', e); }
        world.remove(actor, CastSpellIntent);
        continue;
      }
    }

    // Cooldown gate (player only)
    if (!fromChanneling && world.has(actor, Player)) {
      const cdTurns = Number(spell.cooldown || 0) | 0;
      if (cdTurns > 0 && isSpellOnCooldown(world, spell.id)) {
        try { world.emit?.('spell:on-cooldown', { actor, spellId: spell.id }); } catch (e) { console.debug('[castSpellSystem] emit spell:on-cooldown:', e); }
        world.remove(actor, CastSpellIntent);
        continue;
      }
    }

    /** @type {{ mana?: number, maxMana?:number }|null} */
    const mana = /** @type any */ (world.get(actor, Mana));

    const confusion = resolveConfusedCast(world, actor, spell, learned);
    const resolvedSpell = confusion.spell;
    const isSustainedChannel = !!resolvedSpell?.channeling;
    const manaCost = isSustainedChannel
      ? Number(resolvedSpell.manaPerTick ?? resolvedSpell.manaCost ?? 0)
      : Number(resolvedSpell.manaCost || 0);
    const requiredToStart = isSustainedChannel
      ? Math.max(0, manaCost) * 2
      : manaCost;

    // Sustained channels gate on one tick of mana up front but spend it during the
    // realtime channel loop. Cast-time channels keep the existing upfront payment.
    if (!fromChanneling) {
      const have = Number(mana?.mana ?? 0);
      if (have < requiredToStart) {
        try { world.emit && world.emit('spell:oom', { actor, spellId: resolvedSpell.id, need: requiredToStart, have }); } catch (e) { console.debug('[castSpellSystem] emit spell:oom failed:', e); }
        world.remove(actor, CastSpellIntent);
        continue;
      }

      if (mana && !isSustainedChannel) {
        // Deduct upfront mana and suppress regen this turn for instant/cast-time spells.
        mana.mana = have - manaCost;
        mana.regenCooldown = MANA_REGEN_COOLDOWN;
      }
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

    // Cast time: begin channeling instead of immediate cast
    const castTime = Number(resolvedSpell.castTime || 0) | 0;
    if (castTime > 0 && !fromChanneling) {
      try {
        world.add(actor, Channeling, {
          mode: "cast",
          turnsRemaining: castTime,
          turnsTotal: castTime,
          manaPerTick: 0,
          spellId: resolvedSpell.id,
          targetId: intent.targetId || actor,
          x: intent.x ?? null,
          y: intent.y ?? null,
        });
      } catch {}
      try {
        world.emit?.('channeling:start', { actor, spellId: resolvedSpell.id, castTime });
      } catch {}
      world.remove(actor, CastSpellIntent);
      continue;
    }

    if (isSustainedChannel && !fromChanneling) {
      try {
        world.add(actor, Channeling, {
          mode: "sustain",
          turnsRemaining: 0,
          turnsTotal: 0,
          manaPerTick: manaCost,
          spellId: resolvedSpell.id,
          targetId: intent.targetId || actor,
          x: intent.x ?? null,
          y: intent.y ?? null,
        });
      } catch {}
      try {
        world.emit?.("channeling:start", {
          actor,
          spellId: resolvedSpell.id,
          mode: "sustain",
          manaPerTick: manaCost,
        });
      } catch {}
      world.remove(actor, CastSpellIntent);
      continue;
    }

    // Run scripted behavior (pure rules)
    try { runSpellScript(world, actor, resolvedSpell, intent); } catch (e) { console.error('[castSpellSystem] runSpellScript failed for "' + (resolvedSpell?.id || '?') + '":', e); }

    // Start cooldown (player only)
    if (world.has(actor, Player)) {
      const cdTurns = Number(resolvedSpell.cooldown || 0) | 0;
      if (cdTurns > 0) setSpellCooldown(world, resolvedSpell.id, cdTurns, cdTurns);
    }

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
