import { ItemInfo } from '../components/ItemInfo.js';
import { combatSeed, mulberry32, rngInt } from '../utils/rng.js';
import { upsertTimedEffect } from '../utils/effectSemantics.js';
import { ensureActiveEffects } from '../utils/effects.js';

export const WEAPON_COATING_DEFS = Object.freeze({
  poison: Object.freeze({
    // Higher proc rate to make applied poison meaningfully tactical while still
    // allowing occasional non-proc hits for variability.
    chancePct: 75,
    consumeOnHit: true,
    seedSalt: 0xc0470001,
    emitEvent: 'proc:poisoned',
    effect: Object.freeze({ key: 'poison', turnsLeft: 4, potency: 2, stacks: 1 }),
  }),
});

function upsertEffect(world, entityId, effect) {
  const ae = ensureActiveEffects(world, entityId);
  if (ae) {
    upsertTimedEffect(ae.effects, { stacks: 1, ...effect });
  }
}

export function applyWeaponCoatingOnHit(world, ctx) {
  const attacker = Number(ctx?.attacker || 0) | 0;
  const defender = Number(ctx?.defender || 0) | 0;
  const weaponId = Number(ctx?.weaponId || 0) | 0;
  const didHit = Boolean(ctx?.didHit);
  if (!(attacker > 0) || !(defender > 0) || !(weaponId > 0) || !didHit) {
    return { attempted: false, procced: false, kind: '', chargesBefore: 0, chargesAfter: 0 };
  }

  const weaponInfo = world.get(weaponId, ItemInfo);
  const coating = weaponInfo?.coating;
  const kind = String(coating?.kind || '').toLowerCase();
  const chargesBefore = Math.max(0, Number(coating?.charges || 0) | 0);
  if (!weaponInfo || !kind || chargesBefore <= 0) {
    return { attempted: false, procced: false, kind, chargesBefore, chargesAfter: chargesBefore };
  }

  const def = WEAPON_COATING_DEFS[kind];
  if (!def) {
    return { attempted: false, procced: false, kind, chargesBefore, chargesAfter: chargesBefore };
  }

  const chancePct = Math.max(0, Math.min(100, Number(def.chancePct || 0) | 0));
  if (chancePct <= 0) {
    return { attempted: true, procced: false, kind, chargesBefore, chargesAfter: chargesBefore };
  }

  let chargesAfter = chargesBefore;
  if (def.consumeOnHit) {
    chargesAfter = Math.max(0, chargesBefore - 1);
    if (chargesAfter > 0) {
      weaponInfo.coating = { ...coating, charges: chargesAfter };
    } else {
      delete weaponInfo.coating;
    }
  }

  const procRng = mulberry32(combatSeed(world.seed, world.step, attacker, defender, Number(def.seedSalt || 0) | 0));
  const didProc = rngInt(procRng, 1, 100) <= chancePct;
  if (!didProc) {
    return { attempted: true, procced: false, kind, chargesBefore, chargesAfter };
  }

  if (def.effect) upsertEffect(world, defender, { ...def.effect });

  if (def.emitEvent) {
    world.emit?.(String(def.emitEvent), { actor: attacker, target: defender });
  }

  return { attempted: true, procced: true, kind, chargesBefore, chargesAfter };
}
