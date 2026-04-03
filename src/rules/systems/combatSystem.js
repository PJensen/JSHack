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
import { ActiveEffects } from '../components/ActiveEffects.js';
import { COMBAT_POSTURES } from '../components/CombatPosture.js';
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
import { ensureEquippedAffixTopology } from '../utils/affixTopology.js';
import { buildProcContext, applyPendingDamageProcPhase, applyReactionProcPhase } from '../utils/procPhases.js';
import { breakStealthOnOffense } from '../utils/stealthAmbush.js';
import {
    calculateBlindedPhysicalDamage,
    getBlindedCritChanceBonusPct,
    getBlindedCritMultBonus,
} from '../utils/blindnessExposure.js';
import { getEntityFacingConeDegrees, getNormalizedEntityFacing, isPointInFacingCone } from '../utils/facing.js';
import { getPositionalAttackBonus, hasOffhandShield } from '../utils/combatPositioning.js';
import { setCombatPosture } from '../utils/posture.js';
import { upsertTimedEffect } from '../utils/effectSemantics.js';
import { emitSafe } from '../utils/emitSafe.js';

const BUMP_ATTACK_INSTALLED = Symbol.for('jshack:combat:bumpAttack:installed');

function computeImpactVector(from, to) {
    const dx = Number(to?.x || 0) - Number(from?.x || 0);
    const dy = Number(to?.y || 0) - Number(from?.y || 0);
    const mag = Math.hypot(dx, dy);
    if (!(mag > 0)) return { dx: 0, dy: 1 };
    return { dx: dx / mag, dy: dy / mag };
}

function resolveWeaponClass(world, weaponId, damageType) {
    if (!(weaponId > 0) || !world.isAlive(weaponId)) return 'unarmed';
    const info = world.get(weaponId, ItemInfo);
    const identity = String(
        world.get(weaponId, NamedIdentity)?.identity
        || info?.subtype
        || world.get(weaponId, NamedIdentity)?.name
        || ''
    ).toLowerCase();
    if (identity.includes('morningstar')) return 'morningstar';
    if (identity.includes('dagger') || identity.includes('shiv') || identity.includes('athame') || identity.includes('knife')) return 'dagger';
    if (identity.includes('sword') || identity.includes('blade') || identity.includes('sabre') || identity.includes('rapier') || identity.includes('katana')) return 'sword';
    if (identity.includes('mace') || identity.includes('maul') || identity.includes('club') || identity.includes('hammer') || identity.includes('flail')) return 'mace';
    if (identity.includes('axe') || identity.includes('hatchet')) return 'axe';
    if (damageType === 'blunt') return 'mace';
    if (damageType === 'slash') return 'sword';
    if (damageType === 'pierce') return 'dagger';
    return 'weapon';
}

function buildDamageSignature(info, damageType) {
    const bonuses = info?.bonuses || {};
    let blunt = Math.max(0, Number(bonuses.bluntPenetration || 0));
    let pierce = Math.max(0, Number(bonuses.piercePenetration || 0));
    let slash = Math.max(0, Number(bonuses.slashPenetration || 0));
    if (damageType === 'blunt') blunt += 2;
    else if (damageType === 'pierce') pierce += 2;
    else if (damageType === 'slash') slash += 2;
    else {
        blunt += 1;
        pierce += 1;
        slash += 1;
    }
    const total = blunt + pierce + slash;
    if (!(total > 0)) return { blunt: 0.34, pierce: 0.33, slash: 0.33 };
    return {
        blunt: blunt / total,
        pierce: pierce / total,
        slash: slash / total,
    };
}

