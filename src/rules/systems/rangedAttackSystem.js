// rules/systems/rangedAttackSystem.js
// Processes RangedAttackIntent: validates bow, ammo, LOS, range, then resolves d20 combat.

import { RangedAttackIntent } from '../components/Intents/RangedAttackIntent.js';
import { Equipment } from '../components/Equipment.js';
import { Inventory } from '../components/Inventory.js';
import { Vitality } from '../components/Vitality.js';
import { ItemInfo } from '../components/ItemInfo.js';
import { Faction } from '../components/Faction.js';
import { Position } from '../components/Position.js';
import { hasLOS } from '../../shared/math/gridLOS.js';
import { buildBlocksVisionMap, blockedCallback } from '../utils/vision.js';
import { ActiveEffects } from '../components/ActiveEffects.js';
import { mulberry32, rngInt } from '../../lib/ecs-js/rng.js';

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function rangedAttackSystem(world) {
  const intents = world.query(RangedAttackIntent);
  if (intents.count({ cheap: true }) === 0) return;

  // Build blocking map once per tick when needed
  const blocked = buildBlocksVisionMap(world);
  const isBlocked = blockedCallback(blocked);

  for (const [attacker, intent] of intents) {
    const defender = intent.targetId | 0;
    if (!world.isAlive(defender)) { world.remove(attacker, RangedAttackIntent); continue; }

    const apos = world.get(attacker, Position);
    const dpos = world.get(defender, Position);
    if (!apos || !dpos) { world.remove(attacker, RangedAttackIntent); continue; }

    const atkVit = world.get(attacker, Vitality);
    const defVit = world.get(defender, Vitality);
    if (!atkVit || !defVit) { world.remove(attacker, RangedAttackIntent); continue; }

    // Require a bow-type weapon
    const eq = world.get(attacker, Equipment);
    const weaponId = eq?.weapon || 0;
    const weaponInfo = weaponId ? world.get(weaponId, ItemInfo) : null;
    if (!weaponInfo || weaponInfo.subtype !== 'bow') {
      world.remove(attacker, RangedAttackIntent);
      continue;
    }

    // Find ammo: prefer equipped ammo slot, fall back to first ammo in inventory
    const inv = world.get(attacker, Inventory);
    let ammoId = 0;
    let ammoInfo = null;
    const equippedAmmo = eq?.ammo || 0;
    if (equippedAmmo && world.isAlive(equippedAmmo)) {
      const info = world.get(equippedAmmo, ItemInfo);
      if (info && info.type === 'ammo') { ammoId = equippedAmmo; ammoInfo = info; }
    }
    if (!ammoId && inv && Array.isArray(inv.items)) {
      for (const itemId of inv.items) {
        const info = world.get(itemId, ItemInfo);
        if (info && info.type === 'ammo') { ammoId = itemId; ammoInfo = info; break; }
      }
    }
    if (!ammoId || !ammoInfo) {
      world.emit?.('ranged:no-ammo', { attacker });
      world.remove(attacker, RangedAttackIntent);
      continue;
    }

    // LOS check
    const ax = apos.x | 0, ay = apos.y | 0;
    const tx = dpos.x | 0, ty = dpos.y | 0;
    if (!hasLOS(ax, ay, tx, ty, isBlocked)) {
      world.emit?.('ranged:blocked', { attacker, target: defender });
      world.remove(attacker, RangedAttackIntent);
      continue;
    }

    // Range check (Chebyshev distance)
    const dist = Math.max(Math.abs(tx - ax), Math.abs(ty - ay));
    const maxRange = weaponInfo.range || 8;
    if (dist > maxRange) {
      world.emit?.('ranged:out-of-range', { attacker, target: defender, distance: dist, range: maxRange });
      world.remove(attacker, RangedAttackIntent);
      continue;
    }

    // Faction check
    const af = world.get(attacker, Faction)?.key || '';
    const df = world.get(defender, Faction)?.key || '';
    if (af && df && af === df) {
      world.remove(attacker, RangedAttackIntent);
      continue;
    }

    // d20 roll
    const attackBonus = 1 + (eq?.attackDerived || 0);
    const defEq = world.get(defender, Equipment);
    const armorClass = 10 + (defEq?.defenseDerived || 0);
    const rangePenalty = Math.floor(dist / 3);

    const seed = (world.seed >>> 0) ^ ((world.step | 0) * 0x9e3779b9 >>> 0) ^ (attacker >>> 0) ^ ((defender << 16) >>> 0);
    const r = mulberry32(seed >>> 0);
    const d20 = rngInt(r, 1, 20);
    const totalToHit = d20 + attackBonus - rangePenalty;
    const isCrit = d20 === 20;
    const isNat1 = d20 === 1;

    // Ammo style (for VFX and bonus effects)
    const ammoStyle = ammoInfo.subtype || 'plain';

    if (!isCrit && (isNat1 || totalToHit < armorClass)) {
      world.emit?.('status', { id: defender, kind: 'miss', text: 'MISS', source: attacker });
      // Consume ammo even on miss
      consumeAmmo(world, attacker, ammoId, ammoInfo);
      world.emit?.('ranged:shot', { attacker, target: defender, hit: false, style: ammoStyle });
      world.remove(attacker, RangedAttackIntent);
      continue;
    }

    // Roll damage
    const baseDice = weaponInfo.damageDice || '1d6';
    const damageRoll = rollDice(baseDice, r);
    const flatBonus = Math.max(0, Math.floor((eq?.attackDerived || 0) / 2));
    let dmg = Math.max(1, damageRoll + flatBonus);

    // Ammo bonus damage (fire arrows: +1d4)
    if (ammoStyle === 'fire') dmg += rollDice('1d4', r);

    if (isCrit) dmg = Math.max(1, dmg * 2);

    // Apply damage
    defVit.hp = Math.max(0, defVit.hp - dmg);
    world.emit?.('damaged', { target: defender, amount: dmg, source: attacker, critical: isCrit });
    if (defVit.hp <= 0) world.emit?.('died', { id: defender, killer: attacker });

    // Fire arrows apply burning (3 turns, 2 dmg/turn)
    if (ammoStyle === 'fire' && defVit.hp > 0) {
      const ae = world.get(defender, ActiveEffects);
      const effect = { key: 'burn', turnsLeft: 3, potency: 2, stacks: 1 };
      if (ae && Array.isArray(ae.effects)) {
        const existing = ae.effects.find(e => e.key === 'burn');
        if (existing) {
          existing.stacks = (existing.stacks || 1) + 1;
          existing.turnsLeft = Math.max(existing.turnsLeft, 3);
        } else {
          ae.effects.push(effect);
        }
      } else {
        try { world.add(defender, ActiveEffects, { effects: [effect] }); } catch {}
      }
      world.emit?.('proc:burning', { actor: attacker, target: defender });
    }

    // Consume ammo
    consumeAmmo(world, attacker, ammoId, ammoInfo);

    world.emit?.('ranged:shot', { attacker, target: defender, hit: true, damage: dmg, style: ammoStyle });
    world.remove(attacker, RangedAttackIntent);
  }
}

/** Decrement ammo count; destroy entity if last arrow. */
function consumeAmmo(world, owner, ammoId, ammoInfo) {
  if (ammoInfo.count > 1) {
    ammoInfo.count -= 1;
  } else {
    // Last arrow: remove from inventory, clear equip slot, destroy entity
    const inv = world.get(owner, Inventory);
    if (inv && Array.isArray(inv.items)) {
      const idx = inv.items.indexOf(ammoId);
      if (idx !== -1) inv.items.splice(idx, 1);
    }
    const eq = world.get(owner, Equipment);
    if (eq && eq.ammo === ammoId) eq.ammo = null;
    world.destroy(ammoId);
  }
}

/** @param {string} spec @param {() => number} rng */
function rollDice(spec, rng) {
  const m = /^\s*(\d+)d(\d+)\s*$/i.exec(String(spec || ''));
  if (!m) return 1;
  const count = Math.max(1, parseInt(m[1], 10) | 0);
  const sides = Math.max(2, parseInt(m[2], 10) | 0);
  let sum = 0;
  for (let i = 0; i < count; i++) sum += rngInt(rng, 1, sides);
  return sum;
}
