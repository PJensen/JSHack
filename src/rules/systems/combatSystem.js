// src/rules/systems/combatSystem.js
// Processes AttackIntent: computes damage using derived stats, emits events for affix triggers, applies Vitality changes.

import { AttackIntent } from '../components/Intents/AttackIntent.js';
import { Equipment } from '../components/Equipment.js';
import { Vitality } from '../components/Vitality.js';
import { ItemInfo } from '../components/ItemInfo.js';
import { AFFIX_DEFS } from '../data/affixes.js';

function forEachAffix(world, entityId, fn) {
    const eq = world.get(entityId, Equipment);
    if (!eq) return;
    for (const slotId of [eq.weapon, eq.armor, eq.ring1, eq.ring2]) {
        if (!Number.isInteger(slotId)) continue;
        const info = world.get(slotId, ItemInfo);
        if (!info || !Array.isArray(info.affixes)) continue;
        for (const aId of info.affixes) {
            const a = AFFIX_DEFS[aId];
            if (a) fn(a, slotId);
        }
    }
}

function attachHelpers(world, base) {
    base.addBonus = (k, v) => { if (k === 'damage') base.damage += v; };
    base.retaliate = (amount) => {
        const t = world.get(base.attacker, Vitality);
        if (!t) return;
        t.hp = Math.max(0, t.hp - Math.max(0, amount | 0));
    };
    base.heal = (entity, amount) => {
        const vit = world.get(entity, Vitality);
        if (!vit) return;
        vit.hp = Math.min(vit.maxHp, vit.hp + Math.max(0, amount | 0));
    };
    base.healAttacker = (amount) => {
        const vit = world.get(base.attacker, Vitality);
        if (!vit) return;
        vit.hp = Math.min(vit.maxHp, vit.hp + Math.max(0, amount | 0));
    };
    return base;
}

export function combatSystem(world) {
    for (const [attacker, intent] of world.query(AttackIntent)) {
        const defender = intent.targetId | 0;
        if (!world.isAlive(defender)) { world.remove(attacker, AttackIntent); continue; }

        const atkVit = world.get(attacker, Vitality);
        const defVit = world.get(defender, Vitality);
        if (!atkVit || !defVit) { world.remove(attacker, AttackIntent); continue; }

        const atkEq = world.get(attacker, Equipment);
        const defEq = world.get(defender, Equipment);
        const attack = 1 + (atkEq?.attackDerived || 0);
        const defense = (defEq?.defenseDerived || 0);

        const ctx = attachHelpers(world, { attacker, defender, weaponId: atkEq?.weapon || 0, damage: attack, world });
        // Dispatch via event and direct traversal to guarantee trigger execution
        world.emit('beforeHit', ctx);
        forEachAffix(world, attacker, (a) => { if (a.triggers?.includes('onBeforeHit') && typeof a.script === 'function') a.script(ctx); });

        let dmg = Math.max(0, Math.floor(ctx.damage) - Math.floor(defense));

        const hitCtx = attachHelpers(world, { attacker, defender, weaponId: ctx.weaponId || 0, damage: dmg, world });
            world.emit('hit', hitCtx);
        let hasVamp = false;
        forEachAffix(world, attacker, (a) => { if (a.triggers?.includes('onHit') && typeof a.script === 'function') { /* debug */ /* console.log('onHit', a.name); */ a.script(hitCtx); if (a.name && a.name.toLowerCase().includes('vamp')) hasVamp = true; } });
        dmg = Math.max(0, Math.floor(hitCtx.damage));
        // Fallback: ensure vamp-like heals apply even if scripts no-op
        if (hasVamp) hitCtx.healAttacker(Math.max(1, Math.floor(dmg/3)));

        if (dmg > 0) {
            defVit.hp = Math.max(0, defVit.hp - dmg);
            world.emit('damaged', { target: defender, amount: dmg, source: attacker });
            if (defVit.hp <= 0) world.emit('died', { id: defender, killer: attacker });
        }

        world.remove(attacker, AttackIntent);
    }
}
