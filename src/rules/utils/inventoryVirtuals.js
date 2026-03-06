/**
 * inventoryVirtuals.js — virtuals shim and inventory virtual components.
 *
 * Installs world.defineVirtual / world.vget / world.vclear on the world
 * instance (no lib changes needed).  Then defines inventory-related
 * virtual components:
 *
 *   ActorCarry   — total weight carried by an actor
 *   InventoryView — grouped stack view (Map<stackKey, {...}>)
 */

import { getCarriedWeight, getStackView } from "./inventoryFacade.js";

// ─── VIRTUALS SHIM ─────────────────────────────────────────────────────────

/**
 * Install world.defineVirtual / world.vget / world.vclear on a world instance.
 * Safe to call multiple times (idempotent via symbol guard).
 */
const INSTALLED = Symbol.for("jshack:virtuals:installed");

export function installVirtuals(world) {
  if (world[INSTALLED]) return world;
  world[INSTALLED] = true;

  const _vdefs = new Map();

  world.defineVirtual = (name, compute) => {
    if (typeof compute !== "function") throw new Error("defineVirtual: compute must be a function");
    const key = Symbol(String(name || "Virtual"));
    const VComp = Object.freeze({ key, name: String(name || "Virtual"), isVirtual: true });
    _vdefs.set(key, { compute, cache: new Map() });
    return VComp;
  };

  world.vget = (id, VComp) => {
    const def = _vdefs.get(VComp?.key);
    if (!def) throw new Error(`vget: unknown virtual '${VComp?.name || "?"}'`);
    const cached = def.cache.get(id);
    if (cached && cached.step === world.step) return cached.val;
    const val = def.compute(world, id);
    def.cache.set(id, { step: world.step, val });
    return val;
  };

  world.vclear = (VComp) => {
    if (!VComp) {
      for (const d of _vdefs.values()) d.cache.clear();
      return;
    }
    const def = _vdefs.get(VComp.key);
    if (def) def.cache.clear();
  };

  return world;
}

// ─── VIRTUAL COMPONENT DEFINITIONS ─────────────────────────────────────────

const ACTOR_CARRY_KEY = Symbol.for("jshack:inventoryVirtuals:ActorCarry");
const INVENTORY_VIEW_KEY = Symbol.for("jshack:inventoryVirtuals:InventoryView");

/**
 * Define inventory-related virtual components on the world.
 * Must be called after installVirtuals(world).
 * Safe to call multiple times (idempotent).
 */
const DEFINED = Symbol.for("jshack:inventoryVirtuals:defined");

export function defineInventoryVirtuals(world) {
  if (world[DEFINED]) return;
  world[DEFINED] = true;

  world[ACTOR_CARRY_KEY] = world.defineVirtual("ActorCarry", (world, actorId) => {
    return Object.freeze({ total: getCarriedWeight(world, actorId) });
  });

  world[INVENTORY_VIEW_KEY] = world.defineVirtual("InventoryView", (world, ownerId) => {
    return getStackView(world, ownerId);
  });
}

/** Get the ActorCarry virtual component handle. */
export function getActorCarryVirtual(world) {
  return world?.[ACTOR_CARRY_KEY] || null;
}

/** Get the InventoryView virtual component handle. */
export function getInventoryViewVirtual(world) {
  return world?.[INVENTORY_VIEW_KEY] || null;
}
