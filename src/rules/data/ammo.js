// rules/data/ammo.js
// Data-driven ammo behavior keyed by ammo identity.
// Hooks are plain (ctx) => void callbacks invoked via runCallbackList.

import {
  bonusDamageOnProjectileActorImpact,
  statusEffectOnProjectileActorImpact,
} from "./callbacks/projectile.js";

const EMPTY_HOOKS = Object.freeze([]);

export const AMMO_HOOK_ALIASES = Object.freeze({
  on_projectile_actor_impact: "onProjectileActorImpact",
  on_projectile_wall_impact: "onProjectileWallImpact",
  on_projectile_miss: "onProjectileMiss",
});

export const AMMO_HOOK_KEYS = Object.freeze([
  "onProjectileActorImpact",
  "onProjectileWallImpact",
  "onProjectileMiss",
]);

/**
 * @param {string} key
 * @returns {string}
 */
export function canonicalAmmoHookKey(key) {
  const normalized = String(key || "").trim();
  if (!normalized) return "";
  return AMMO_HOOK_ALIASES[normalized] || normalized;
}

/**
 * @param {Record<string, unknown> | null | undefined} source
 * @returns {Record<string, Function[]>}
 */
function normalizeAmmoHooks(source) {
  if (!source || typeof source !== "object") return {};
  const out = {};

  for (let i = 0; i < AMMO_HOOK_KEYS.length; i++) {
    const key = AMMO_HOOK_KEYS[i];
    const direct = source[key];
    if (Array.isArray(direct)) {
      out[key] = direct.filter((fn) => typeof fn === "function");
      continue;
    }

    const aliasEntries = Object.entries(AMMO_HOOK_ALIASES);
    for (let a = 0; a < aliasEntries.length; a++) {
      const [alias, canonical] = aliasEntries[a];
      if (canonical !== key) continue;
      const maybeList = source[alias];
      if (Array.isArray(maybeList)) {
        out[key] = maybeList.filter((fn) => typeof fn === "function");
        break;
      }
    }
  }

  return out;
}

/**
 * @param {any} def
 * @returns {Record<string, Function[]>}
 */
export function resolveAmmoHooks(def) {
  const topLevel = normalizeAmmoHooks(def);
  const nested = normalizeAmmoHooks(def?.hooks && typeof def.hooks === "object" ? def.hooks : null);
  return { ...topLevel, ...nested };
}

const AMMO_ID_ALIASES = Object.freeze({
  arrows: "ammo_arrows",
  fire_arrows: "ammo_fire_arrows",
  plain: "ammo_arrows",
  fire: "ammo_fire_arrows",
});

/**
 * @param {string} key
 * @returns {string}
 */
function normalizeAmmoIdentity(key) {
  const normalized = String(key || "").toLowerCase().trim();
  if (!normalized) return "";
  if (AMMO_ID_ALIASES[normalized]) return AMMO_ID_ALIASES[normalized];
  if (normalized.startsWith("ammo_")) return normalized;
  return `ammo_${normalized}`;
}

export const AMMO_DEFS = Object.freeze({
  ammo_arrows: Object.freeze({
    id: "ammo_arrows",
    name: "Arrows",
    hooks: Object.freeze({
      onProjectileActorImpact: EMPTY_HOOKS,
      onProjectileWallImpact: EMPTY_HOOKS,
      onProjectileMiss: EMPTY_HOOKS,
    }),
  }),
  ammo_fire_arrows: Object.freeze({
    id: "ammo_fire_arrows",
    name: "Fire Arrows",
    hooks: Object.freeze({
      onProjectileActorImpact: Object.freeze([
        bonusDamageOnProjectileActorImpact("1d4"),
        statusEffectOnProjectileActorImpact(
          { key: "burn", turnsLeft: 3, potency: 2, stacks: 1 },
          "proc:burning",
          { requireApplied: true, skipIfKilled: true },
        ),
      ]),
      onProjectileWallImpact: EMPTY_HOOKS,
      onProjectileMiss: EMPTY_HOOKS,
    }),
  }),
});

/**
 * @param {string} key ammo identity (ammo_fire_arrows) or alias (fire_arrows, fire)
 * @returns {{ id:string, name:string, hooks?:Record<string, Function[]> }|null}
 */
export function getAmmoDef(key) {
  const identity = normalizeAmmoIdentity(key);
  return identity ? (AMMO_DEFS[identity] || null) : null;
}

/**
 * @param {string} key ammo identity or alias
 * @param {string} hookKey canonical or alias hook key
 * @returns {Function[]}
 */
export function getAmmoHooks(key, hookKey) {
  const canonical = canonicalAmmoHookKey(hookKey);
  if (!canonical) return EMPTY_HOOKS;
  const hooks = resolveAmmoHooks(getAmmoDef(key));
  const list = hooks[canonical];
  return Array.isArray(list) ? list : EMPTY_HOOKS;
}
