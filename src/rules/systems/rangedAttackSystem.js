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
import { Player } from '../components/Player.js';
import { hasLOS } from '../../shared/math/gridLOS.js';
import { buildBlocksVisionMap, blockedCallback } from '../utils/vision.js';
import { mulberry32, rngInt, rollDice, combatSeed, pct } from '../utils/rng.js';
import { dealDamage } from '../utils/dealDamage.js';
import { addToInventory, inventoryItems, removeFromInventory } from '../utils/inventoryFacade.js';
import { resolveCombatSnapshot } from '../utils/resolveCombatSnapshot.js';
import { areFactionsHostile } from '../utils/factionHostility.js';
import { createStatusEvent } from '../../shared/events/statusEvent.js';
import { runAmmoScripts } from '../utils/projectileScriptDispatch.js';
import { ensureEquippedAffixTopology } from '../utils/affixTopology.js';
import { buildProcContext, applyPendingDamageProcPhase, applyReactionProcPhase } from '../utils/procPhases.js';
import { getAmmoDef } from '../data/ammo.js';
import { createItemById } from '../utils/itemFactory.js';
import { breakStealthOnOffense } from '../utils/stealthAmbush.js';
import { isTargetHiddenByInvisibility } from '../utils/spellTargeting.js';

const RANGED_PROJECTILE_SPEED = 18;
const RANGED_PROJECTILE_MIN_DURATION = 0.06;
const RANGED_PROJECTILE_MAX_DURATION = 0.4;
const EMBEDDED_ARROW_RECOVERY_CHANCE = 0.22;
const BLUNT_ARROW_SPEED_MULT = 0.9;
const PIERCING_ARROW_SPEED_MULT = 1.1;

