/**
 * deitySystem — effects-phase system that ticks deity mood each world step.
 *
 * Reads Devotion components, ticks associated Deity instances, and emits
 * deity events onto the world event bus for the app layer to handle.
 *
 * The system also listens to world events (kills, heals) and forwards them
 * to the deity as actions.
 */

import { Devotion } from '../components/Devotion.js';
import { Deity } from '../../lib/deity-js/deity.js';
import { getDeity } from '../data/deities.js';
import { monsterHasTag } from '../data/monsters.js';
import { Player } from '../components/Player.js';
import { Pet } from '../components/Pet.js';
import { Owner } from '../components/Owner.js';
import { NamedIdentity } from '../components/NamedIdentity.js';
import { Vitality } from '../components/Vitality.js';
import { Hunger } from '../components/Hunger.js';
import { Status } from '../components/Status.js';
import { ActiveEffects } from '../components/ActiveEffects.js';
import { Faction } from '../components/Faction.js';
import { Equipment, NON_AMMO_GEAR_SLOTS } from '../components/Equipment.js';
import { ItemInfo } from '../components/ItemInfo.js';
import { Beatitude } from '../components/Beatitude.js';
import { dealDamage } from '../utils/dealDamage.js';
import { hasStatus } from '../utils/statusFacade.js';
import { getSpell } from '../data/spells.js';
import { getHungerLevel } from '../data/food.js';

/** @type {Map<string, import('../../lib/deity-js/deity.js').Deity>} */
const _deities = new Map();

/** @type {WeakSet<import('../../lib/ecs-js/index.js').World>} */
const _wired = new WeakSet();
const WORLD_EVENTS_INSTALLED = Symbol.for('jshack:deity:worldEvents:installed');
const WRATH_DEBT_KEY = Symbol.for('jshack:deity:wrathDebt');
const SHRINE_TOUCH_COOLDOWN_KEY = Symbol.for('jshack:deity:shrineTouchCooldown');

/** @type {WeakMap<import('../../lib/deity-js/deity.js').Deity, WeakSet<import('../../lib/ecs-js/index.js').World>>} */
const _miraclesWired = new WeakMap();
const PET_KILL_DESECRATE_STACKS = 12;
const PET_CORPSE_DESECRATE_STACKS = 48;
const WRATH_DEBT_CAP = 2.5;
const WRATH_DEBT_DAMAGE_FACTOR = 0.55;
const WRATH_DEBT_MERCY_REDUCTION = 0.02;
const WRATH_DEBT_NO_MERCY_THRESHOLD = 1.25;
const WRATH_DEBT_CONSUME_PER_WRATH = 0.6;
const SHRINE_TOUCH_COOLDOWN_TURNS = 30;
const SHRINE_TOUCH_PROTECT_MAGNITUDE = 0.35;
const SHRINE_TOUCH_PLEA_VALUE = 0.25;
const OFFENSE_SEVERITY_WEIGHTS = Object.freeze({
  minor: 0.15,
  grave: 0.45,
  horrifying: 0.9,
});

/** Get (or lazily create) a Deity instance for a given deityId. */
function ensureDeity(deityId, world = null) {
  let deity = _deities.get(deityId) || null;
  if (!deity) {
    const def = getDeity(deityId);
    if (!def) return null;
    deity = new Deity(def);
    _deities.set(deityId, deity);
  }

  // Wire miracles if we have a world reference
  if (world) {
    if (!_miraclesWired.has(deity)) {
      _miraclesWired.set(deity, new WeakSet());
    }
    const wiredWorlds = _miraclesWired.get(deity);
    if (!wiredWorlds.has(world)) {
      wireDeityMiracles(deity, deityId, world);
      wiredWorlds.add(world);
    }
  }

  return deity;
}

/**
 * Resolve a player's deity instance from Devotion.
 * Creates the deity lazily if needed so event handling never drops first-use signals.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} playerId
 * @returns {{ deityId: string, deity: import('../../lib/deity-js/deity.js').Deity }|null}
 */
function resolvePlayerDeity(world, playerId) {
  const actor = Number(playerId || 0) | 0;
  if (!(actor > 0) || !world.has(actor, Player)) return null;
  const dev = world.get(actor, Devotion);
  const deityId = String(dev?.deityId || '');
  if (!deityId) return null;
  const deity = ensureDeity(deityId, world);
  if (!deity) return null;
  return { deityId, deity };
}

/**
 * Push repeated desecrate records when an offense is exceptionally taboo.
 * @param {import('../../lib/deity-js/deity.js').Deity} deity
 * @param {number} count
 * @param {string} type
 */
