// src/rules/systems/combatSystem.js
// Processes AttackIntent: computes damage using derived stats, emits events for affix triggers, applies Vitality changes.

import { AttackIntent } from '../components/Intents/AttackIntent.js';
import { Equipment, NON_AMMO_GEAR_SLOTS } from '../components/Equipment.js';
import { Vitality } from '../components/Vitality.js';
import { ItemInfo } from '../components/ItemInfo.js';
import { Faction } from '../components/Faction.js';
import { Player } from '../components/Player.js';
import { STAMINA_REGEN_COOLDOWN } from '../data/regenConstants.js';
import { Position } from '../components/Position.js';
import { Stamina } from '../components/Stamina.js';
import { NamedIdentity } from '../components/NamedIdentity.js';
import { mulberry32, rngInt, rollDice, combatSeed, pct } from '../utils/rng.js';
import { dealDamage } from '../utils/dealDamage.js';
import { areFactionsHostile } from '../utils/factionHostility.js';
import { resolveCombatSnapshot } from '../utils/resolveCombatSnapshot.js';
import { applyWeaponCoatingOnHit } from '../data/weaponCoatings.js';
import { createStatusEvent } from '../../shared/events/statusEvent.js';
import { Beatitude, BUC_CURSED } from '../components/Beatitude.js';
import { Traits } from '../components/Traits.js';
import {
    createLegacyCombatFrame,
    runLegacyMonsterHook,
} from '../utils/legacyAffixDispatch.js';
import { ensureEquippedAffixTopology, evaluateEquippedAffixProcs } from '../utils/affixTopology.js';
import { applyProcAccumulator, rollBonusDamage } from '../utils/procApplication.js';

const BUMP_ATTACK_INSTALLED = Symbol.for('jshack:combat:bumpAttack:installed');

/** @param {import('../../lib/ecs-js/index.js').World} world @param {{attacker:number, defender:number, weaponId:number, damage:number, world:any}} base */
function makeCombatFrame(world, base) {
    return createLegacyCombatFrame(world, base, {
        retaliate: (amount) => {
            dealDamage(world, {
                target: base.attacker,
                amount: Math.max(0, amount | 0),
                source: base.defender,
                type: 'physical',
                cause: 'retaliation',
                bypassResist: true,
                noTrigger: true,
            });
        },
    });
}

function buildProcContext(kind, {
    source,
    target,
    item,
    damage,
    damageType,
    crit,
    tags,
    scratch,
    offhand = false,
}) {
    return {
        kind,
        source: Number(source || 0) | 0,
        target: Number(target || 0) | 0,
        item: Number(item || 0) | 0,
        damage: {
            amount: Math.max(0, Math.floor(Number(damage || 0))),
            type: String(damageType || 'physical'),
            crit: !!crit,
            blocked: false,
        },
        tags: new Set(Array.isArray(tags) ? tags : []),
        scratch: scratch || {},
        offhand: !!offhand,
    };
}

function applyPendingDamageProcPhase(world, actorId, ctx, rng, options = {}) {
    const out = evaluateEquippedAffixProcs(world, actorId, ctx, options);
    const bonusDamage = out.cancelled ? 0 : rollBonusDamage(world, out.bonusDamage, rng);
    applyProcAccumulator(world, out, { applyDamage: dealDamage });
    return Math.max(0, Math.floor(Number(ctx?.damage?.amount || 0) + bonusDamage));
}

function applyReactionProcPhase(world, actorId, ctx, options = {}) {
    const out = evaluateEquippedAffixProcs(world, actorId, ctx, options);
    applyProcAccumulator(world, out, { applyDamage: dealDamage });
    return out;
}

/**
 * Install immediate bump-attack listener once per world.
 * Bump attacks are emitted from movement as events so they can resolve within
 * the same tick even when intent adds are deferred.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function installBumpAttackListener(world) {
    if (!world || world[BUMP_ATTACK_INSTALLED]) return;
    world[BUMP_ATTACK_INSTALLED] = true;

    world.on('bump:attack', ({ attacker, target }) => {
        const source = Number(attacker || 0) | 0;
        const defender = Number(target || 0) | 0;
        if (!(source > 0) || !(defender > 0) || source === defender) return;
        try {
            const attempted = resolveMeleeAttack(world, source, defender);
            if (attempted) resolveOffhandAttack(world, source, defender);
        } catch (e) { console.error('[combatSystem] resolveMeleeAttack failed:', e); }
    });

}

/**
 * Resolve one melee attack attempt immediately.
 * Shared by AttackIntent processing and bump-attack event handling.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} attacker
 * @param {number} defender
 * @returns {boolean} true if the attack was attempted (past range/faction/stamina gates)
 */
