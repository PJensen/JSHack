// src/rules/systems/combatSystem.js
// Processes AttackIntent: computes damage using derived stats, emits events for affix triggers, applies Vitality changes.

import { AttackIntent } from '../components/Intents/AttackIntent.js';
import { Equipment } from '../components/Equipment.js';
import { Vitality } from '../components/Vitality.js';
import { ItemInfo } from '../components/ItemInfo.js';
import { Faction } from '../components/Faction.js';
import { Player } from '../components/Player.js';
import { Status } from '../components/Status.js';
import { Position } from '../components/Position.js';
import { AFFIX_DEFS } from '../data/affixes.js';
import { mulberry32, rngInt } from '../../lib/ecs-js/rng.js';
import { runScript, ScriptVerb } from '../scripting.js';

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
        // Disease penalty: each stack of 'diseased' reduces attack/defense by potency
        const atkStatus = world.get(attacker, Status);
        const atkDisease = atkStatus?.statuses?.find(s => s.type === 'diseased');
        const atkDiseasePenalty = atkDisease ? Math.max(0, (atkDisease.potency || 1) * (atkDisease.stacks || 1)) : 0;

        const defStatus = world.get(defender, Status);
        const defDisease = defStatus?.statuses?.find(s => s.type === 'diseased');
        const defDiseasePenalty = defDisease ? Math.max(0, (defDisease.potency || 1) * (defDisease.stacks || 1)) : 0;

        const attackBonus = Math.max(0, 1 + (atkEq?.attackDerived || 0) - atkDiseasePenalty);
        const armorClass = 10 + Math.max(0, (defEq?.defenseDerived || 0) - defDiseasePenalty);

        // Deterministic d20 roll seeded by world + participants + step
        const seed = (world.seed >>> 0) ^ ((world.step | 0) * 0x9e3779b9 >>> 0) ^ (attacker >>> 0) ^ ((defender << 16) >>> 0);
        const r = mulberry32(seed >>> 0);
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
        let weaponId = atkEq?.weapon || 0;
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
        // Innate monster pre-hit script (e.g., orc rage bonus damage)
        if (atkEq?.naturalScript) {
            runScript(atkEq.naturalScript, ScriptVerb.AffixOnBeforeHit, world, ctx);
        }
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
        // Innate monster on-hit script (e.g., rat bite → disease)
        if (atkEq?.naturalScript) {
            runScript(atkEq.naturalScript, ScriptVerb.AffixOnHit, world, hitCtx);
        }
        // Defender on-hit reactions (e.g., Thorns)
        const defCtx = attachHelpers(world, { attacker, defender, weaponId: ctx.weaponId || 0, damage: finalDmg, world });
        forEachAffix(world, defender, /** @param {any} a */ (a) => {
            if (a.triggers?.includes('onHit') && a.script) {
                runScript(a.script, ScriptVerb.AffixOnHit, world, defCtx);
            }
        });

        // Invulnerability gate: if defender has 'invulnerable' status active, nullify damage
        const stat = world.get(defender, Status);
        const isInvuln = !!(stat && Array.isArray(stat.statuses) && stat.statuses.some(s => String(s.type).toLowerCase() === 'invulnerable' && (s.duration|0) > 0));
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

// Dice helpers
/** @param {string} spec @param {() => number} rng */
function rollDice(spec, rng) {
    // spec like '2d6' or '1d8'
    const m = /^\s*(\d+)d(\d+)\s*$/i.exec(String(spec||''));
    if (!m) return 1;
    const cStr = m[1] || '1';
    const sStr = m[2] || '2';
    const count = Math.max(1, (parseInt(cStr,10)|0));
    const sides = Math.max(2, (parseInt(sStr,10)|0));
    let sum = 0;
    for (let i=0;i<count;i++) sum += rngInt(rng, 1, sides);
    return sum;
}
