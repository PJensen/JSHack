// rules/systems/rangedAttackSystem.js
// Processes RangedAttackIntent: validates bow, ammo, LOS, range, then resolves d20 combat.

import { RangedAttackIntent } from '../components/Intents/RangedAttackIntent.js';
import { Equipment } from '../components/Equipment.js';
import { Inventory } from '../components/Inventory.js';
import { Vitality } from '../components/Vitality.js';
import { ItemInfo } from '../components/ItemInfo.js';
import { Faction } from '../components/Faction.js';
import { Position } from '../components/Position.js';
import { NamedIdentity } from '../components/NamedIdentity.js';
import { hasLOS } from '../../shared/math/gridLOS.js';
import { buildBlocksVisionMap, blockedCallback } from '../utils/vision.js';
import { mulberry32, rngInt, rollDice, combatSeed } from '../utils/rng.js';
import { dealDamage } from '../utils/dealDamage.js';
import { resolveCombatSnapshot } from '../utils/resolveCombatSnapshot.js';
import { getAmmoHooks } from '../data/ammo.js';
import { ProjectileImpactCallbackContext } from '../data/callbacks/projectile.js';
import { runCallbackList } from '../interaction/dispatch.js';
import { areFactionsHostile } from '../utils/factionHostility.js';

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

    // Require a bow in the ranged slot
    const eq = world.get(attacker, Equipment);
    const weaponId = eq?.ranged || 0;
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

    const ammoIdentity = String(
      world.get(ammoId, NamedIdentity)?.identity
      || ammoInfo.subtype
      || 'ammo_arrows',
    ).toLowerCase();
    const ammoStyle = ammoInfo.subtype || (ammoIdentity.includes('fire') ? 'fire' : 'plain');

    const ax = apos.x | 0, ay = apos.y | 0;
    const tx = dpos.x | 0, ty = dpos.y | 0;
    const dist = Math.max(Math.abs(tx - ax), Math.abs(ty - ay));

    // LOS check
    if (!hasLOS(ax, ay, tx, ty, isBlocked)) {
      runAmmoCallbacks(world, ammoIdentity, 'onProjectileWallImpact', {
        phase: 'projectile-wall-impact',
        attacker,
        defender,
        ammoId,
        ammoIdentity,
        ammoInfo,
        style: ammoStyle,
        distance: dist,
        damage: 0,
      });
      world.emit?.('ranged:blocked', { attacker, target: defender });
      world.remove(attacker, RangedAttackIntent);
      continue;
    }

    // Range check (Chebyshev distance)
    const maxRange = weaponInfo.range || 8;
    if (dist > maxRange) {
      world.emit?.('ranged:out-of-range', { attacker, target: defender, distance: dist, range: maxRange });
      world.remove(attacker, RangedAttackIntent);
      continue;
    }

    // Faction check
    const af = world.get(attacker, Faction)?.key || '';
    const df = world.get(defender, Faction)?.key || '';
    if (!areFactionsHostile(af, df)) {
      world.remove(attacker, RangedAttackIntent);
      continue;
    }

    // d20 roll
    const atkSnapshot = resolveCombatSnapshot(world, attacker, { mode: 'ranged' });
    const defSnapshot = resolveCombatSnapshot(world, defender, { mode: 'ranged' });
    const attackBonus = atkSnapshot.attackBonus;
    const armorClass = defSnapshot.armorClass;
    const rangePenalty = Math.floor(dist / 3);

    const seed = combatSeed(world.seed, world.step, attacker, defender);
    const r = mulberry32(seed);
    const d20 = rngInt(r, 1, 20);
    const totalToHit = d20 + attackBonus - rangePenalty;
    const isCrit = d20 === 20;
    const isNat1 = d20 === 1;

    if (!isCrit && (isNat1 || totalToHit < armorClass)) {
      runAmmoCallbacks(world, ammoIdentity, 'onProjectileMiss', {
        phase: 'projectile-miss',
        attacker,
        defender,
        ammoId,
        ammoIdentity,
        ammoInfo,
        style: ammoStyle,
        distance: dist,
        damage: 0,
        d20,
        totalToHit,
        armorClass,
        critical: isCrit,
        rng: r,
      });
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
    const flatBonus = atkSnapshot.damageFlatBonus;
    let dmg = Math.max(1, damageRoll + flatBonus);

    if (isCrit) dmg = Math.max(1, dmg * 2);

    const actorImpactCtx = runAmmoCallbacks(world, ammoIdentity, 'onProjectileActorImpact', {
      phase: 'projectile-actor-impact',
      attacker,
      defender,
      ammoId,
      ammoIdentity,
      ammoInfo,
      style: ammoStyle,
      distance: dist,
      damage: dmg,
      d20,
      totalToHit,
      armorClass,
      critical: isCrit,
      rng: r,
    });
    if (actorImpactCtx) {
      dmg = Math.max(0, actorImpactCtx.damage);
    }

    // Apply damage through canonical pipeline
    const result = dealDamage(world, {
      target: defender,
      amount: dmg,
      source: attacker,
      type: 'pierce',
      cause: 'ranged',
      critical: isCrit,
      bypassResist: true,
    });

    if (actorImpactCtx) {
      actorImpactCtx.resolveDamageResult(result);
      actorImpactCtx.flushResolved();
    }

    // Consume ammo
    consumeAmmo(world, attacker, ammoId, ammoInfo);

    world.emit?.('ranged:shot', { attacker, target: defender, hit: true, damage: dmg, style: ammoStyle });
    world.remove(attacker, RangedAttackIntent);
  }
}

/**
 * @param {any} world
 * @param {string} ammoIdentity
 * @param {string} hookName
 * @param {any} frame
 * @returns {ProjectileImpactCallbackContext|null}
 */
function runAmmoCallbacks(world, ammoIdentity, hookName, frame) {
  const hooks = getAmmoHooks(ammoIdentity, hookName);
  if (!Array.isArray(hooks) || hooks.length === 0) return null;
  const ctx = new ProjectileImpactCallbackContext(world, frame);
  runCallbackList(hooks, ctx);
  return ctx;
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
