// rules/data/ammo.js
// Data-driven ammo behavior keyed by ammo identity.
// Projectile content is authored as script refs, not inline callback arrays.

import { registerScript, ScriptVerb } from "../scripting.js";

const EMPTY_HOOK_SCRIPTS = Object.freeze([]);

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

const AMMO_FIRE_ARROW_ACTOR_IMPACT = "ammo:fireArrows:onProjectileActorImpact";

registerScript(AMMO_FIRE_ARROW_ACTOR_IMPACT, {
  [ScriptVerb.ProjectileActorImpact]: (_world, ctx) => {
    const extra = ctx.rollDice("1d4");
    if (extra > 0) ctx.addDamage(extra);
    ctx.deferResolved((resolvedCtx) => {
      if (!resolvedCtx.applied || resolvedCtx.killed) return;
      resolvedCtx.pushEffect(resolvedCtx.defender, {
        key: "burn",
        turnsLeft: 3,
        potency: 2,
        stacks: 1,
      });
      resolvedCtx.emit("proc:burning", {
        actor: resolvedCtx.attacker,
        target: resolvedCtx.defender,
      });
    });
  },
});

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
 * @param {any} value
 * @returns {boolean}
 */
function isScriptRefValue(value) {
  if (typeof value === "string" && value) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const key = value.ref ?? value.script ?? value.key ?? value.id ?? "";
  return typeof key === "string" && key.length > 0;
}

/**
 * @param {Record<string, unknown> | null | undefined} source
 * @returns {Record<string, Array<string | object>>}
 */
function normalizeAmmoHookScripts(source) {
  if (!source || typeof source !== "object") return {};
  const out = {};

  for (let i = 0; i < AMMO_HOOK_KEYS.length; i++) {
    const key = AMMO_HOOK_KEYS[i];
    const direct = source[key];
    if (Array.isArray(direct)) {
      out[key] = direct.filter(isScriptRefValue);
      continue;
    }

    const aliasEntries = Object.entries(AMMO_HOOK_ALIASES);
    for (let a = 0; a < aliasEntries.length; a++) {
      const [alias, canonical] = aliasEntries[a];
      if (canonical !== key) continue;
      const maybeList = source[alias];
      if (Array.isArray(maybeList)) {
        out[key] = maybeList.filter(isScriptRefValue);
        break;
      }
    }
  }

  return out;
}

/**
 * @param {any} def
 * @returns {Record<string, Array<string | object>>}
 */
export function resolveAmmoHookScripts(def) {
  const topLevel = normalizeAmmoHookScripts(def);
  const nestedScripts = normalizeAmmoHookScripts(def?.scripts && typeof def.scripts === "object" ? def.scripts : null);
  const nestedHooks = normalizeAmmoHookScripts(def?.hooks && typeof def.hooks === "object" ? def.hooks : null);
  return { ...topLevel, ...nestedHooks, ...nestedScripts };
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
    scripts: Object.freeze({
      onProjectileActorImpact: EMPTY_HOOK_SCRIPTS,
      onProjectileWallImpact: EMPTY_HOOK_SCRIPTS,
      onProjectileMiss: EMPTY_HOOK_SCRIPTS,
    }),
  }),
  ammo_fire_arrows: Object.freeze({
    id: "ammo_fire_arrows",
    name: "Fire Arrows",
    scripts: Object.freeze({
      onProjectileActorImpact: Object.freeze([AMMO_FIRE_ARROW_ACTOR_IMPACT]),
      onProjectileWallImpact: EMPTY_HOOK_SCRIPTS,
      onProjectileMiss: EMPTY_HOOK_SCRIPTS,
    }),
  }),
});

/**
 * @param {string} key ammo identity (ammo_fire_arrows) or alias (fire_arrows, fire)
 * @returns {{ id:string, name:string, scripts?:Record<string, Array<string|object>> }|null}
 */
export function getAmmoDef(key) {
  const identity = normalizeAmmoIdentity(key);
  return identity ? (AMMO_DEFS[identity] || null) : null;
}

/**
 * @param {string} key ammo identity or alias
 * @param {string} hookKey canonical or alias hook key
 * @returns {Array<string | object>}
 */
export function getAmmoHookScripts(key, hookKey) {
  const canonical = canonicalAmmoHookKey(hookKey);
  if (!canonical) return EMPTY_HOOK_SCRIPTS;
  const scripts = resolveAmmoHookScripts(getAmmoDef(key));
  const list = scripts[canonical];
  return Array.isArray(list) ? list : EMPTY_HOOK_SCRIPTS;
}
