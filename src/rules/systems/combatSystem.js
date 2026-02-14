// src/rules/systems/combatSystem.js
// Processes AttackIntent: computes damage using derived stats, emits events for affix triggers, applies Vitality changes.

import { AttackIntent } from '../components/Intents/AttackIntent.js';
import { Equipment } from '../components/Equipment.js';
import { Vitality } from '../components/Vitality.js';
import { ItemInfo } from '../components/ItemInfo.js';
import { Faction } from '../components/Faction.js';
import { Player } from '../components/Player.js';
import { Status } from '../components/Status.js';
import { STAMINA_REGEN_COOLDOWN } from '../data/regenConstants.js';
import { Position } from '../components/Position.js';
import { Stamina } from '../components/Stamina.js';
import { NamedIdentity } from '../components/NamedIdentity.js';
import { AFFIX_DEFS } from '../data/affixes.js';
import { getMonster } from '../data/monsters.js';
import { mulberry32, rngInt, rollDice, combatSeed } from '../utils/rng.js';
import { runScript, ScriptVerb } from '../scripting.js';
import { HUNGER_COMBAT_LEVELS } from '../data/food.js';
import { isEntityInvulnerable } from '../utils/effectGuards.js';

/** @param {import('../../lib/ecs-js/index.js').World} world @param {number} entityId @param {(a:any, slotId:number)=>void} fn */
function forEachAffix(world, entityId, fn) {
    const eq = world.get(entityId, Equipment);
    if (!eq) return;
    for (const slotId of [eq.weapon, eq.armor, eq.ring1, eq.ring2]) {
        if (!Number.isInteger(slotId)) continue;
        const info = world.get(slotId, ItemInfo);
        if (!info || !Array.isArray(info.affixes)) continue;
        for (const aId of info.affixes) {
            const a = /** @type any */ (AFFIX_DEFS)[aId];
            if (a) fn(a, slotId);
        }
    }
}

/** @param {import('../../lib/ecs-js/index.js').World} world @param {{attacker:number, defender:number, weaponId:number, damage:number, world:any}} base */
function attachHelpers(world, base) {
    /** @param {string} k @param {number} v */
    base.addBonus = (k, v) => { if (k === 'damage') base.damage += v; };
    /** @param {number} amount */
    base.retaliate = (amount) => {
        const t = world.get(base.attacker, Vitality);
        if (!t) return;
        t.hp = Math.max(0, t.hp - Math.max(0, amount | 0));
    };
    /** @param {number} entity @param {number} amount */
    base.heal = (entity, amount) => {
        const vit = world.get(entity, Vitality);
        if (!vit) return;
        vit.hp = Math.min(vit.maxHp, vit.hp + Math.max(0, amount | 0));
    };
    /** @param {number} amount */
    base.healAttacker = (amount) => {
        const vit = world.get(base.attacker, Vitality);
        if (!vit) return;
        vit.hp = Math.min(vit.maxHp, vit.hp + Math.max(0, amount | 0));
    };
    return base;
}

/**
 * @param {any} world
 * @param {number} entityId
 * @param {'onBeforeHit'|'onHit'} hookName
 * @param {any} ctx
 */
