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
import { AFFIX_DEFS } from '../data/affixes.js';
import { getMonster } from '../data/monsters.js';
import { CombatCallbackContext } from '../data/callbacks/combat.js';
import { runCallbackList } from '../interaction/dispatch.js';
import { degradeFloorMemory } from '../environment/dungeon/transition.js';
import { mulberry32, rngInt, rollDice, combatSeed, pct } from '../utils/rng.js';
import { runScript, ScriptVerb } from '../scripting.js';
import { dealDamage } from '../utils/dealDamage.js';
import { areFactionsHostile } from '../utils/factionHostility.js';
import { resolveCombatSnapshot } from '../utils/resolveCombatSnapshot.js';
import { applyWeaponCoatingOnHit } from '../data/weaponCoatings.js';
import { createStatusEvent } from '../../shared/events/statusEvent.js';

const BUMP_ATTACK_INSTALLED = Symbol.for('jshack:combat:bumpAttack:installed');

/** @param {import('../../lib/ecs-js/index.js').World} world @param {number} entityId @param {(a:any, slotId:number)=>void} fn */
function forEachAffix(world, entityId, fn) {
    const eq = world.get(entityId, Equipment);
    if (!eq) return;
    for (const slot of NON_AMMO_GEAR_SLOTS) {
        const slotId = eq[slot];
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
        dealDamage(world, {
            target: base.attacker,
            amount: Math.max(0, amount | 0),
            source: base.defender,
            type: 'physical',
            cause: 'retaliation',
            bypassResist: true,
            noTrigger: true,
        });
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
 * Run monster definition hooks for a given trigger via runCallbackList.
 * @param {any} world
 * @param {number} entityId - the monster entity whose hooks to run
 * @param {'onBeforeHit'|'onHit'|'onDamaged'} hookName
 * @param {any} frame - combat frame (with heal/healAttacker/retaliate attached)
 */
function runMonsterHooks(world, entityId, hookName, frame) {
    const ni = world.get(entityId, NamedIdentity);
    const def = ni ? getMonster(ni.identity) : null;
    const hooks = def?.hooks?.[hookName];
    if (!Array.isArray(hooks) || hooks.length === 0) return;
    const ctx = new CombatCallbackContext(world, frame, { degradeFloorMemory });
    runCallbackList(hooks, ctx);
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
        try { resolveMeleeAttack(world, source, defender); } catch (e) { console.error('[combatSystem] resolveMeleeAttack failed:', e); }
    });

}

/**
 * Resolve one melee attack attempt immediately.
 * Shared by AttackIntent processing and bump-attack event handling.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} attacker
 * @param {number} defender
 */
export function resolveMeleeAttack(world, attacker, defender) {
    const source = Number(attacker || 0) | 0;
    const target = Number(defender || 0) | 0;
    if (!(source > 0) || !(target > 0)) return;
    if (!world.isAlive(target)) return;

    const atkVit = world.get(source, Vitality);
    const defVit = world.get(target, Vitality);
    if (!atkVit || !defVit) return;

    // Range gate: only allow melee from orthogonal adjacency (no diagonals, no ranged)
    const apos = world.get(source, Position);
    const dpos = world.get(target, Position);
    if (!apos || !dpos || (Math.abs((apos.x|0) - (dpos.x|0)) + Math.abs((apos.y|0) - (dpos.y|0))) !== 1) {
        // Out of range: silently consume intent without emitting a MISS far away
        // (prevents confusing "MISS" feedback when monsters are not adjacent)
        return;
    }

    // Faction hostility gate: only hostile faction pairs can deal direct melee damage.
    const af = world.get(source, Faction)?.key || '';
    const df = world.get(target, Faction)?.key || '';
    if (!areFactionsHostile(af, df)) return;

    const atkEq = world.get(source, Equipment);

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
            return;
        }
        // Deduct stamina and suppress regen this turn
        world.set(source, Stamina, { ...atkStam, stamina: have - staminaCost, regenCooldown: STAMINA_REGEN_COOLDOWN });
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
        return;
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
    const ctx = attachHelpers(world, { attacker: source, defender: target, weaponId: weaponId || 0, damage: dmg, world });
    world.emit('beforeHit', ctx);
    forEachAffix(world, source, /** @param {any} a */ (a) => {
        if (a.triggers?.includes('onBeforeHit') && a.script) {
            runScript(a.script, ScriptVerb.AffixOnBeforeHit, world, ctx);
        }
    });
    // Innate monster pre-hit behavior from monster definition hooks
    runMonsterHooks(world, source, 'onBeforeHit', ctx);
    // Recompute damage if modified
    let finalDmg = Math.max(0, Math.floor(ctx.damage));

    const hitCtx = attachHelpers(world, { attacker: source, defender: target, weaponId: ctx.weaponId || 0, damage: finalDmg, world });
    world.emit('hit', hitCtx);
    let hasVamp = false;
    // Attacker on-hit affixes (e.g., vampiric)
    forEachAffix(world, source, /** @param {any} a */ (a) => {
        if (a.triggers?.includes('onHit') && a.script) {
            runScript(a.script, ScriptVerb.AffixOnHit, world, hitCtx);
            if (a.name && a.name.toLowerCase().includes('vamp')) hasVamp = true;
        }
    });
    finalDmg = Math.max(0, Math.floor(hitCtx.damage));
    if (hasVamp) hitCtx.healAttacker(Math.max(1, Math.floor(finalDmg/3)));

    applyWeaponCoatingOnHit(world, {
        attacker: source,
        defender: target,
        weaponId,
        didHit: finalDmg > 0,
    });

    // Innate monster on-hit behavior from monster definition hooks
    runMonsterHooks(world, source, 'onHit', hitCtx);
    // Defender on-hit reactions (e.g., Thorns)
    const defCtx = attachHelpers(world, { attacker: source, defender: target, weaponId: ctx.weaponId || 0, damage: finalDmg, world });
    forEachAffix(world, target, /** @param {any} a */ (a) => {
        if (a.triggers?.includes('onHit') && a.script) {
            runScript(a.script, ScriptVerb.AffixOnHit, world, defCtx);
        }
    });

    // Route through canonical damage pipeline (handles invuln, events, death)
    if (finalDmg > 0) {
        const result = dealDamage(world, {
            target,
            amount: finalDmg,
            source,
            type: 'physical',
            cause: 'melee',
            critical: isCrit,
            bypassResist: true,
        });
        // dealDamage returns applied:false for invulnerable targets
        if (!result.applied && result.reason !== 'invulnerable') {
            world.emit?.('status', createStatusEvent({ id: target, kind: 'miss', source }));
        }
    } else {
        // Zero damage after modifiers → treat as miss/blocked
        world.emit?.('status', createStatusEvent({ id: target, kind: 'miss', source }));
    }
}

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function combatSystem(world) {
    for (const [attacker, intent] of world.query(AttackIntent)) {
        try { resolveMeleeAttack(world, attacker, intent.targetId | 0); } catch (e) { console.error('[combatSystem] resolveMeleeAttack failed:', e); }
        try { world.remove(attacker, AttackIntent); } catch {} // ECS: may not exist
    }
}
