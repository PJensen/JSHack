import { COMBAT_PACK, combatSoundId } from "./combatPack.js";
import {
  fallbackFamilyForDamageType,
  resolveCombatFamily,
  resolveDeflectAction,
  resolveGoreAction,
  resolveImpactAction,
  resolveWhooshAction,
} from "./combatSoundResolver.js";

const WEAPON_FAMILIES = Object.freeze(
  Object.keys(COMBAT_PACK).filter((family) => family !== "gore"),
);

const WEAPON_ACTIONS = Object.freeze([
  "equip",
  "unequip",
  "whoosh_short",
  "whoosh_long",
  "impact_soft",
  "impact_hard_body",
  "impact_hard",
  "impact_hard_tail",
  "deflect_body",
  "deflect",
  "deflect_tail",
  "finisher",
]);

const GORE_DAMAGE_TYPES = Object.freeze(["blunt", "slash", "pierce"]);

function layer(id, opts = {}) {
  return id ? { id, delayMs: 0, volume: 1, priority: 1, ...opts } : null;
}

function compact(layers) {
  return layers.filter(Boolean);
}

export function familyForCombatItem(info, fallback = null) {
  return resolveCombatFamily(info) || fallback;
}

export function planWeaponReady({ itemInfo, action = "equip" } = {}) {
  const family = familyForCombatItem(itemInfo);
  return family ? compact([layer(combatSoundId(family, action), { volume: 1.12 })]) : [];
}

export function planWeaponWhoosh({ itemInfo, offhand = false, fallbackFamily = "dagger" } = {}) {
  const family = familyForCombatItem(itemInfo, fallbackFamily);
  const action = resolveWhooshAction(family, offhand);
  return compact([
    layer(combatSoundId(family, action), {
      volume: offhand ? 0.55 : 0.74,
      rate: offhand ? 1.08 : 1,
    }),
  ]);
}

export function planWeaponDrop({ itemInfo } = {}) {
  const family = familyForCombatItem(itemInfo);
  return family ? compact([layer(combatSoundId(family, "impact_soft"), { volume: 0.84 })]) : [];
}

export function planWeaponDeflect({ itemInfo, fallbackFamily = "sword_small", hard = true, volume = 0.9 } = {}) {
  const family = familyForCombatItem(itemInfo, fallbackFamily);
  return compact([
    layer(combatSoundId(family, resolveDeflectAction({ body: true, hard })), { volume }),
    layer(combatSoundId(family, resolveDeflectAction({ hard })), { delayMs: 10, volume: volume * 0.78 }),
    layer(combatSoundId(family, resolveDeflectAction({ tail: true, hard })), {
      delayMs: 38,
      volume: volume * 0.58,
      priority: 0,
    }),
  ]);
}

export function planShieldBlock({ shieldInfo, broken = false } = {}) {
  const family = familyForCombatItem(shieldInfo, "shield_metal");
  const impact = broken ? "impact_hard" : "impact_soft";
  return compact([
    layer(combatSoundId(family, "deflect"), { volume: broken ? 1.08 : 0.92 }),
    layer(combatSoundId(family, impact), { delayMs: 18, volume: broken ? 0.72 : 0.48 }),
    broken ? layer(combatSoundId(family, "finisher"), { delayMs: 44, volume: 0.65 }) : null,
  ]);
}

export function planWeaponImpact({
  itemInfo,
  type,
  amount = 0,
  critical = false,
  targetKind = "",
  sizeClass = "",
} = {}) {
  const heavy = critical || Number(amount || 0) >= 8;
  const family = familyForCombatItem(itemInfo, fallbackFamilyForDamageType(type, heavy));
  const weaponLayers = [];
  if (family) {
    const action = resolveImpactAction({ family, amount, critical, targetKind });
    if (action === "impact_hard") {
      weaponLayers.push(
        layer(combatSoundId(family, "impact_hard_body"), { volume: critical ? 1.12 : 0.92 }),
        layer(combatSoundId(family, "impact_hard"), { delayMs: 12, volume: 0.72 }),
        layer(combatSoundId(family, "impact_hard_tail"), { delayMs: 45, volume: 0.58, priority: 0 }),
      );
    } else {
      weaponLayers.push(layer(combatSoundId(family, "impact_soft"), { volume: critical ? 1.02 : 0.84 }));
    }
  }

  return compact([
    ...weaponLayers,
    layer(combatSoundId("gore", resolveGoreAction({ damageType: type, amount, critical, sizeClass })), {
      delayMs: 18,
      volume: critical ? 0.82 : 0.62,
    }),
  ]);
}

export function planMeleeDeath({
  itemInfo,
  damageType,
  amount = 0,
  critical = false,
  sizeClass = "",
} = {}) {
  const family = familyForCombatItem(itemInfo);
  return compact([
    family ? layer(combatSoundId(family, "finisher"), {
      delayMs: 30,
      volume: critical ? 0.95 : 0.72,
    }) : null,
    layer(combatSoundId("gore", resolveGoreAction({ damageType, amount, critical, sizeClass })), {
      delayMs: 48,
      volume: critical ? 0.92 : 0.72,
    }),
  ]);
}

export function allAdapterCombatSoundIds() {
  const ids = new Set();
  for (const family of WEAPON_FAMILIES) {
    for (const action of WEAPON_ACTIONS) {
      const id = combatSoundId(family, action);
      if (id) ids.add(id);
    }
  }
  for (const type of GORE_DAMAGE_TYPES) {
    for (const amount of [1, 6, 12]) {
      ids.add(combatSoundId("gore", resolveGoreAction({ damageType: type, amount })));
    }
  }
  return ids;
}
