// Canonical weapon visual-affinity resolution for swing/carry/projectile VFX.
// This is explicit authored presentation metadata, not a rarity or "magic item"
// fallback.

import { ActiveEffects } from "../components/ActiveEffects.js";
import { AffixTopologyNode } from "../components/AffixTopologyNode.js";
import { EnchantmentNode } from "../components/EnchantmentNode.js";
import { GemSocketNode } from "../components/GemSocketNode.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { ProcPackageNode } from "../components/ProcPackageNode.js";
import { descendantsWith } from "../utils/topology.js";
import { getAffix } from "./affixes.js";
import { EFFECT_DEFS } from "./effectDefs.js";
import { WEAPON_COATING_DEFS } from "./weaponCoatings.js";

const PROFILE_ID_BY_AFFINITY = Object.freeze({
  fire: "flame_weapon",
  poison: "venom_weapon",
  electric: "storm_weapon",
  frost: "frost_weapon",
  acid: "caustic_weapon",
  blood: "blood_weapon",
  soul: "soul_weapon",
  void: "soul_weapon",
  shadow: "soul_weapon",
  holy: "holy_weapon",
  arcane: "soul_weapon",
  magic: "soul_weapon",
});

const STYLE_BY_AFFINITY = Object.freeze({
  fire: "flame",
  poison: "poison",
  electric: "electric",
  frost: "frost",
  acid: "acid",
  blood: "blood",
  soul: "soul",
  void: "void",
  shadow: "shadow",
  holy: "holy",
  arcane: "arcane",
  magic: "arcane",
});

const IDENTITY_AFFINITIES = Object.freeze({
  sunsword: { id: "holy", elementTint: "holy", swingStyle: "holy", priority: 360 },
  flametongue: { id: "fire", elementTint: "fire", swingStyle: "flame", priority: 320 },
  ember_knife: { id: "fire", elementTint: "fire", swingStyle: "flame", priority: 320 },
  smoldering_club: { id: "fire", elementTint: "fire", swingStyle: "flame", priority: 320 },
  witchfire_sword: { id: "fire", elementTint: "fire", swingStyle: "flame", priority: 320 },
  nightfang_dagger: { id: "poison", elementTint: "poison", swingStyle: "poison", priority: 300 },
  venomfang_dagger: { id: "poison", elementTint: "poison", swingStyle: "poison", priority: 300 },
  nightfang: { id: "poison", elementTint: "poison", swingStyle: "poison", priority: 300 },
  venomfang: { id: "poison", elementTint: "poison", swingStyle: "poison", priority: 300 },
  electrical_mace: { id: "electric", elementTint: "electric", swingStyle: "electric", priority: 280 },
  storm_mace: { id: "electric", elementTint: "electric", swingStyle: "electric", priority: 280 },
  thunder_mace: { id: "electric", elementTint: "electric", swingStyle: "electric", priority: 280 },
  winterfang: { id: "frost", elementTint: "frost", swingStyle: "frost", priority: 260 },
  frost_sabre: { id: "frost", elementTint: "frost", swingStyle: "frost", priority: 260 },
  ice_knife: { id: "frost", elementTint: "frost", swingStyle: "frost", priority: 260 },
  soul_reaver: { id: "soul", elementTint: "soul", swingStyle: "soul", priority: 220 },
  night_sabre: { id: "soul", elementTint: "soul", swingStyle: "soul", priority: 220 },
  bloodletter: { id: "blood", elementTint: "blood", swingStyle: "blood", priority: 210 },
  war_reaper: { id: "blood", elementTint: "blood", swingStyle: "blood", priority: 210 },
  acid_spitter: { id: "acid", elementTint: "acid", swingStyle: "acid", priority: 200 },
  slime_blade: { id: "acid", elementTint: "acid", swingStyle: "acid", priority: 200 },
});

const AFFIX_AFFINITIES = Object.freeze({
  souldrain1: { id: "soul", elementTint: "soul", swingStyle: "soul", priority: 220 },
  agony1: { id: "soul", elementTint: "soul", swingStyle: "soul", priority: 220 },
  hemorrhage1: { id: "blood", elementTint: "blood", swingStyle: "blood", priority: 210 },
  berserk1: { id: "blood", elementTint: "blood", swingStyle: "blood", priority: 210 },
});

