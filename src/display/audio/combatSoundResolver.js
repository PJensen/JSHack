import { combatSoundId } from "./combatPack.js";

const LONG_WHOOSH_FAMILIES = new Set([
  "axe_large",
  "hammer_large",
  "spear",
  "sword_large",
  "wooden_staff",
]);

const WOOD_MATERIALS = new Set(["wood", "oak", "bone"]);

function textOf(info) {
  return `${info?.id || ""} ${info?.identity || ""} ${info?.name || ""} ${info?.subtype || ""}`.toLowerCase();
}

function familyFromProfile(profile) {
  if (typeof profile !== "string") return null;
  const key = profile.trim().toLowerCase();
  if (key === "staff") return "wooden_staff";
  if (key === "dagger") return "dagger";
  if (key === "spear") return "spear";
  if (key === "axe") return "axe_large";
  if (key === "mace" || key === "morningstar") return "mace";
  if (key === "sword") return "sword_small";
  return null;
}

export function resolveCombatFamily(info) {
  if (!info) return null;
  const slot = String(info.slot || "").toLowerCase();
  const type = String(info.type || "").toLowerCase();
  const material = String(info.material || "").toLowerCase();
  const text = textOf(info);

  if (slot === "shield" || type === "shield" || text.includes("shield") || text.includes("buckler") || text.includes("pavise") || text.includes("aegis")) {
    return WOOD_MATERIALS.has(material) || text.includes("wood")
      ? "shield_wood"
      : "shield_metal";
  }

  if (slot !== "weapon" && !info.damageDice) return null;
  const profileFamily = familyFromProfile(info.weaponVfxProfile);
  if (profileFamily) return profileFamily;
  if (text.includes("staff") || text.includes("quarterstaff")) return "wooden_staff";
  if (text.includes("dagger") || text.includes("shiv") || text.includes("stiletto") || text.includes("kris") || text.includes("athame") || text.includes("knife") || text.includes("fang")) return "dagger";
  if (text.includes("spear") || text.includes("pike") || text.includes("lance") || text.includes("scythe")) return "spear";
  if (text.includes("flail")) return "flail";
  if (text.includes("hammer") || text.includes("maul")) return "hammer_large";
  if (text.includes("mace") || text.includes("morningstar") || text.includes("debtbringer")) return "mace";
  if (text.includes("axe") || text.includes("cleaver")) return info.twoHanded || Number(info.weight || 0) >= 3 ? "axe_large" : "axe_small";
  if (text.includes("greatsword") || text.includes("longsword") || text.includes("reaver") || text.includes("warblade") || text.includes("blade") || text.includes("sword") || text.includes("edge") || text.includes("flametongue")) {
    return info.twoHanded || Number(info.weight || 0) >= 2.4 || text.includes("great") || text.includes("long")
      ? "sword_large"
      : "sword_small";
  }

  const damageType = String(info.damageType || "").toLowerCase();
  if (damageType === "pierce") return "spear";
  if (damageType === "blunt") return Number(info.weight || 0) >= 3 ? "hammer_large" : "mace";
  if (damageType === "slash") return info.twoHanded ? "sword_large" : "sword_small";
  return null;
}

export function resolveWhooshAction(family, offhand = false) {
  if (offhand) return "whoosh_short";
  return LONG_WHOOSH_FAMILIES.has(family) ? "whoosh_long" : "whoosh_short";
}

export function resolveImpactAction(payload = {}) {
  const family = String(payload.family || "");
  if (family.startsWith("shield_")) {
    return payload.critical || Number(payload.amount || 0) >= 6 ? "impact_hard" : "impact_soft";
  }
  const kind = String(payload.targetKind || "").toLowerCase();
  const hardTarget = kind.includes("skeleton") || kind.includes("construct") || kind.includes("golem");
  if (hardTarget || payload.critical || Number(payload.amount || 0) >= 8) return "impact_hard";
  return "impact_soft";
}

export function resolveDeflectAction(payload = {}) {
  const amount = Number(payload.amount || 0);
  if (payload.body) return "deflect_body";
  if (payload.tail) return "deflect_tail";
  if (payload.hard || payload.critical || amount >= 6) return "deflect";
  return "deflect";
}

export function resolveGoreAction(payload = {}) {
  const type = String(payload.damageType || payload.type || "").toLowerCase();
  const amount = Number(payload.amount || 0);
  const sizeClass = String(payload.sizeClass || "").toUpperCase();
  const size = payload.critical || amount >= 12 || sizeClass === "L" || sizeClass === "XL"
    ? "large"
    : amount >= 5 || sizeClass === "M"
      ? "medium"
      : "small";
  const mode = type === "pierce" ? "stab" : type === "slash" ? "slice" : "impact";
  return `${mode}_${size}`;
}

export function fallbackFamilyForDamageType(type, heavy = false) {
  const damageType = String(type || "").toLowerCase();
  if (damageType === "pierce") return heavy ? "spear" : "dagger";
  if (damageType === "slash") return heavy ? "sword_large" : "sword_small";
  if (damageType === "blunt") return heavy ? "hammer_large" : "mace";
  return null;
}

export function resolveCombatSoundId(info, action) {
  const family = resolveCombatFamily(info);
  return family ? combatSoundId(family, action) : null;
}

export function resolveCombatSoundPlan({ itemInfo, action, offhand = false, payload = {} } = {}) {
  const family = resolveCombatFamily(itemInfo);
  if (!family) return null;
  const resolvedAction = action === "whoosh" ? resolveWhooshAction(family, offhand) : action;
  const id = combatSoundId(family, resolvedAction);
  return id ? { id, family, action: resolvedAction, payload } : null;
}
