export const WEAPON_FAMILIES = Object.freeze({
  axeLarge: "axe_large",
  axeSmall: "axe_small",
  dagger: "dagger",
  flail: "flail",
  hammerLarge: "hammer_large",
  mace: "mace",
  shieldMetal: "shield_metal",
  shieldWood: "shield_wood",
  spear: "spear",
  swordLarge: "sword_large",
  swordSmall: "sword_small",
  woodenStaff: "wooden_staff",
});

const WOOD_MATERIALS = new Set(["wood", "oak", "bone"]);

function textOf(rec) {
  return `${rec?.id || ""} ${rec?.identity || ""} ${rec?.name || ""} ${rec?.subtype || ""}`.toLowerCase();
}

function familyFromProfile(profile, rec = {}) {
  if (typeof profile !== "string") return null;
  const key = profile.trim().toLowerCase();
  if (key === "staff") return WEAPON_FAMILIES.woodenStaff;
  if (key === "dagger") return WEAPON_FAMILIES.dagger;
  if (key === "spear") return WEAPON_FAMILIES.spear;
  if (key === "axe") return rec.twoHanded || Number(rec.weight || 0) >= 3 ? WEAPON_FAMILIES.axeLarge : WEAPON_FAMILIES.axeSmall;
  if (key === "mace" || key === "morningstar") return WEAPON_FAMILIES.mace;
  if (key === "sword") return rec.twoHanded || Number(rec.weight || 0) >= 2.4 ? WEAPON_FAMILIES.swordLarge : WEAPON_FAMILIES.swordSmall;
  return null;
}

export function resolveWeaponFamily(rec = {}) {
  const slot = String(rec.slot || "").toLowerCase();
  const type = String(rec.type || "").toLowerCase();
  const material = String(rec.material || "").toLowerCase();
  const text = textOf(rec);

  const shieldLikeText = text.includes("shield") || text.includes("buckler") || text.includes("pavise") || text.includes("aegis");
  const shieldLikeSlot = slot === "shield" || slot === "offhand";
  if (type === "shield" || (shieldLikeSlot && shieldLikeText) || (type === "equip" && shieldLikeText)) {
    return WOOD_MATERIALS.has(material) || text.includes("wood")
      ? WEAPON_FAMILIES.shieldWood
      : WEAPON_FAMILIES.shieldMetal;
  }

  if (slot !== "weapon" && !rec.damageDice) return null;
  if (text.includes("staff") || text.includes("quarterstaff")) return WEAPON_FAMILIES.woodenStaff;
  if (text.includes("dagger") || text.includes("shiv") || text.includes("stiletto") || text.includes("kris") || text.includes("athame") || text.includes("knife") || text.includes("fang")) return WEAPON_FAMILIES.dagger;
  if (text.includes("spear") || text.includes("pike") || text.includes("lance") || text.includes("scythe") || text.includes("rapier")) return WEAPON_FAMILIES.spear;
  if (text.includes("flail")) return WEAPON_FAMILIES.flail;
  if (text.includes("hammer") || text.includes("maul")) return WEAPON_FAMILIES.hammerLarge;
  if (text.includes("mace") || text.includes("morningstar") || text.includes("club") || text.includes("debtbringer")) return WEAPON_FAMILIES.mace;
  if (text.includes("axe") || text.includes("reaver") || text.includes("cleaver")) return rec.twoHanded || Number(rec.weight || 0) >= 3 ? WEAPON_FAMILIES.axeLarge : WEAPON_FAMILIES.axeSmall;
  if (text.includes("greatsword") || text.includes("longsword") || text.includes("warblade") || text.includes("blade") || text.includes("sword") || text.includes("edge") || text.includes("flametongue")) {
    return rec.twoHanded || Number(rec.weight || 0) >= 2.4 || text.includes("great") || text.includes("long")
      ? WEAPON_FAMILIES.swordLarge
      : WEAPON_FAMILIES.swordSmall;
  }

  const profileFamily = familyFromProfile(rec.weaponVfxProfile, rec);
  if (profileFamily) return profileFamily;

  const damageType = String(rec.damageType || "").toLowerCase();
  if (damageType === "pierce") return WEAPON_FAMILIES.spear;
  if (damageType === "blunt") return Number(rec.weight || 0) >= 3 ? WEAPON_FAMILIES.hammerLarge : WEAPON_FAMILIES.mace;
  if (damageType === "slash") return rec.twoHanded ? WEAPON_FAMILIES.swordLarge : WEAPON_FAMILIES.swordSmall;
  return null;
}