const GEM_AFFINITIES = Object.freeze({
  gem_ruby: { id: "fire", elementTint: "fire", swingStyle: "flame", priority: 250 },
  gem_garnet: { id: "fire", elementTint: "fire", swingStyle: "flame", priority: 250 },
  gem_emerald: { id: "poison", elementTint: "poison", swingStyle: "poison", priority: 250 },
  gem_topaz: { id: "electric", elementTint: "electric", swingStyle: "electric", priority: 250 },
  gem_fluorite: { id: "electric", elementTint: "electric", swingStyle: "electric", priority: 250 },
  gem_sapphire: { id: "frost", elementTint: "frost", swingStyle: "frost", priority: 250 },
  gem_voidstone: { id: "void", elementTint: "void", swingStyle: "void", priority: 250 },
  gem_jacinth: { id: "soul", elementTint: "soul", swingStyle: "soul", priority: 250 },
  gem_aquamarine: { id: "blood", elementTint: "blood", swingStyle: "blood", priority: 250 },
  gem_amethyst: { id: "arcane", elementTint: "arcane", swingStyle: "arcane", priority: 250 },
});

const PROC_PACKAGE_AFFINITIES = Object.freeze({
  echoStrike: { id: "arcane", elementTint: "arcane", swingStyle: "arcane", priority: 240 },
  ricochetTheology: { id: "electric", elementTint: "electric", swingStyle: "electric", priority: 240 },
  doomClock: { id: "shadow", elementTint: "shadow", swingStyle: "shadow", priority: 240 },
  soulMortgage: { id: "soul", elementTint: "soul", swingStyle: "soul", priority: 240 },
  cataclysmChain: { id: "void", elementTint: "void", swingStyle: "void", priority: 240 },
  bloodTithe: { id: "blood", elementTint: "blood", swingStyle: "blood", priority: 240 },
  venomClock: { id: "poison", elementTint: "poison", swingStyle: "poison", priority: 240 },
  thunderGod: { id: "electric", elementTint: "electric", swingStyle: "electric", priority: 240 },
  bloodCovenant: { id: "blood", elementTint: "blood", swingStyle: "blood", priority: 240 },
  eternalHunger: { id: "void", elementTint: "void", swingStyle: "void", priority: 240 },
  eclipseHammer: { id: "fire", elementTint: "fire", swingStyle: "flame", priority: 240 },
  tollwarden: { id: "shadow", elementTint: "shadow", swingStyle: "shadow", priority: 240 },
  kineticBattery: { id: "electric", elementTint: "electric", swingStyle: "electric", priority: 240 },
  venomLedger: { id: "poison", elementTint: "poison", swingStyle: "poison", priority: 240 },
  ritualOverdraw: { id: "blood", elementTint: "blood", swingStyle: "blood", priority: 240 },
  wardedRetort: { id: "acid", elementTint: "acid", swingStyle: "acid", priority: 240 },
  bloodsport: { id: "blood", elementTint: "blood", swingStyle: "blood", priority: 240 },
  shadowParry: { id: "shadow", elementTint: "shadow", swingStyle: "shadow", priority: 240 },
  moonfireCycle: { id: "fire", elementTint: "fire", swingStyle: "flame", priority: 240 },
  glacierSigil: { id: "frost", elementTint: "frost", swingStyle: "frost", priority: 240 },
  conductionLens: { id: "electric", elementTint: "electric", swingStyle: "electric", priority: 240 },
  graveCurrent: { id: "void", elementTint: "void", swingStyle: "void", priority: 240 },
});

function normalizeId(raw) {
  return String(raw || "").trim().toLowerCase();
}

function normalizeAffixId(raw) {
  const key = normalizeId(raw);
  return key.startsWith("affix:") ? key.slice(6) : key;
}

function normalizePackageId(raw) {
  const key = String(raw || "").trim();
  return key.startsWith("procPackage:") ? key.slice(12) : key;
}

function profileIdFor(id) {
  return PROFILE_ID_BY_AFFINITY[normalizeId(id)] || "";
}

function normalizeAffinity(input, fallbackPriority = 0) {
  if (!input) return null;
  if (typeof input === "string") {
    const id = normalizeId(input);
    if (!id) return null;
    return {
      id,
      elementTint: id,
      swingStyle: STYLE_BY_AFFINITY[id] || id,
      priority: fallbackPriority,
      weaponVfxProfileId: profileIdFor(id),
    };
  }
  if (typeof input !== "object") return null;
  const id = normalizeId(input.id || input.elementTint || input.swingStyle);
  if (!id) return null;
  const elementTint = normalizeId(input.elementTint || id);
  const swingStyle = normalizeId(input.swingStyle || STYLE_BY_AFFINITY[id] || elementTint || id);
  return {
    id,
    elementTint,
    swingStyle,
    priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : fallbackPriority,
    weaponVfxProfileId: String(input.weaponVfxProfileId || profileIdFor(id)).trim(),
  };
}