export function resolveMeleeAttack(world, attacker, defender) {
    const source = Number(attacker || 0) | 0;
    const target = Number(defender || 0) | 0;
    if (!(source > 0) || !(target > 0)) return false;
    if (!world.isAlive(target)) return false;

    const atkVit = world.get(source, Vitality);
    const defVit = world.get(target, Vitality);
    if (!atkVit || !defVit) return false;

    // Range gate: only allow melee from orthogonal adjacency (no diagonals, no ranged)
    const apos = world.get(source, Position);
    const dpos = world.get(target, Position);
    if (!apos || !dpos || (Math.abs((apos.x|0) - (dpos.x|0)) + Math.abs((apos.y|0) - (dpos.y|0))) !== 1) {
        // Out of range: silently consume intent without emitting a MISS far away
        // (prevents confusing "MISS" feedback when monsters are not adjacent)
        return false;
    }

    // Faction hostility gate: only hostile faction pairs can deal direct melee damage.
    const af = world.get(source, Faction)?.key || '';
    const df = world.get(target, Faction)?.key || '';
    if (!areFactionsHostile(af, df)) return false;

    const atkEq = world.get(source, Equipment);
    ensureEquippedAffixTopology(world, source);
    ensureEquippedAffixTopology(world, target);

    // Stamina gate: check if attacker has enough stamina for weapon
    const atkStam = world.get(source, Stamina);
    let weaponId = atkEq?.weapon || 0;
    let staminaCost = 3; // default unarmed cost

    if (weaponId) {
        const weaponInfo = world.get(weaponId, ItemInfo);
        staminaCost = Number(weaponInfo?.staminaCost ?? 8);
    }

    if (atkStam) {
        const have = Number(atkStam.stamina ?? 0);
        if (have < staminaCost) {
            // Insufficient stamina - block attack, message, consume turn
            world.emit?.('attack:insufficient-stamina', {
                attacker: source, defender: target, weaponId, need: staminaCost, have
            });
            return false;
        }
        // Deduct stamina and suppress regen this turn
        world.set(source, Stamina, { ...atkStam, stamina: have - staminaCost, regenCooldown: STAMINA_REGEN_COOLDOWN });
    }

    // Cursed weapon fumble: 20% chance to waste the attack (stamina already spent)
    if (weaponId) {
        const weaponBeat = world.get(weaponId, Beatitude);
        if (weaponBeat && weaponBeat.state === BUC_CURSED) {
            const fumbleSeed = combatSeed(world.seed, world.step, source, target, 0xF0B1E);
            const fumbleRng = mulberry32(fumbleSeed);
            if (pct(fumbleRng, 20)) {
                world.emit?.('combat:fumble', {
                    attacker: source,
                    defender: target,
                    weaponId,
                    name: world.get(weaponId, NamedIdentity)?.name || 'weapon',
                });
                return true;
            }
        }
    }

    const atkSnapshot = resolveCombatSnapshot(world, source, { mode: 'melee' });
    const defSnapshot = resolveCombatSnapshot(world, target, { mode: 'melee' });
    const attackBonus = atkSnapshot.attackBonus;
    const armorClass = defSnapshot.armorClass;

    // Deterministic d20 roll seeded by world + participants + step
    const seed = combatSeed(world.seed, world.step, source, target);
    const r = mulberry32(seed);
    const d20 = rngInt(r, 1, 20);
    const totalToHit = d20 + attackBonus;
    let isCrit = d20 === 20;
    const isNat1 = d20 === 1;

    if (!isCrit && (isNat1 || totalToHit < armorClass)) {
        // Miss (include attacker for better UX logging)
        world.emit?.('status', createStatusEvent({ id: target, kind: 'miss', source }));
        return true;
    }

    // Base damage from weapon dice (or fallback)
    // Typed melee is opt-in per weapon via ItemInfo.damageType.
    let damageType = 'physical';
    weaponId = atkEq?.weapon || 0;
    let baseDice = null;
    if (weaponId) {
        const info = world.get(weaponId, ItemInfo);
        baseDice = (info && info.damageDice) ? String(info.damageDice) : null;
        const rawType = String(info?.damageType || 'physical').toLowerCase();
        if (rawType === 'blunt' || rawType === 'slash' || rawType === 'pierce') {
            damageType = rawType;
        }
    }
    if (!baseDice) {
        // Fallbacks: use natural damage dice (claws/bite) if defined, else defaults
        const isPlayer = world.has(source, Player);
        baseDice = isPlayer ? '1d2' : (atkEq?.naturalDamageDice || '1d8');
    }
    const damageRoll = rollDice(baseDice, r);
    // Add a small portion of attack bonus as flat damage (DnD-ish flavor)
    const flatBonus = atkSnapshot.damageFlatBonus;
    let dmg = Math.max(0, damageRoll + flatBonus);
    // Secondary crit check: critChanceDerived (decimal) + luck (integer %)
    if (!isCrit) {
      const critPct = (atkSnapshot.critChance * 100) + (atkSnapshot.luck || 0);
      if (critPct > 0) isCrit = pct(r, critPct);
    }
    const critMult = 2 + (atkSnapshot.critMult || 0);
    if (isCrit) dmg = Math.max(1, Math.floor(dmg * critMult));
    if (atkSnapshot.damageMult > 1) dmg = Math.max(1, Math.floor(dmg * atkSnapshot.damageMult));

    // Pre-hit hooks
    const procScratch = {};
    const ctx = makeCombatFrame(world, { attacker: source, defender: target, weaponId: weaponId || 0, damage: dmg, world });
    world.emit('beforeHit', ctx);
    let finalDmg = Math.max(0, Math.floor(ctx.damage));
    finalDmg = applyPendingDamageProcPhase(world, source, buildProcContext('onBeforeHit', {
        source,
        target,
        item: weaponId || 0,
        damage: finalDmg,
        damageType,
        crit: isCrit,
        tags: ['melee'],
        scratch: procScratch,
    }), () => r());
    ctx.damage = finalDmg;
    runLegacyMonsterHook(world, source, 'onBeforeHit', ctx);
    finalDmg = Math.max(0, Math.floor(ctx.damage));

    const hitCtx = makeCombatFrame(world, { attacker: source, defender: target, weaponId: ctx.weaponId || 0, damage: finalDmg, world });
    world.emit('hit', hitCtx);
    finalDmg = Math.max(0, Math.floor(hitCtx.damage));
    finalDmg = applyPendingDamageProcPhase(world, source, buildProcContext('onHit', {
        source,
        target,
        item: ctx.weaponId || 0,
        damage: finalDmg,
        damageType,
        crit: isCrit,
        tags: ['melee'],
        scratch: procScratch,
    }), () => r());
    hitCtx.damage = finalDmg;

    applyWeaponCoatingOnHit(world, {
        attacker: source,
        defender: target,
        weaponId,
        didHit: finalDmg > 0,
    });

    runLegacyMonsterHook(world, source, 'onHit', hitCtx);
    applyReactionProcPhase(world, target, buildProcContext('onHit', {
        source,
        target,
        item: ctx.weaponId || 0,
        damage: finalDmg,
        damageType,
        crit: isCrit,
        tags: ['melee'],
        scratch: procScratch,
    }), { excludeSlots: ['weapon'] });

    // Route through canonical damage pipeline (handles invuln, events, death)
    if (finalDmg > 0) {
        const bypassResist = damageType === 'physical';
        const result = dealDamage(world, {
            target,
            amount: finalDmg,
            source,
            type: damageType,
            cause: 'melee',
            critical: isCrit,
            bypassResist,
        });
        // dealDamage returns applied:false for invulnerable targets
        if (!result.applied && result.reason !== 'invulnerable') {
            world.emit?.('status', createStatusEvent({ id: target, kind: 'miss', source }));
        }
    } else {
        // Zero damage after modifiers → treat as miss/blocked
        world.emit?.('status', createStatusEvent({ id: target, kind: 'miss', source }));
    }
    return true;
}