function runMonsterHook(world, entityId, hookName, ctx) {
    const ni = world.get(entityId, NamedIdentity);
    const def = ni ? getMonster(ni.identity) : null;
    const hook = def?.hooks?.[hookName];
    if (typeof hook === 'function') {
        try { hook({ world, ctx }); } catch {}
        return true;
    }
    return false;
}

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function combatSystem(world) {
    for (const [attacker, intent] of world.query(AttackIntent)) {
        const defender = intent.targetId | 0;
        if (!world.isAlive(defender)) { world.remove(attacker, AttackIntent); continue; }

        const atkVit = world.get(attacker, Vitality);
        const defVit = world.get(defender, Vitality);
        if (!atkVit || !defVit) { world.remove(attacker, AttackIntent); continue; }

        // Range gate: only allow melee from orthogonal adjacency (no diagonals, no ranged)
        const apos = world.get(attacker, Position);
        const dpos = world.get(defender, Position);
        if (!apos || !dpos || (Math.abs((apos.x|0) - (dpos.x|0)) + Math.abs((apos.y|0) - (dpos.y|0))) !== 1) {
            // Out of range: silently consume intent without emitting a MISS far away
            // (prevents confusing "MISS" feedback when monsters are not adjacent)
            world.remove(attacker, AttackIntent);
            continue;
        }

        // Friendly fire prevention: same faction cannot harm each other (assumption per request)
        const af = world.get(attacker, Faction)?.key || '';
        const df = world.get(defender, Faction)?.key || '';
        if (af && df && af === df) {
            // treat as immune (same faction)
            // world.emit?.('status', { id: defender, kind: 'immune', text: 'IMMUNE', source: attacker });
            world.remove(attacker, AttackIntent);
            continue;
        }

        const atkEq = world.get(attacker, Equipment);
        const defEq = world.get(defender, Equipment);

        // Stamina gate: check if attacker has enough stamina for weapon
        const atkStam = world.get(attacker, Stamina);
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
                    attacker, defender, weaponId, need: staminaCost, have
                });
                world.remove(attacker, AttackIntent);
                continue;
            }
            // Deduct stamina and suppress regen this turn
            world.set(attacker, Stamina, { ...atkStam, stamina: have - staminaCost, regenCooldown: STAMINA_REGEN_COOLDOWN });
        }

        // Disease penalty: each stack of 'disease' reduces attack/defense by potency
        const atkStatus = world.get(attacker, Status);
        const atkDisease = atkStatus?.statuses?.find(s => s.type === 'disease');
        const atkDiseasePenalty = atkDisease ? Math.max(0, (atkDisease.potency || 1) * (atkDisease.stacks || 1)) : 0;

        const defStatus = world.get(defender, Status);
        const defDisease = defStatus?.statuses?.find(s => s.type === 'disease');
        const defDiseasePenalty = defDisease ? Math.max(0, (defDisease.potency || 1) * (defDisease.stacks || 1)) : 0;

        // Hunger penalty: hungry/famished/starving/wasting reduce attack and defense
        const atkHunger = atkStatus?.statuses?.find(s => HUNGER_COMBAT_LEVELS.includes(s.type));
        const atkHungerPenalty = atkHunger ? Math.max(0, atkHunger.potency || 0) : 0;
        const defHunger = defStatus?.statuses?.find(s => HUNGER_COMBAT_LEVELS.includes(s.type));
        const defHungerPenalty = defHunger ? Math.max(0, defHunger.potency || 0) : 0;

        const attackBonus = Math.max(0, 1 + (atkEq?.attackDerived || 0) - atkDiseasePenalty - atkHungerPenalty);
        const armorClass = 10 + Math.max(0, (defEq?.defenseDerived || 0) - defDiseasePenalty - defHungerPenalty);

        // Deterministic d20 roll seeded by world + participants + step
        const seed = combatSeed(world.seed, world.step, attacker, defender);
        const r = mulberry32(seed);
        const d20 = rngInt(r, 1, 20);
        const totalToHit = d20 + attackBonus;
        const isCrit = d20 === 20;
        const isNat1 = d20 === 1;

        if (!isCrit && (isNat1 || totalToHit < armorClass)) {
            // Miss (include attacker for better UX logging)
            world.emit?.('status', { id: defender, kind: 'miss', text: 'MISS', source: attacker });
            world.remove(attacker, AttackIntent);
            continue;
        }

        // Base damage from weapon dice (or fallback)
        weaponId = atkEq?.weapon || 0;
        let baseDice = null;
        if (weaponId) {
            const info = world.get(weaponId, ItemInfo);
            baseDice = (info && info.damageDice) ? String(info.damageDice) : null;
        }
        if (!baseDice) {
            // Fallbacks: use natural damage dice (claws/bite) if defined, else defaults
            const isPlayer = world.has(attacker, Player);
            baseDice = isPlayer ? '1d2' : (atkEq?.naturalDamageDice || '1d8');
        }
        const damageRoll = rollDice(baseDice, r);
        // Add a small portion of attack bonus as flat damage (DnD-ish flavor)
        const flatBonus = Math.max(0, Math.floor((atkEq?.attackDerived || 0) / 2));
        let dmg = Math.max(0, damageRoll + flatBonus);
        if (isCrit) dmg = Math.max(1, dmg * 2);

        // Pre-hit hooks
        const ctx = attachHelpers(world, { attacker, defender, weaponId: weaponId || 0, damage: dmg, world });
        world.emit('beforeHit', ctx);
        forEachAffix(world, attacker, /** @param {any} a */ (a) => {
            if (a.triggers?.includes('onBeforeHit') && a.script) {
                runScript(a.script, ScriptVerb.AffixOnBeforeHit, world, ctx);
            }
        });
        // Innate monster pre-hit behavior from monster definition hooks
        runMonsterHook(world, attacker, 'onBeforeHit', ctx);
        // Recompute damage if modified
        let finalDmg = Math.max(0, Math.floor(ctx.damage));

        const hitCtx = attachHelpers(world, { attacker, defender, weaponId: ctx.weaponId || 0, damage: finalDmg, world });
        world.emit('hit', hitCtx);
        let hasVamp = false;
        // Attacker on-hit affixes (e.g., vampiric)
        forEachAffix(world, attacker, /** @param {any} a */ (a) => {
            if (a.triggers?.includes('onHit') && a.script) {
                runScript(a.script, ScriptVerb.AffixOnHit, world, hitCtx);
                if (a.name && a.name.toLowerCase().includes('vamp')) hasVamp = true;
            }
        });
        finalDmg = Math.max(0, Math.floor(hitCtx.damage));
        if (hasVamp) hitCtx.healAttacker(Math.max(1, Math.floor(finalDmg/3)));
        // Innate monster on-hit behavior from monster definition hooks
        runMonsterHook(world, attacker, 'onHit', hitCtx);
        // Defender on-hit reactions (e.g., Thorns)
        const defCtx = attachHelpers(world, { attacker, defender, weaponId: ctx.weaponId || 0, damage: finalDmg, world });
        forEachAffix(world, defender, /** @param {any} a */ (a) => {
            if (a.triggers?.includes('onHit') && a.script) {
                runScript(a.script, ScriptVerb.AffixOnHit, world, defCtx);
            }
        });

        // Invulnerability gate: if defender has 'invulnerable' status active, nullify damage
        const isInvuln = isEntityInvulnerable(world, defender);
        if (isInvuln) {
            finalDmg = 0;
            world.emit?.('status', { id: defender, kind: 'immune', text: 'IMMUNE', source: attacker });
        }

    if (finalDmg > 0) {
            defVit.hp = Math.max(0, defVit.hp - finalDmg);
            world.emit('damaged', { target: defender, amount: finalDmg, source: attacker, critical: isCrit });
            if (defVit.hp <= 0) world.emit('died', { id: defender, killer: attacker });
        } else {
            // Zero damage after modifiers → treat as miss/blocked; include attacker for logs
            world.emit?.('status', { id: defender, kind: 'miss', text: 'MISS', source: attacker });
        }

        world.remove(attacker, AttackIntent);
    }
}