function betterAffinity(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const ap = Number(a.priority || 0);
  const bp = Number(b.priority || 0);
  if (bp > ap) return b;
  return a;
}

function affinityFromAffixId(raw, priority = 300) {
  const id = normalizeAffixId(raw);
  if (!id) return null;
  const explicit = normalizeAffinity(AFFIX_AFFINITIES[id], priority);
  if (explicit) return explicit;
  const affix = getAffix(id);
  const visual = normalizeAffinity(affix?.visualAffinity, priority);
  if (visual) return visual;
  return normalizeAffinity(affix?.elementTint, priority);
}

function affinityFromEffectKey(key, priority = 330) {
  const normalized = normalizeId(key);
  if (!normalized) return null;
  for (let i = 0; i < EFFECT_DEFS.length; i++) {
    const def = EFFECT_DEFS[i];
    if (!Array.isArray(def?.keys) || !def.keys.includes(normalized)) continue;
    const visual = normalizeAffinity(def.visualAffinity, priority);
    if (visual) return visual;
    return normalizeAffinity(def.elementTint, priority);
  }
  return null;
}

function readItemInfo(world, itemId) {
  if (!(itemId > 0)) return null;
  if (typeof world?.isAlive === "function" && !world.isAlive(itemId)) return null;
  return world.get(itemId, ItemInfo) || null;
}

/**
 * Resolve the strongest explicit visual affinity active on a weapon.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {{ actorId?:number, weaponId?:number }} opts
 * @returns {{ id:string, elementTint:string, swingStyle:string, priority:number, weaponVfxProfileId:string }|null}
 */
export function resolveWeaponVisualAffinity(world, opts = {}) {
  const weaponId = Number(opts.weaponId || 0) | 0;
  const actorId = Number(opts.actorId || 0) | 0;
  const info = readItemInfo(world, weaponId);
  let best = null;

  const identity = normalizeId(world.get(weaponId, NamedIdentity)?.identity || "");
  best = betterAffinity(best, normalizeAffinity(IDENTITY_AFFINITIES[identity]));

  if (info) {
    const affixes = Array.isArray(info.affixes) ? info.affixes : [];
    for (let i = 0; i < affixes.length; i++) {
      best = betterAffinity(best, affinityFromAffixId(affixes[i], 300));
    }

    const coating = info.coating;
    const kind = normalizeId(coating?.kind || "");
    if (kind && Math.max(0, Number(coating?.charges || 0) | 0) > 0) {
      const def = WEAPON_COATING_DEFS[kind];
      const visual = normalizeAffinity(def?.visualAffinity, 300)
        || normalizeAffinity(def?.elementTint, 300);
      best = betterAffinity(best, visual);
    }
  }

  if (weaponId > 0) {
    for (const [, node] of descendantsWith(world, weaponId, AffixTopologyNode)) {
      best = betterAffinity(best, affinityFromAffixId(node?.affixId, 300));
    }
    for (const [, node] of descendantsWith(world, weaponId, EnchantmentNode)) {
      best = betterAffinity(best, affinityFromAffixId(node?.defId, 300));
    }
    for (const [, node] of descendantsWith(world, weaponId, GemSocketNode)) {
      best = betterAffinity(best, normalizeAffinity(GEM_AFFINITIES[String(node?.gemId || "").trim()], 250));
    }
    for (const [, node] of descendantsWith(world, weaponId, ProcPackageNode)) {
      best = betterAffinity(best, normalizeAffinity(PROC_PACKAGE_AFFINITIES[normalizePackageId(node?.packageId)], 240));
    }
  }

  if (actorId > 0) {
    const ae = world.get(actorId, ActiveEffects);
    const effects = Array.isArray(ae?.effects) ? ae.effects : [];
    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      if (!effect || !((Number(effect.turnsLeft || 0) | 0) > 0)) continue;
      best = betterAffinity(best, affinityFromEffectKey(effect.key, 330));
    }
  }

  return best ? Object.freeze(best) : null;
}

export function weaponVfxProfileIdForAffinity(affinity) {
  return String(affinity?.weaponVfxProfileId || profileIdFor(affinity?.id)).trim();
}