/**
 * Resolve an off-hand melee attack after the main hand.
 * Only fires if attacker has a 1H weapon in Equipment.offhand.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} attacker
 * @param {number} defender
 */
function resolveOffhandAttack(world, attacker, defender) {
    const source = Number(attacker || 0) | 0;
    const target = Number(defender || 0) | 0;
    if (!(source > 0) || !(target > 0)) return;
    if (!world.isAlive(target)) return;

    const atkEq = world.get(source, Equipment);
    if (!atkEq) return;
    ensureEquippedAffixTopology(world, source);
    ensureEquippedAffixTopology(world, target);
    const offhandId = Number(atkEq.offhand || 0) | 0;
    if (!(offhandId > 0)) return;

    // Only fire if offhand item is a 1H weapon
    const offInfo = world.get(offhandId, ItemInfo);
    if (!offInfo || (offInfo.slot !== 'weapon' && offInfo.type !== 'equip')) return;
    if (offInfo.twoHanded) return;
    if (!offInfo.damageDice) return; // shields and non-weapons lack damageDice

    // Defender must still be alive (may have died from main hand)
    const defVit = world.get(target, Vitality);
    if (!defVit || (defVit.hp | 0) <= 0) return;

    // Range gate (same as main hand)
    const apos = world.get(source, Position);
    const dpos = world.get(target, Position);
    if (!apos || !dpos || (Math.abs((apos.x|0) - (dpos.x|0)) + Math.abs((apos.y|0) - (dpos.y|0))) !== 1) return;

    // Stamina gate: half cost, rounded up — silently skip if insufficient
    const atkStam = world.get(source, Stamina);
    const fullCost = Number(offInfo.staminaCost ?? 8);
    const halfCost = Math.ceil(fullCost / 2);

    if (atkStam) {
        const have = Number(atkStam.stamina ?? 0);
        if (have < halfCost) return;
        world.set(source, Stamina, { ...atkStam, stamina: have - halfCost, regenCooldown: STAMINA_REGEN_COOLDOWN });
    }

    // Cursed offhand fumble: 20% chance to waste the swing
    const offBeat = world.get(offhandId, Beatitude);
    if (offBeat && offBeat.state === BUC_CURSED) {
        const fumbleSeed = combatSeed(world.seed, world.step, source, target, 0x0FF2);
        const fumbleRng = mulberry32(fumbleSeed);
        if (pct(fumbleRng, 20)) {
            world.emit?.('combat:fumble', {
                attacker: source, defender: target,
                weaponId: offhandId,
                name: world.get(offhandId, NamedIdentity)?.name || 'weapon',
            });
            return;
        }
    }

    // Determine penalties (negated by ambidextrous trait)
    const traits = world.get(source, Traits);
    const isAmbi = traits?.ambidextrous === true;
    const hitPenalty = isAmbi ? 0 : -3;
    const damageMult = isAmbi ? 1.0 : 0.75;

    const atkSnapshot = resolveCombatSnapshot(world, source, { mode: 'melee' });
    const defSnapshot = resolveCombatSnapshot(world, target, { mode: 'melee' });
    const attackBonus = atkSnapshot.attackBonus + hitPenalty;
    const armorClass = defSnapshot.armorClass;

    // d20 roll with offhand-specific salt
    const seed = combatSeed(world.seed, world.step, source, target, 0x0FF);
    const r = mulberry32(seed);
    const d20 = rngInt(r, 1, 20);
    const totalToHit = d20 + attackBonus;
    let isCrit = d20 === 20;
    const isNat1 = d20 === 1;

    if (!isCrit && (isNat1 || totalToHit < armorClass)) {
        world.emit?.('status', createStatusEvent({ id: target, kind: 'miss', source }));
        return;
    }

    // Base damage from offhand weapon dice
    let damageType = 'physical';
    let baseDice = offInfo.damageDice ? String(offInfo.damageDice) : null;
    const rawType = String(offInfo.damageType || 'physical').toLowerCase();
    if (rawType === 'blunt' || rawType === 'slash' || rawType === 'pierce') {
        damageType = rawType;
    }
    if (!baseDice) {
        const isPlayer = world.has(source, Player);
        baseDice = isPlayer ? '1d2' : (atkEq?.naturalDamageDice || '1d8');
    }
    const damageRoll = rollDice(baseDice, r);
    const flatBonus = atkSnapshot.damageFlatBonus;
    let dmg = Math.max(0, Math.floor((damageRoll + flatBonus) * damageMult));

    // Crit logic
    if (!isCrit) {
        const critPct = (atkSnapshot.critChance * 100) + (atkSnapshot.luck || 0);
        if (critPct > 0) isCrit = pct(r, critPct);
    }
    const critMult = 2 + (atkSnapshot.critMult || 0);
    if (isCrit) dmg = Math.max(1, Math.floor(dmg * critMult));
    if (atkSnapshot.damageMult > 1) dmg = Math.max(1, Math.floor(dmg * atkSnapshot.damageMult));

    // Pre-hit hooks
    const procScratch = {};
    const ctx = makeCombatFrame(world, { attacker: source, defender: target, weaponId: offhandId, damage: dmg, world });
    world.emit('beforeHit', ctx);
    let finalDmg = Math.max(0, Math.floor(ctx.damage));
    finalDmg = applyPendingDamageProcPhase(world, source, buildProcContext('onBeforeHit', {
        source,
        target,
        item: offhandId,
        damage: finalDmg,
        damageType,
        crit: isCrit,
        tags: ['melee', 'offhand'],
        scratch: procScratch,
        offhand: true,
    }), () => r());
    ctx.damage = finalDmg;
    runLegacyMonsterHook(world, source, 'onBeforeHit', ctx);
    finalDmg = Math.max(0, Math.floor(ctx.damage));

    // On-hit hooks
    const hitCtx = makeCombatFrame(world, { attacker: source, defender: target, weaponId: ctx.weaponId || 0, damage: finalDmg, world });
    world.emit('hit', hitCtx);
    finalDmg = Math.max(0, Math.floor(hitCtx.damage));
    finalDmg = applyPendingDamageProcPhase(world, source, buildProcContext('onHit', {
        source,
        target,
        item: ctx.weaponId || 0,
        damage: finalDmg,
        damageType,
        crit: isCrit,
        tags: ['melee', 'offhand'],
        scratch: procScratch,
        offhand: true,
    }), () => r());
    hitCtx.damage = finalDmg;

    applyWeaponCoatingOnHit(world, {
        attacker: source, defender: target,
        weaponId: offhandId,
        didHit: finalDmg > 0,
    });

    runLegacyMonsterHook(world, source, 'onHit', hitCtx);
    applyReactionProcPhase(world, target, buildProcContext('onHit', {
        source,
        target,
        item: ctx.weaponId || 0,
        damage: finalDmg,
        damageType,
        crit: isCrit,
        tags: ['melee', 'offhand'],
        scratch: procScratch,
        offhand: true,
    }), { excludeSlots: ['weapon'] });

    // Route through canonical damage pipeline with offhand flag
    if (finalDmg > 0) {
        const bypassResist = damageType === 'physical';
        const result = dealDamage(world, {
            target, amount: finalDmg, source,
            type: damageType, cause: 'melee',
            critical: isCrit, bypassResist,
            offhand: true,
        });
        if (!result.applied && result.reason !== 'invulnerable') {
            world.emit?.('status', createStatusEvent({ id: target, kind: 'miss', source }));
        }
    } else {
        world.emit?.('status', createStatusEvent({ id: target, kind: 'miss', source }));
    }
}

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function combatSystem(world) {
    for (const [attacker, intent] of world.query(AttackIntent)) {
        try {
            const attempted = resolveMeleeAttack(world, attacker, intent.targetId | 0);
            if (attempted) resolveOffhandAttack(world, attacker, intent.targetId | 0);
        } catch (e) { console.error('[combatSystem] resolveMeleeAttack failed:', e); }
        try { world.remove(attacker, AttackIntent); } catch {} // ECS: may not exist
    }
}