function computeProjectileDelay(from, to, speed, minDuration, maxDuration) {
  const dx = Number(to?.x || 0) - Number(from?.x || 0);
  const dy = Number(to?.y || 0) - Number(from?.y || 0);
  const dist = Math.hypot(dx, dy);
  if (!(dist > 0) || !(speed > 0)) return Number(minDuration) || 0;
  const raw = dist / speed;
  return Math.max(Number(minDuration) || 0, Math.min(Number(maxDuration) || raw, raw));
}

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
    ensureEquippedAffixTopology(world, attacker);
    ensureEquippedAffixTopology(world, defender);
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
    if (!ammoId) {
      for (const itemId of inventoryItems(world, attacker)) {
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
    const projectileSpeed = RANGED_PROJECTILE_SPEED * (
      ammoStyle === 'blunt'
        ? BLUNT_ARROW_SPEED_MULT
        : (ammoStyle === 'piercing' ? PIERCING_ARROW_SPEED_MULT : 1)
    );

    const ax = apos.x | 0, ay = apos.y | 0;
    const tx = dpos.x | 0, ty = dpos.y | 0;
    const dist = Math.max(Math.abs(tx - ax), Math.abs(ty - ay));

    // LOS check
    if (!hasLOS(ax, ay, tx, ty, isBlocked)) {
      runAmmoScripts(world, ammoIdentity, 'onProjectileWallImpact', {
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

    if (isTargetHiddenByInvisibility(world, {
      sourceId: attacker,
      targetId: defender,
      sourcePos: apos,
      targetPos: dpos,
      allowAdjacentInvisibleTarget: true,
      hostileOnly: true,
    })) {
      world.emit?.('ranged:blocked', { attacker, target: defender, reason: 'invisible' });
      world.remove(attacker, RangedAttackIntent);
      continue;
    }

    // d20 roll
    const atkSnapshot = resolveCombatSnapshot(world, attacker, { mode: 'ranged' });
    const defSnapshot = resolveCombatSnapshot(world, defender, { mode: 'ranged' });
    breakStealthOnOffense(world, attacker, { reason: 'attack', mode: 'ranged', targetId: defender });
    const attackBonus = atkSnapshot.attackBonus;
    const armorClass = defSnapshot.armorClass;
    const rangePenalty = Math.floor(dist / 3);
    let armorPenetration = Math.max(0, Number(atkSnapshot.physicalPenetration || 0))
      + Math.max(0, Number(atkSnapshot.piercePenetration || 0));

    const seed = combatSeed(world.seed, world.step, attacker, defender);
    const r = mulberry32(seed);
    const d20 = rngInt(r, 1, 20);
    const totalToHit = d20 + attackBonus - rangePenalty;
    let isCrit = d20 === 20;
    const isNat1 = d20 === 1;

    if (!isCrit && (isNat1 || totalToHit < armorClass)) {
      runAmmoScripts(world, ammoIdentity, 'onProjectileMiss', {
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
      world.emit?.('status', createStatusEvent({ id: defender, kind: 'miss', source: attacker }));
      // Consume ammo even on miss
      consumeAmmo(world, attacker, ammoId, ammoInfo);
      world.emit?.('ranged:shot', { attacker, target: defender, hit: false, style: ammoStyle, projectileSpeed });
      world.remove(attacker, RangedAttackIntent);
      continue;
    }

    // Roll damage
    const baseDice = weaponInfo.damageDice || '1d6';
    const damageRoll = rollDice(baseDice, r);
    const flatBonus = atkSnapshot.damageFlatBonus;
    let dmg = Math.max(1, damageRoll + flatBonus);

    // Secondary crit check: critChanceDerived (decimal) + luck (integer %)
    if (!isCrit) {
      const critPct = (atkSnapshot.critChance * 100) + (atkSnapshot.luck || 0);
      if (critPct > 0) isCrit = pct(r, critPct);
    }
    const critMult = 2 + (atkSnapshot.critMult || 0);
    if (isCrit) dmg = Math.max(1, Math.floor(dmg * critMult));
    const procScratch = {};
    let damageType = 'pierce';
    dmg = applyPendingDamageProcPhase(world, attacker, buildProcContext('onBeforeHit', {
      source: attacker,
      target: defender,
      item: weaponId,
      damage: dmg,
      damageType,
      crit: isCrit,
      scratch: procScratch,
      tags: ['ranged', 'projectile'],
    }), () => r(), { excludeSlots: ['weapon', 'offhand'] });

    const actorImpactCtx = runAmmoScripts(world, ammoIdentity, 'onProjectileActorImpact', {
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
      damageType,
      armorPenetration,
      rng: r,
    });
    if (actorImpactCtx) {
      dmg = Math.max(0, actorImpactCtx.damage);
      damageType = actorImpactCtx.damageType;
      armorPenetration = Math.max(0, actorImpactCtx.armorPenetration);
    }
    dmg = applyPendingDamageProcPhase(world, attacker, buildProcContext('onHit', {
      source: attacker,
      target: defender,
      item: weaponId,
      damage: dmg,
      damageType,
      crit: isCrit,
      scratch: procScratch,
      tags: ['ranged', 'projectile'],
    }), () => r(), { excludeSlots: ['weapon', 'offhand'] });
    applyReactionProcPhase(world, defender, buildProcContext('onHit', {
      source: attacker,
      target: defender,
      item: weaponId,
      damage: dmg,
      damageType,
      crit: isCrit,
      scratch: procScratch,
      tags: ['ranged', 'projectile'],
    }), { excludeSlots: ['weapon'] });

    // Apply damage through canonical pipeline
    const result = dealDamage(world, {
      target: defender,
      amount: dmg,
      source: attacker,
      type: damageType,
      cause: 'ranged',
      critical: isCrit,
      armorPenetration,
      projectileDelay: computeProjectileDelay(
        { x: ax, y: ay },
        { x: tx, y: ty },
        projectileSpeed,
        RANGED_PROJECTILE_MIN_DURATION,
        RANGED_PROJECTILE_MAX_DURATION,
      ),
    });

    if (actorImpactCtx) {
      actorImpactCtx.resolveDamageResult(result);
      actorImpactCtx.flushResolved();
    }

    // Consume ammo
    consumeAmmo(world, attacker, ammoId, ammoInfo);
    tryRecoverEmbeddedArrow(world, {
      attacker,
      defender,
      ammoIdentity,
      rng: r,
    });

    world.emit?.('ranged:shot', { attacker, target: defender, hit: true, damage: dmg, style: ammoStyle, projectileSpeed });
    world.remove(attacker, RangedAttackIntent);
  }
}

/** Decrement ammo count; destroy entity if last arrow. */
function consumeAmmo(world, owner, ammoId, ammoInfo) {
  if (ammoInfo.count > 1) {
    ammoInfo.count -= 1;
  } else {
    // Last arrow: remove from inventory, clear equip slot, destroy entity
    removeFromInventory(world, owner, ammoId);
    const eq = world.get(owner, Equipment);
    if (eq && eq.ammo === ammoId) eq.ammo = null;
    world.destroy(ammoId);
  }
}

function normalizeRecoverableAmmoIdentity(ammoIdentity) {
  const canonical = String(getAmmoDef(ammoIdentity)?.id || '').trim();
  if (canonical) return canonical;
  const normalized = String(ammoIdentity || '').trim().toLowerCase();
  if (normalized.startsWith('ammo_')) return normalized;
  return '';
}

function resolveAmmoEntityIdentity(world, ammoId) {
  if (!(ammoId > 0) || !world.isAlive(ammoId)) return '';
  const identity = String(
    world.get(ammoId, NamedIdentity)?.identity
    || world.get(ammoId, ItemInfo)?.subtype
    || '',
  ).trim().toLowerCase();
  return normalizeRecoverableAmmoIdentity(identity);
}

function tryRecoverEmbeddedArrow(world, { attacker, defender, ammoIdentity, rng }) {
  if (!(defender > 0) || !world.isAlive(defender)) return;
  if (world.has(defender, Player)) return;
  if (!world.has(defender, Inventory)) return;
  if (typeof rng !== 'function' || rng() >= EMBEDDED_ARROW_RECOVERY_CHANCE) return;

  const recoverIdentity = normalizeRecoverableAmmoIdentity(ammoIdentity);
  if (!recoverIdentity) return;

  const equippedAmmoId = Number(world.get(defender, Equipment)?.ammo || 0) | 0;
  if (equippedAmmoId > 0 && resolveAmmoEntityIdentity(world, equippedAmmoId) === recoverIdentity) {
    world.mutate(equippedAmmoId, ItemInfo, (rec) => {
      rec.count = Math.max(1, Number(rec.count || 0) | 0) + 1;
    });
    return;
  }

  const recoveredId = createItemById(world, recoverIdentity, { count: 1 });
  if (!(recoveredId > 0)) return;
  if (!addToInventory(world, defender, recoveredId, { silent: true, mergeCompatible: true })) {
    world.destroy(recoveredId);
    return;
  }
}