function stackDesecration(deity, count, type) {
  const n = Math.max(0, Number(count || 0) | 0);
  for (let i = 0; i < n; i++) {
    deity.desecrate(type);
  }
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @returns {Map<string, number>}
 */
function ensureWrathDebtStore(world) {
  const current = world[WRATH_DEBT_KEY];
  if (current instanceof Map) return current;
  const created = new Map();
  world[WRATH_DEBT_KEY] = created;
  return created;
}

/**
 * @param {number} playerId
 * @param {string} deityId
 * @returns {string}
 */
function wrathDebtSlot(playerId, deityId) {
  return `${deityId}:${playerId}`;
}

/**
 * Convert offense severity metadata into wrath debt delta.
 * @param {string} severity
 * @param {number} desecrateStacks
 * @returns {number}
 */
function severityToWrathDebt(severity, desecrateStacks) {
  const key = String(severity || '').toLowerCase();
  const base = Number(OFFENSE_SEVERITY_WEIGHTS[key] ?? OFFENSE_SEVERITY_WEIGHTS.minor);
  const stacks = Math.max(0, Number(desecrateStacks || 0) | 0);
  const stackBonus = Math.min(0.9, stacks * 0.015);
  return Math.max(0, base + stackBonus);
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {{ playerId: number, deityId: string, severity?: string, desecrateStacks?: number }} spec
 * @returns {number} current wrath debt after applying
 */
function addWrathDebt(world, spec) {
  const playerId = Number(spec?.playerId || 0) | 0;
  const deityId = String(spec?.deityId || '');
  if (!(playerId > 0) || !deityId) return 0;

  const delta = severityToWrathDebt(spec?.severity || 'minor', Number(spec?.desecrateStacks || 0));
  if (!(delta > 0)) return 0;

  const store = ensureWrathDebtStore(world);
  const slot = wrathDebtSlot(playerId, deityId);
  const current = Math.max(0, Number(store.get(slot) || 0));
  const next = Math.min(WRATH_DEBT_CAP, current + delta);
  store.set(slot, next);
  return next;
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} playerId
 * @param {string} deityId
 * @returns {number}
 */
function getWrathDebt(world, playerId, deityId) {
  const store = ensureWrathDebtStore(world);
  return Math.max(0, Number(store.get(wrathDebtSlot(playerId, deityId)) || 0));
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} playerId
 * @param {string} deityId
 * @param {number} amount
 */
function spendWrathDebt(world, playerId, deityId, amount) {
  const store = ensureWrathDebtStore(world);
  const slot = wrathDebtSlot(playerId, deityId);
  const current = Math.max(0, Number(store.get(slot) || 0));
  if (!(current > 0)) return;
  const next = Math.max(0, current - Math.max(0, Number(amount || 0)));
  if (next > 0) store.set(slot, next);
  else store.delete(slot);
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @returns {Map<string, number>}
 */
function ensureShrineTouchCooldownStore(world) {
  const current = world[SHRINE_TOUCH_COOLDOWN_KEY];
  if (current instanceof Map) return current;
  const created = new Map();
  world[SHRINE_TOUCH_COOLDOWN_KEY] = created;
  return created;
}

/**
 * @param {number} playerId
 * @param {string} deityId
 * @returns {string}
 */
function shrineTouchCooldownSlot(playerId, deityId) {
  return `${deityId}:${playerId}`;
}

// ── Niche deity interaction helpers ───────────────────────────────────
const KILL_STREAK_KEY = Symbol.for('jshack:deity:killStreak');

/**
 * Dispatch a single TagKillReaction / SpellSchoolReaction / specialHook spec
 * onto a deity instance.
 * @param {import('../../lib/deity-js/deity.js').Deity} deity
 * @param {{ type: 'action'|'offer', verb: string, magnitude?: number, target?: string, value?: number, alignment?: string }} spec
 */
function applyDeityReaction(deity, spec) {
  if (spec.type === 'offer') {
    deity.offer(spec.verb, { value: spec.value ?? 0.3, alignment: spec.alignment ?? 'neutral' });
  } else {
    deity.action(spec.verb, { magnitude: spec.magnitude ?? 0.3, target: spec.target ?? '' });
  }
}

import { isProfane as _isProfane } from '../utils/profanity.js';

/**
 * Install world-event hooks that feed the deity.
 * Called once per world instance.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
function wireWorldEvents(world) {
  if (world[WORLD_EVENTS_INSTALLED] || _wired.has(world)) return;
  world[WORLD_EVENTS_INSTALLED] = true;
  _wired.add(world);

  // Severity metadata from major offenses accumulates wrath debt.
  world.on('deity:offense', ({ playerId, deityId, severity, desecrateStacks }) => {
    const pid = Number(playerId || 0) | 0;
    if (!(pid > 0) || !world.has(pid, Player)) return;
    const did = String(deityId || world.get(pid, Devotion)?.deityId || '');
    if (!did) return;
    addWrathDebt(world, {
      playerId: pid,
      deityId: did,
      severity: String(severity || 'minor'),
      desecrateStacks: Number(desecrateStacks || 0),
    });
  });

  // Kill events → deity.action('kill') + optional offering
  world.on('died', ({ id, killer }) => {
    if (!killer) return;
    const resolved = resolvePlayerDeity(world, killer);
    if (!resolved) return;
    const { deityId, deity } = resolved;

    const victim = Number(id || 0) | 0;
    const owner = world.get(victim, Owner);
    const ownerId = Number(owner?.ownerId || 0) | 0;
    const murderedOwnPet = world.has(victim, Pet) && ownerId > 0 && ownerId === (Number(killer || 0) | 0);
    if (murderedOwnPet) {
      const victimName = String(world.get(victim, NamedIdentity)?.name || 'companion');
      deity.action('betray', { magnitude: 1.0, target: victimName });
      stackDesecration(deity, PET_KILL_DESECRATE_STACKS, 'pet_murder');
      world.emit('deity:offense', {
        playerId: Number(killer || 0) | 0,
        deityId,
        deityName: deity.name,
        offense: 'pet_murder',
        severity: 'grave',
        victimId: victim,
        victimName,
        desecrateStacks: PET_KILL_DESECRATE_STACKS,
      });
      return;
    }

    // Killing non-hostile NPCs is betrayal — shopkeepers most of all.
    const victimFaction = world.get(victim, Faction)?.key || '';
    if (victimFaction === 'shopkeeper') {
      const victimName = String(world.get(victim, NamedIdentity)?.name || 'merchant');
      deity.action('betray', { magnitude: 0.8, target: victimName });
    } else if (victimFaction === 'neutral') {
      const victimName = String(world.get(victim, NamedIdentity)?.name || 'innocent');
      deity.action('betray', { magnitude: 0.5, target: victimName });
    }

    const def = getDeity(deityId);
    deity.action('kill', { magnitude: 0.5, target: String(victim) });
    // War gods treat kills as implicit blood offerings (resets neglect clock)
    if (def?.killsAreOfferings) {
      deity.offer('blood', { value: 0.3, alignment: def.alignment ?? 'neutral' });
    }
  });

  // Heal events → deity.action('heal')
  // Skip divine-source heals so miracles don't feed back into the mood ledger.
  world.on('healed', ({ id, source }) => {
    if (source === 'divine') return;
    const resolved = resolvePlayerDeity(world, id);
    if (!resolved) return;
    const { deity } = resolved;
    deity.action('heal', { magnitude: 0.3, target: 'self' });
  });

  // Eating pet corpse → deity.desecrate(), with heavy escalation for your own companion.
  world.on('corpse:desecrated', ({ actor, ownerId, corpseName }) => {
    const resolved = resolvePlayerDeity(world, actor);
    if (!resolved) return;
    const { deityId, deity } = resolved;
    const actorId = Number(actor || 0) | 0;
    const ownPetCorpse = (Number(ownerId || 0) | 0) === actorId;
    const label = String(corpseName || 'pet_corpse');
    const stacks = ownPetCorpse ? PET_CORPSE_DESECRATE_STACKS : 1;

    if (ownPetCorpse) {
      deity.action('betray', { magnitude: 1.0, target: label });
    }
    stackDesecration(deity, stacks, ownPetCorpse ? 'pet_corpse_desecration' : label);

    if (ownPetCorpse) {
      world.emit('deity:offense', {
        playerId: actorId,
        deityId,
        deityName: deity.name,
        offense: 'pet_corpse_desecration',
        severity: 'horrifying',
        corpseName: label,
        desecrateStacks: stacks,
      });
    }
  });

  // Hitting your own pet → deity.action('betray') with lower magnitude
  world.on('damaged', ({ target, source, amount }) => {
    if (!source || !target) return;
    if (!world.has(source, Player)) return;
    if (!world.has(target, Pet)) return;

    // Check if the player owns this pet
    const owner = world.get(target, Owner);
    if (!owner || owner.ownerId !== source) return;

    const resolved = resolvePlayerDeity(world, source);
    if (!resolved) return;
    const { deity } = resolved;

    // Lesser betrayal than killing — scale by damage dealt
    const magnitude = Math.min(0.3, (amount || 1) * 0.05);
    deity.action('betray', { magnitude, target: 'companion' });
  });

  // Altar offerings → deity.offer()
  world.on('altar:offer', ({ actor, itemName, value }) => {
    const resolved = resolvePlayerDeity(world, actor);
    if (!resolved) return;
    const { deity } = resolved;
    deity.offer('item', { value: value || 0.3, alignment: 'neutral', itemName });
    world.emit?.('altar:offered', { actor, deityName: deity.name, itemName, value });
  });

  // Shrine touch → prayer + protect action, with anti-spam cooldown.
  world.on('shrine:touch', ({ actor, targetId }) => {
    const actorId = Number(actor || 0) | 0;
    const shrineId = Number(targetId || 0) | 0;
    const resolved = resolvePlayerDeity(world, actorId);
    if (!resolved) {
      world.emit?.('shrine:communion', {
        actor: actorId,
        targetId: shrineId,
        effect: 'silent',
      });
      return;
    }

    const { deityId, deity } = resolved;
    const cooldowns = ensureShrineTouchCooldownStore(world);
    const slot = shrineTouchCooldownSlot(actorId, deityId);
    const now = Number(world.step || 0) | 0;
    const last = Number(cooldowns.get(slot) ?? -1e9);
    const elapsed = now - last;
    if (elapsed < SHRINE_TOUCH_COOLDOWN_TURNS) {
      const remaining = Math.max(1, SHRINE_TOUCH_COOLDOWN_TURNS - Math.max(0, elapsed));
      world.emit?.('shrine:communion', {
        actor: actorId,
        targetId: shrineId,
        deityId,
        deityName: deity.name,
        effect: 'cooldown',
        cooldownRemaining: remaining,
      });
      return;
    }

    cooldowns.set(slot, now);
    deity.pray();
    deity.action('protect', { magnitude: SHRINE_TOUCH_PROTECT_MAGNITUDE, target: 'shrine' });
    deity.offer('plea', { value: SHRINE_TOUCH_PLEA_VALUE, alignment: 'neutral' });
    world.emit?.('shrine:communion', {
      actor: actorId,
      targetId: shrineId,
      deityId,
      deityName: deity.name,
      effect: 'blessing',
      cooldownRemaining: 0,
    });
  });

  // ── Steal ─────────────────────────────────────────────────────────────────
  // Attempted shoplifting — tried to leave with unpaid goods.
  world.on('shop:exit-blocked', ({ actor }) => {
    const resolved = resolvePlayerDeity(world, actor);
    if (!resolved) return;
    const { deity } = resolved;
    deity.action('steal', { magnitude: 0.6, target: 'shopkeeper' });
    // Shoplifting is also a minor breach of the merchant's trust.
    deity.action('betray', { magnitude: 0.3, target: 'shopkeeper' });
  });

  // ── Destroy ───────────────────────────────────────────────────────────────
  // Chopping through terrain (trees, vegetation).
  world.on('tile:chopped', ({ actor }) => {
    const resolved = resolvePlayerDeity(world, actor);
    if (!resolved) return;
    resolved.deity.action('destroy', { magnitude: 0.4, target: 'terrain' });
  });

  // Digging through walls and ground.
  world.on('tile:dug', ({ actor }) => {
    const resolved = resolvePlayerDeity(world, actor);
    if (!resolved) return;
    resolved.deity.action('destroy', { magnitude: 0.4, target: 'terrain' });
  });

  world.on('tile:burned', ({ actor }) => {
    const resolved = resolvePlayerDeity(world, actor);
    if (!resolved) return;
    resolved.deity.action('destroy', { magnitude: 0.4, target: 'terrain' });
  });

  // Clearing webs.
  world.on('web:cleared', ({ actor }) => {
    const resolved = resolvePlayerDeity(world, actor);
    if (!resolved) return;
    resolved.deity.action('destroy', { magnitude: 0.15, target: 'web' });
  });

  // ── Create ────────────────────────────────────────────────────────────────
  // Alchemy — crafting potions and reagents.
  world.on('alchemy:crafted', ({ actor }) => {
    const resolved = resolvePlayerDeity(world, actor);
    if (!resolved) return;
    resolved.deity.action('create', { magnitude: 0.6, target: 'potion' });
  });

  // Cooking — transforming corpses into sustenance.
  world.on('cooking:cooked', ({ actor }) => {
    const resolved = resolvePlayerDeity(world, actor);
    if (!resolved) return;
    const { deityId, deity } = resolved;
    deity.action('create', { magnitude: 0.4, target: 'food' });
    const bonusHook = getDeity(deityId)?.specialHooks?.['cooking:cooked:bonus'];
    if (bonusHook) applyDeityReaction(deity, bonusHook);
  });

  // Engraving — leaving a mark on the world.
  // Profane graffiti is vandalism: fires destroy alongside create.
  world.on('engrave', ({ actor, text }) => {
    const resolved = resolvePlayerDeity(world, actor);
    if (!resolved) return;
    resolved.deity.action('create', { magnitude: 0.15, target: 'engraving' });
    if (_isProfane(text)) {
      resolved.deity.action('destroy', { magnitude: 0.3, target: 'graffiti' });
    }
  });

  // Harvesting — gathering from nature.
  world.on('harvest:picked', ({ actor }) => {
    const resolved = resolvePlayerDeity(world, actor);
    if (!resolved) return;
    resolved.deity.action('create', { magnitude: 0.2, target: 'harvest' });
  });

  // ── Protect ───────────────────────────────────────────────────────────────
  // Disarming traps — making the dungeon safer.
  world.on('trap:disarmed', ({ actor }) => {
    const resolved = resolvePlayerDeity(world, actor);
    if (!resolved) return;
    resolved.deity.action('protect', { magnitude: 0.5, target: 'self' });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // NICHE DEITY INTERACTIONS — clever systemic cross-references
  // ══════════════════════════════════════════════════════════════════════════

  // ── 1. Tag-kill reactions ────────────────────────────────────────────
  // Each deity's tagKillReactions list drives what happens when the player
  // kills a monster with a matching tag (undead, demon, beast, etc.).
  world.on('died', ({ id, killer }) => {
    if (!killer) return;
    const resolved = resolvePlayerDeity(world, killer);
    if (!resolved) return;
    const { deityId, deity } = resolved;
    const victimIdentity = world.get(Number(id || 0) | 0, NamedIdentity)?.identity || '';
    const def = getDeity(deityId);
    for (const r of (def?.tagKillReactions ?? [])) {
      if (monsterHasTag(victimIdentity, r.tag)) applyDeityReaction(deity, r);
    }
  });

  // ── 2. Trap reactions ───────────────────────────────────────────────
  // When an enemy triggers a trap, any player whose deity has a
  // 'trap:triggered:enemy' specialHook gets the reaction.
  // When the player triggers a trap, their own deity's 'trap:triggered:self'
  // hook fires if present.
  world.on('trap:triggered', ({ victimId }) => {
    const victim = Number(victimId || 0) | 0;
    if (!(victim > 0)) return;
    if (world.has(victim, Player)) return; // player ate the trap — handle below
    for (const [playerId] of world.query(Player, Devotion)) {
      const dev = world.get(playerId, Devotion);
      const deityId = String(dev?.deityId || '');
      if (!deityId) continue;
      const hook = getDeity(deityId)?.specialHooks?.['trap:triggered:enemy'];
      if (!hook) continue;
      const deity = ensureDeity(deityId, world);
      if (!deity) continue;
      applyDeityReaction(deity, hook);
      break;
    }
  });

  world.on('trap:triggered', ({ victimId }) => {
    const victim = Number(victimId || 0) | 0;
    if (!(victim > 0) || !world.has(victim, Player)) return;
    const resolved = resolvePlayerDeity(world, victim);
    if (!resolved) return;
    const hook = getDeity(resolved.deityId)?.specialHooks?.['trap:triggered:self'];
    if (!hook) return;
    applyDeityReaction(resolved.deity, hook);
  });

  // ── 3. Kill streaks ──────────────────────────────────────────────────
  // Consecutive kills within a short window can escalate a deity's reaction.
  // Configured via killStreakConfig on the deity definition.
  world.on('died', ({ killer }) => {
    if (!killer) return;
    const killerId = Number(killer || 0) | 0;
    const resolved = resolvePlayerDeity(world, killerId);
    if (!resolved) return;
    const ksCfg = getDeity(resolved.deityId)?.killStreakConfig;
    if (!ksCfg) return;

    const store = world[KILL_STREAK_KEY] || (world[KILL_STREAK_KEY] = new Map());
    const now = Number(world.step || 0) | 0;
    const prev = store.get(killerId);
    const lastTurn = Number(prev?.turn || 0);
    const streak = (now - lastTurn <= ksCfg.window) ? (Number(prev?.count || 0) + 1) : 1;
    store.set(killerId, { turn: now, count: streak });

    if (streak >= ksCfg.minStreak) {
      const bonus = Math.min(ksCfg.maxBonus, streak * ksCfg.bonusPerKill);
      resolved.deity.action(ksCfg.killAction, { magnitude: bonus, target: 'streak_' + streak });
      resolved.deity.offer(ksCfg.offerType, { value: bonus * ksCfg.offerFactor, alignment: ksCfg.offerAlignment });
    }
  });

  // ── 4. Cooking bonus ────────────────────────────────────────────────
  // Cooking corpses closes the cycle of life. Some deities (e.g. Gaia) have
  // a specialHook that fires an extra reaction on top of the generic create.
  // (The generic create action is already wired above.)

  // ── 5. Spell school reactions ────────────────────────────────────────
  // All deities react to spell schools universally (healing → heal action,
  // destruction → destroy action). Per-deity extras come from spellSchoolReactions.
  world.on('castSpell', ({ actor, spellId }) => {
    const resolved = resolvePlayerDeity(world, actor);
    if (!resolved) return;
    const { deityId, deity } = resolved;
    const spell = String(spellId || '');
    const spellDef = getSpell(spell);
    const schools = Array.isArray(spellDef?.schools) ? spellDef.schools : [];
    const def = getDeity(deityId);

    if (schools.includes('healing'))     deity.action('heal',    { magnitude: 0.2, target: 'spell_heal' });
    if (schools.includes('destruction')) deity.action('destroy', { magnitude: 0.2, target: 'spell_destruction' });

    for (const r of (def?.spellSchoolReactions ?? [])) {
      if (!schools.includes(r.school)) continue;
      if (r.spellId && r.spellId !== spell) continue;
      applyDeityReaction(deity, r);
    }
  });

  // ── 6. Blessed/Cursed Offering Resonance ────────────────────────────────
  // The beatitude of items offered at altars modulates their value.
  // Blessed items resonate with divine energy — doubled value.
  // Cursed items carry corruption — negative value (angers deity).
  // Exception: Loki finds cursed offerings amusing rather than offensive.
  world.on('altar:offer', ({ actor, itemId }) => {
    const offeredItemId = Number(itemId || 0) | 0;
    if (!(offeredItemId > 0)) return;
    const resolved = resolvePlayerDeity(world, actor);
    if (!resolved) return;
    const { deityId, deity } = resolved;

    const beat = world.get(offeredItemId, Beatitude);
    const state = String(beat?.state || '').toLowerCase();

    if (state === 'blessed') {
      // Blessed items carry accumulated holiness — bonus offering
      deity.offer('blessed_gift', { value: 0.4, alignment: 'lawful' });
      world.emit?.('deity:nicheEvent', {
        playerId: Number(actor || 0) | 0,
        deityId,
        deityName: deity.name,
        event: 'blessed_offering',
        message: `${deity.name} is pleased by the sanctified offering!`,
      });
    } else if (state === 'cursed') {
      const cursedHook = getDeity(deityId)?.specialHooks?.['altar:offer:cursed'];
      if (cursedHook) {
        applyDeityReaction(deity, cursedHook);
        const msg = String(cursedHook.message || '').replace('{deity}', deity.name);
        world.emit?.('deity:nicheEvent', {
          playerId: Number(actor || 0) | 0,
          deityId,
          deityName: deity.name,
          event: 'cursed_offering_amused',
          message: msg,
        });
      } else {
        // Deities without a cursed-offering hook are offended by corruption
        deity.action('betray', { magnitude: 0.25, target: 'cursed_offering' });
        world.emit?.('deity:nicheEvent', {
          playerId: Number(actor || 0) | 0,
          deityId,
          deityName: deity.name,
          event: 'cursed_offering_angered',
          message: `${deity.name} recoils from the tainted offering!`,
        });
      }
    }
  });
}

/**
 * Wire deity-to-world miracles (deity → player benefits).
 * Called when a deity instance is created.
 * @param {import('../../lib/deity-js/deity.js').Deity} deity
 * @param {string} deityId
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
function wireDeityMiracles(deity, deityId, world) {
  const cooldowns = { wrath: 0, demand: 0, utterance: 0, omen: 0 };
  const DEITY_COOLDOWN = 30;

  // Wrath inflicts damage and optional curses on the worshipper.
  deity.on('wrath', ({ intensity = 0, tick = 0 }) => {
    if ((tick - cooldowns.wrath) < DEITY_COOLDOWN) return;
    cooldowns.wrath = tick;

    for (const [playerId] of world.query(Player, Devotion)) {
      const dev = world.get(playerId, Devotion);
      if (dev?.deityId !== deityId) continue;

      const vit = world.get(playerId, Vitality);
      if (!vit) continue;

      const beforeHp = Math.max(0, Number(vit.hp || 0));
      const wrathDebt = getWrathDebt(world, playerId, deityId);
      const severityScale = 1 + (wrathDebt * WRATH_DEBT_DAMAGE_FACTOR);
      const damagePercent = (0.5 + (Number(intensity || 0) * 0.35)) * severityScale;
      const plannedDamage = Math.max(1, Math.floor(beforeHp * damagePercent));
      const mercyRatio = (wrathDebt >= WRATH_DEBT_NO_MERCY_THRESHOLD)
        ? 0
        : Math.max(0, 0.05 - (wrathDebt * WRATH_DEBT_MERCY_REDUCTION));
      const minHp = Math.max(0, Math.floor(Number(vit.maxHp || 1) * mercyRatio));
      const newHp = Math.max(minHp, beforeHp - plannedDamage);
      const actualDamage = Math.max(0, beforeHp - newHp);

      if (actualDamage > 0) {
        dealDamage(world, {
          target: playerId,
          amount: actualDamage,
          type: 'divine',
          cause: 'divine_wrath',
          bypassInvuln: true,
          bypassResist: true,
        });

        if (wrathDebt > 0) {
          spendWrathDebt(
            world,
            playerId,
            deityId,
            Math.max(0.25, WRATH_DEBT_CONSUME_PER_WRATH * Math.max(0.5, Number(intensity || 0)))
          );
        }

      }

      // Lightning strike shocks the player via the ActiveEffects pipeline
      if (actualDamage > 0) {
        const _ae = world.get(playerId, ActiveEffects);
        if (_ae && Array.isArray(_ae.effects)) {
          _ae.effects.push({ key: 'shock', turnsLeft: 2, potency: 1 });
        }
      }

      let cursed = false;
      if (Number(intensity || 0) > 0.6) {
        const status = world.get(playerId, Status);
        if (status) {
          const statuses = Array.isArray(status.statuses) ? status.statuses : [];
          statuses.push({
            type: 'weakened',
            duration: Math.round(20 + Number(intensity || 0) * 30),
            potency: Number(intensity || 0),
          });
          if (Number(intensity || 0) > 0.8) {
            statuses.push({
              type: 'cursed',
              duration: Math.round(30 + Number(intensity || 0) * 40),
              potency: 1.0,
            });
            cursed = true;
          }
          status.statuses = statuses;
        }
      }
      world.emit('deity:wrath', {
        playerId,
        deityId,
        deityName: deity.name,
        intensity: Number(intensity || 0),
        damage: actualDamage,
        cursed,
        severityScale,
        wrathDebt,
        tick,
      });
    }
  });

  deity.on('demand', ({ tick = 0 }) => {
    if ((tick - cooldowns.demand) < DEITY_COOLDOWN) return;
    cooldowns.demand = tick;
    world.emit('deity:demand', { deityId, deityName: deity.name, tick });
  });

  deity.on('omen', ({ tick = 0 }) => {
    if ((tick - cooldowns.omen) < DEITY_COOLDOWN) return;
    cooldowns.omen = tick;
    world.emit('deity:omen', { deityId, deityName: deity.name, tick });
  });

  deity.on('moodShift', ({ to }) => {
    world.emit('deity:moodShift', { deityId, deityName: deity.name, to });
  });

  deity.on('utterance', ({ dominant, tick = 0 }) => {
    if ((tick - cooldowns.utterance) < DEITY_COOLDOWN) return;
    cooldowns.utterance = tick;
    world.emit('deity:utterance', { deityId, deityName: deity.name, dominant, tick });
  });

  // When deity grants a miracle, help the player based on their needs
  deity.on('miracle', ({ serenity, tick }) => {
    // Find the player who worships this deity
    for (const [playerId] of world.query(Player, Devotion)) {
      const dev = world.get(playerId, Devotion);
      if (dev?.deityId !== deityId) continue;

      // Determine what the player needs most
      const needs = assessPlayerNeeds(world, playerId);

      if (needs.length === 0) {
        // Player is fine — grant luck (affix on item or temporary buff)
        let grantedAffix = false;
        const eq = world.get(playerId, Equipment);
        if (eq) {
          for (const slot of NON_AMMO_GEAR_SLOTS) {
            const itemId = eq[slot];
            if (!Number.isInteger(itemId)) continue;
            const info = world.get(itemId, ItemInfo);
            if (!info || !Array.isArray(info.affixes)) continue;
            if (info.affixes.includes('lucky1')) continue;
            info.affixes.push('lucky1');
            grantedAffix = true;
            const itemName = world.get(itemId, NamedIdentity)?.name || 'item';
            world.emit('deity:miracle', {
              playerId,
              deityId,
              effect: 'lucky_affix',
              message: `${deity.name} blesses your ${itemName} with fortune!`
            });
            break;
          }
        }
        if (!grantedAffix) {
          // No eligible item — grant 200-turn lucky buff
          const ae = world.get(playerId, ActiveEffects);
          if (ae && Array.isArray(ae.effects)) {
            ae.effects.push({ key: 'lucky', turnsLeft: 200, potency: 3 });
          }
          world.emit('deity:miracle', {
            playerId,
            deityId,
            effect: 'lucky_buff',
            message: `${deity.name} bestows fortune upon you!`
          });
        }
        return;
      }

      // Apply miracle based on primary need and deity personality
      const deityDef = getDeity(deityId);
      const primaryNeed = needs[0];

      if (primaryNeed === 'healing' && world.has(playerId, Vitality)) {
        // Heal the player
        const vit = world.get(playerId, Vitality);
        const healAmount = Math.floor(vit.maxHp * (deityDef?.alignment === 'lawful' ? 0.6 : 0.4));
        vit.hp = Math.min(vit.maxHp, vit.hp + healAmount);
        world.emit('deity:miracle', {
          playerId,
          deityId,
          effect: 'heal',
          amount: healAmount,
          message: `${deity.name} restores your vitality!`
        });
        world.emit('healed', { id: playerId, amount: healAmount, source: 'divine' });
      } else if (primaryNeed === 'food' && world.has(playerId, Hunger)) {
        // Satiate hunger
        const hunger = world.get(playerId, Hunger);
        const feedAmount = deityDef?.alignment === 'chaotic' ? 300 : 500;
        hunger.hunger = Math.max(0, hunger.hunger - feedAmount);
        hunger.satiation = (hunger.satiation || 0) + 50;
        world.emit('deity:miracle', {
          playerId,
          deityId,
          effect: 'satiate',
          message: `${deity.name} provides sustenance!`
        });
      } else if ((primaryNeed === 'cure' || primaryNeed === 'blessing') && world.has(playerId, Status)) {
        // Cure harmful status effects
        const status = world.get(playerId, Status);
        const harmful = ['disease', 'poisoned', 'cursed', 'bleeding', 'weakened'];
        const before = status.statuses.length;
        status.statuses = status.statuses.filter(s => !harmful.includes(s.type));
        const cured = before - status.statuses.length;

        if (cured > 0) {
          world.emit('deity:miracle', {
            playerId,
            deityId,
            effect: 'cure',
            count: cured,
            message: `${deity.name} purges your afflictions!`
          });
        }

        // Also uncurse equipped items when the primary need is blessing
        if (primaryNeed === 'blessing') {
          const eqMiracle = world.get(playerId, Equipment);
          if (eqMiracle) {
            for (const slot of NON_AMMO_GEAR_SLOTS) {
              const itemId = eqMiracle[slot];
              if (!Number.isInteger(itemId) || itemId <= 0) continue;
              const beat = world.get(itemId, Beatitude);
              if (beat && beat.state === 'cursed') {
                beat.state = 'uncursed';
                const itemName = world.get(itemId, NamedIdentity)?.name || 'item';
                world.emit('deity:miracle', {
                  playerId,
                  deityId,
                  effect: 'uncurse_equipment',
                  message: `${deity.name} lifts the curse from your ${itemName}!`
                });
              }
            }
          }
        }
      }
    }
  });
}

/**
 * Determine what the player needs most urgently.
 * @returns {string[]} Array of needs in priority order: 'healing', 'food', 'cure', 'blessing'
 */
function assessPlayerNeeds(world, playerId) {
  const needs = [];

  // Check HP
  if (world.has(playerId, Vitality)) {
    const vit = world.get(playerId, Vitality);
    const hpPercent = vit.hp / vit.maxHp;
    if (hpPercent < 0.5) {
      needs.push({ type: 'healing', urgency: 1.0 - hpPercent });
    }
  }

  // Check hunger
  if (world.has(playerId, Hunger)) {
    const hunger = world.get(playerId, Hunger);
    if (hunger?.satiation <= 0) {
      const level = getHungerLevel(Number(hunger?.hunger || 0));
      if (level === 'wasting') {
        needs.push({ type: 'food', urgency: 1.0 });
      } else if (level === 'starving') {
        needs.push({ type: 'food', urgency: 0.9 });
      } else if (level === 'famished') {
        needs.push({ type: 'food', urgency: 0.7 });
      } else if (level === 'hungry') {
        needs.push({ type: 'food', urgency: 0.4 });
      } else if (level === 'peckish') {
        needs.push({ type: 'food', urgency: 0.2 });
      }
    }
  }

  // Check status effects (active-effects first).
  let maxUrgency = 0;
  let needsBlessing = false;
  if (hasStatus(world, playerId, 'cursed')) {
    needsBlessing = true;
    maxUrgency = Math.max(maxUrgency, 0.8);
  }
  // Detect cursed equipped items
  const eqNeeds = world.get(playerId, Equipment);
  if (eqNeeds) {
    for (const slot of NON_AMMO_GEAR_SLOTS) {
      const eid = eqNeeds[slot];
      if (!Number.isInteger(eid) || eid <= 0) continue;
      const b = world.get(eid, Beatitude);
      if (b && b.state === 'cursed') {
        needsBlessing = true;
        maxUrgency = Math.max(maxUrgency, 0.75);
        break;
      }
    }
  }
  if (hasStatus(world, playerId, 'disease') || hasStatus(world, playerId, 'poisoned')) {
    maxUrgency = Math.max(maxUrgency, 0.7);
  }
  if (hasStatus(world, playerId, 'bleeding')) {
    maxUrgency = Math.max(maxUrgency, 0.6);
  }

  if (needsBlessing) {
    needs.push({ type: 'blessing', urgency: maxUrgency });
  } else if (maxUrgency > 0) {
    needs.push({ type: 'cure', urgency: maxUrgency });
  }

  // Sort by urgency descending and return just the types
  return needs.sort((a, b) => b.urgency - a.urgency).map(n => n.type);
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function deitySystem(world) {
  wireWorldEvents(world);

  for (const [entity, devotion] of world.query(Devotion)) {
    if (!devotion?.deityId) continue;
    const deity = ensureDeity(devotion.deityId, world);
    if (!deity) continue;

    // Tick the deity once per world step.
    // Deity events are forwarded to the world bus.
    deity.tick(1);
  }
}

/**
 * Access a deity instance by id (for app-layer event wiring).
 * @param {string} deityId
 */
export function getDeityInstance(deityId) {
  return _deities.get(deityId) ?? null;
}

/**
 * Initialize and register a deity (called from main.js after player creation).
 * @param {string} deityId
 * @param {import('../../lib/ecs-js/index.js').World} world - needed to wire miracles
 * @returns {import('../../lib/deity-js/deity.js').Deity|null}
 */
export function initDeity(deityId, world = null) {
  return ensureDeity(deityId, world);
}