function buildMeleeImpactProfile(world, weaponId, damageType, offhand, facingVector) {
    const info = (weaponId > 0 && world.isAlive(weaponId)) ? world.get(weaponId, ItemInfo) : null;
    const weaponClass = resolveWeaponClass(world, weaponId, damageType);
    const attackKind = damageType === 'pierce'
        ? 'stab'
        : (damageType === 'slash' ? 'slash' : (damageType === 'blunt' ? 'blunt' : 'strike'));
    return {
        weaponClass,
        attackKind,
        offhand: !!offhand,
        signature: buildDamageSignature(info, damageType),
        facingVector: facingVector || undefined,
    };
}

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

function ensureEffects(world, entityId) {
    let ae = world.get(entityId, ActiveEffects);
    if (ae && Array.isArray(ae.effects)) return ae;
    try { world.add(entityId, ActiveEffects, { effects: [] }); } catch {}
    ae = world.get(entityId, ActiveEffects);
    return (ae && Array.isArray(ae.effects)) ? ae : null;
}

function applyDamageTextureEffects(world, {
    attacker, defender, damageType, appliedDamage, critical,
}) {
    if (!(appliedDamage > 0) || !world.isAlive(defender)) return;
    const ae = ensureEffects(world, defender);
    if (!ae) return;

    if (damageType === 'blunt' && appliedDamage >= 4) {
        upsertTimedEffect(ae.effects, {
            key: 'stagger',
            turnsLeft: critical ? 2 : 1,
            potency: 1,
            stacks: 1,
            sourceId: attacker,
            startedAtTurn: world.step,
        });
        emitSafe(world, 'combat:status:stagger', { attacker, defender, critical: !!critical });
    }
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
 * Core d20 melee hit resolution shared by main-hand and off-hand attacks.
 * Handles: fumble, snapshots, d20 roll, damage dice, crit, proc phases, dealDamage.
 * @returns {boolean} true if the attack was attempted
 */
function resolveHitRoll(world, {
    source, target, weaponId, atkEq,
    hitPenalty, baseDamageMult, seedSalt, fumbleSalt,
    tags, offhand,
}) {
    // Cursed weapon fumble: 20% chance to waste the attack (stamina already spent)
    if (weaponId) {
        const weaponBeat = world.get(weaponId, Beatitude);
        if (weaponBeat && weaponBeat.state === BUC_CURSED) {
            const fumbleSeed = combatSeed(world.seed, world.step, source, target, fumbleSalt);
            const fumbleRng = mulberry32(fumbleSeed);
            if (pct(fumbleRng, 20)) {
                world.emit?.('combat:fumble', {
                    attacker: source, defender: target, weaponId,
                    name: world.get(weaponId, NamedIdentity)?.name || 'weapon',
                });
                return true;
            }
        }
    }

    const atkSnapshot = resolveCombatSnapshot(world, source, { mode: 'melee' });
    const defSnapshot = resolveCombatSnapshot(world, target, { mode: 'melee' });
    const blindExposure = Math.max(0, Number(defSnapshot?.status?.blinded || 0));
    breakStealthOnOffense(world, source, { reason: 'attack', mode: 'melee', targetId: target });
    const positional = getPositionalAttackBonus(world, source, target);
    const actionTags = Array.isArray(tags) ? [...tags, `relation:${positional.relation}`] : [`relation:${positional.relation}`];
    let attackBonus = atkSnapshot.attackBonus + hitPenalty + positional.attackBonus;
    const armorClass = defSnapshot.armorClass;

    const seed = combatSeed(world.seed, world.step, source, target, seedSalt);
    const r = mulberry32(seed);
    const d20 = rngInt(r, 1, 20);
    const totalToHit = d20 + attackBonus;
    let isCrit = d20 === 20;
    const isNat1 = d20 === 1;

    if (!isCrit && (isNat1 || totalToHit < armorClass)) {
        world.emit?.('status', createStatusEvent({ id: target, kind: 'miss', source }));
        applyPendingDamageProcPhase(world, source, buildProcContext('onMiss', {
            source, target, item: weaponId || 0, damage: 0,
            damageType: 'physical', crit: false, tags: actionTags, scratch: {}, offhand,
        }), () => r());
        return true;
    }

    // ── Dodge check: defender's evade stat grants a chance to avoid the hit entirely ──
    if (!isCrit && defSnapshot.evade > 0) {
        // Dodge chance: evade / (evade + 20) — diminishing returns, caps ~71% at evade=50
        const dodgeChance = defSnapshot.evade / (defSnapshot.evade + 20);
        const dodgeRoll = r();
        if (dodgeRoll < dodgeChance) {
            const dpos = world.get(target, Position);
            emitSafe(world, 'combat:dodge', {
                defender: target,
                attacker: source,
                at: dpos ? { x: dpos.x, y: dpos.y } : undefined,
            });
            applyPendingDamageProcPhase(world, source, buildProcContext('onMiss', {
                source, target, item: weaponId || 0, damage: 0,
                damageType: 'physical', crit: false, tags: [...actionTags, 'dodged'], scratch: {}, offhand,
            }), () => r());
            return true;
        }
    }

    // ── Parry check: defender with a weapon (not shield) in hand can deflect attacks ──
    if (!isCrit) {
        const defEq = world.get(target, Equipment);
        const defWeaponId = Number(defEq?.weapon || 0) | 0;
        if (defWeaponId > 0 && world.isAlive(defWeaponId) && !hasOffhandShield(world, target)) {
            const defWeaponInfo = world.get(defWeaponId, ItemInfo);
            if (defWeaponInfo?.damageDice) {
                // Dual-wield bonus: +5% parry when offhand also has a weapon
                const offhandId = Number(defEq?.offhand || 0) | 0;
                let dualWieldBonus = 0;
                if (offhandId > 0 && world.isAlive(offhandId)) {
                    const offInfo = world.get(offhandId, ItemInfo);
                    if (offInfo?.damageDice) dualWieldBonus = 0.05;
                }
                // Parry chance: 8% base + 1% per defender evade + 5% dual-wield, capped at 30%
                const parryChance = Math.min(0.30, 0.08 + defSnapshot.evade * 0.01 + dualWieldBonus);
                const parryRoll = r();
                if (parryRoll < parryChance) {
                    const dpos = world.get(target, Position);
                    emitSafe(world, 'combat:parry', {
                        defender: target,
                        attacker: source,
                        weaponId: defWeaponId,
                        weaponName: world.get(defWeaponId, NamedIdentity)?.name || 'weapon',
                        at: dpos ? { x: dpos.x, y: dpos.y } : undefined,
                        dualWield: dualWieldBonus > 0,
                    });
                    applyPendingDamageProcPhase(world, source, buildProcContext('onMiss', {
                        source, target, item: weaponId || 0, damage: 0,
                        damageType: 'physical', crit: false, tags: [...actionTags, 'parried'], scratch: {}, offhand,
                    }), () => r());
                    return true;
                }
            }
        }
    }

    // Base damage from weapon dice (or fallback)
    let damageType = 'physical';
    let baseDice = null;
    if (weaponId) {
        const info = world.get(weaponId, ItemInfo);
        baseDice = info?.damageDice ? String(info.damageDice) : null;
        const rawType = String(info?.damageType || 'physical').toLowerCase();
        if (rawType === 'blunt' || rawType === 'slash' || rawType === 'pierce') {
            damageType = rawType;
        }
    }
    if (!baseDice) {
        const isPlayer = world.has(source, Player);
        baseDice = isPlayer ? '1d2' : (atkEq?.naturalDamageDice || '1d8');
    }
    const damageRoll = rollDice(baseDice, r);
    const flatBonus = atkSnapshot.damageFlatBonus;
    let dmg = Math.max(0, Math.floor((damageRoll + flatBonus) * baseDamageMult));
    dmg = Math.max(0, Math.floor(dmg * positional.damageMult));
    if ((Number(atkSnapshot?.posture?.lastMoveStep ?? -1) | 0) === (Number(world.step || 0) | 0)) {
        dmg += 1; // momentum chip from same-turn movement commitment
    }
    let armorPenetration = Math.max(0, Number(atkSnapshot.physicalPenetration || 0));
    if (damageType === 'blunt') armorPenetration += Math.max(0, Number(atkSnapshot.bluntPenetration || 0));
    if (damageType === 'slash') armorPenetration += Math.max(0, Number(atkSnapshot.slashPenetration || 0));
    if (damageType === 'pierce') armorPenetration += Math.max(0, Number(atkSnapshot.piercePenetration || 0));

    if (!isCrit) {
        const blindCritBonusPct = getBlindedCritChanceBonusPct(blindExposure);
        const critPct = (atkSnapshot.critChance * 100) + (atkSnapshot.luck || 0) + blindCritBonusPct;
        if (critPct > 0) isCrit = pct(r, critPct);
    }
    const blindCritMultBonus = getBlindedCritMultBonus(blindExposure);
    const critMult = 2 + (atkSnapshot.critMult || 0) + blindCritMultBonus;
    if (isCrit) dmg = Math.max(1, Math.floor(dmg * critMult));
    dmg = calculateBlindedPhysicalDamage(dmg, blindExposure);
    if (atkSnapshot.damageMult > 1) dmg = Math.max(1, Math.floor(dmg * atkSnapshot.damageMult));

    // Pre-hit hooks
    const procScratch = {};
    const ctx = makeCombatFrame(world, { attacker: source, defender: target, weaponId: weaponId || 0, damage: dmg, damageType, world });
    world.emit('beforeHit', ctx);
    let finalDmg = Math.max(0, Math.floor(ctx.damage));
    finalDmg = applyPendingDamageProcPhase(world, source, buildProcContext('onBeforeHit', {
        source, target, item: weaponId || 0, damage: finalDmg,
        damageType, crit: isCrit, tags: actionTags, scratch: procScratch, offhand,
    }), () => r());
    ctx.damage = finalDmg;
    runLegacyMonsterHook(world, source, 'onBeforeHit', ctx);
    finalDmg = Math.max(0, Math.floor(ctx.damage));

    const hitCtx = makeCombatFrame(world, { attacker: source, defender: target, weaponId: ctx.weaponId || 0, damage: finalDmg, damageType, world });
    world.emit('hit', hitCtx);
    finalDmg = Math.max(0, Math.floor(hitCtx.damage));
    finalDmg = applyPendingDamageProcPhase(world, source, buildProcContext('onHit', {
        source, target, item: ctx.weaponId || 0, damage: finalDmg,
        damageType, crit: isCrit, tags: actionTags, scratch: procScratch, offhand,
    }), () => r());
    hitCtx.damage = finalDmg;

    applyWeaponCoatingOnHit(world, {
        attacker: source, defender: target, weaponId,
        didHit: finalDmg > 0,
    });

    runLegacyMonsterHook(world, source, 'onHit', hitCtx);
    applyReactionProcPhase(world, target, buildProcContext('onHit', {
        source, target, item: ctx.weaponId || 0, damage: finalDmg,
        damageType, crit: isCrit, tags: actionTags, scratch: procScratch, offhand,
    }), { excludeSlots: ['weapon'] });

    if (finalDmg > 0) {
        const srcPos = world.get(source, Position);
        const dstPos = world.get(target, Position);
        const facing = getNormalizedEntityFacing(world, source);
        const result = dealDamage(world, {
            target, amount: finalDmg, source,
            type: damageType, cause: 'melee',
            critical: isCrit,
            armorPenetration,
            impactVector: computeImpactVector(srcPos, dstPos),
            impactProfile: buildMeleeImpactProfile(
                world,
                weaponId,
                damageType,
                offhand,
                (facing && Number.isFinite(facing.dx) && Number.isFinite(facing.dy))
                    ? { dx: Number(facing.dx), dy: Number(facing.dy) }
                    : null,
            ),
            ...(offhand ? { offhand: true } : {}),
        });
        if (result.applied) {
            applyDamageTextureEffects(world, {
                attacker: source,
                defender: target,
                damageType,
                appliedDamage: result.amount,
                critical: isCrit,
            });
        }
        if (!result.applied && result.reason !== 'invulnerable' && result.reason !== 'resisted') {
            world.emit?.('status', createStatusEvent({ id: target, kind: 'miss', source }));
        }
    } else {
        world.emit?.('status', createStatusEvent({ id: target, kind: 'miss', source }));
    }
    return true;
}

/**
 * Resolve one main-hand melee attack attempt.
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

    // Range gate: only allow melee from orthogonal adjacency
    const apos = world.get(source, Position);
    const dpos = world.get(target, Position);
    if (!apos || !dpos || (Math.abs((apos.x|0) - (dpos.x|0)) + Math.abs((apos.y|0) - (dpos.y|0))) !== 1) return false;
    const facing = getNormalizedEntityFacing(world, source);
    if (facing) {
        const coneDegrees = getEntityFacingConeDegrees(world, source);
        if (!isPointInFacingCone(apos.x, apos.y, dpos.x, dpos.y, facing.dx, facing.dy, coneDegrees)) return false;
    }

    // Faction hostility gate
    const af = world.get(source, Faction)?.key || '';
    const df = world.get(target, Faction)?.key || '';
    if (!areFactionsHostile(af, df)) return false;

    const atkEq = world.get(source, Equipment);
    ensureEquippedAffixTopology(world, source);
    ensureEquippedAffixTopology(world, target);

    // Stamina gate
    const atkStam = world.get(source, Stamina);
    const weaponId = atkEq?.weapon || 0;
    let staminaCost = 3;
    if (weaponId) {
        const weaponInfo = world.get(weaponId, ItemInfo);
        staminaCost = Number(weaponInfo?.staminaCost ?? 8);
    }
    if (atkStam) {
        const have = Number(atkStam.stamina ?? 0);
        if (have < staminaCost) {
            world.emit?.('attack:insufficient-stamina', {
                attacker: source, defender: target, weaponId, need: staminaCost, have
            });
            return false;
        }
        world.set(source, Stamina, { ...atkStam, stamina: have - staminaCost, regenCooldown: STAMINA_REGEN_COOLDOWN });
    }
    setCombatPosture(world, source, COMBAT_POSTURES.aggressive, { reason: 'attack:melee' });

    return resolveHitRoll(world, {
        source, target, weaponId, atkEq,
        hitPenalty: 0, baseDamageMult: 1.0,
        seedSalt: undefined, fumbleSalt: 0xF0B1E,
        tags: ['melee'], offhand: false,
    });
}

/**
 * Resolve an off-hand melee attack after the main hand.
 * Only fires if attacker has a 1H weapon in Equipment.offhand.
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

    // Only fire if offhand item is a 1H weapon with damageDice
    const offInfo = world.get(offhandId, ItemInfo);
    if (!offInfo || (offInfo.slot !== 'weapon' && offInfo.type !== 'equip')) return;
    if (offInfo.twoHanded) return;
    if (!offInfo.damageDice) return;

    // Defender must still be alive (may have died from main hand)
    const defVit = world.get(target, Vitality);
    if (!defVit || (defVit.hp | 0) <= 0) return;

    // Range gate
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

    // Determine penalties (negated by ambidextrous trait)
    const traits = world.get(source, Traits);
    const isAmbi = traits?.ambidextrous === true;

    resolveHitRoll(world, {
        source, target, weaponId: offhandId, atkEq,
        hitPenalty: isAmbi ? 0 : -3,
        baseDamageMult: isAmbi ? 1.0 : 0.75,
        seedSalt: 0x0FF, fumbleSalt: 0x0FF2,
        tags: ['melee', 'offhand'], offhand: true,
    });
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
