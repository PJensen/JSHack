// src/rules/systems/itemDestructionSystem.js
// NetHack-style item destruction: elemental damage destroys vulnerable inventory
// items unless the player wears the matching resistance.
//
//   fire    → scrolls (paper) burn to ash, potions (glass) shatter
//   cold    → potions (glass) shatter
//   electric→ wands explode
//
// Equipped items are exempt. Each vulnerable item has an independent 1-in-3
// chance per damage event.  Resistance from equipment (rings, shields, etc.)
// provides full protection.

import { Player } from "../components/Player.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Material } from "../components/Material.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Equipment, GEAR_SLOTS } from "../components/Equipment.js";
import { inventoryItems } from "../utils/inventoryFacade.js";
import { resolveCanonicalStats } from "../utils/canonicalStats.js";
import { applyMaterialTransform } from "../utils/materialTransforms.js";

const INSTALLED_KEY = Symbol.for("jshack:itemDestruction:installed");
const DESTRUCTION_CHANCE = 1 / 3;

/** @typedef {{ elements: string[], match: { itemTypes?: string[], materials?: string[] }, resistKey: string, transform: string, verb: string }} DestructionRule */

/** @type {DestructionRule[]} */
const DESTRUCTION_RULES = [
  {
    elements: ["fire"],
    match: { itemTypes: ["scroll"], materials: ["paper"] },
    resistKey: "fireResist",
    transform: "ash",
    verb: "burns up",
  },
  {
    elements: ["fire"],
    match: { itemTypes: ["potion"], materials: ["glass", "soul-glass", "glass-fiber"] },
    resistKey: "fireResist",
    transform: "shatter",
    verb: "boils and shatters",
  },
  {
    elements: ["cold", "frost"],
    match: { itemTypes: ["potion"], materials: ["glass", "soul-glass", "glass-fiber"] },
    resistKey: "coldResist",
    transform: "shatter",
    verb: "freezes and shatters",
  },
  {
    elements: ["electric", "lightning", "plasma"],
    match: { itemTypes: ["wand"] },
    resistKey: "electricOhms",
    transform: "shatter",
    verb: "crackles and explodes",
  },
];

/**
 * @param {any} stats - canonical stats object
 * @param {string} resistKey
 */
function hasResistance(stats, resistKey) {
  if (resistKey === "electricOhms") return Number(stats?.electricOhms || 0) > 0;
  return Number(stats?.[resistKey] || 0) > 0;
}

/**
 * @param {any} info - ItemInfo component
 * @param {any} mat - Material component
 * @param {DestructionRule} rule
 */
function matchesItem(info, mat, rule) {
  const type = String(info?.type || "").toLowerCase();
  const kind = String(mat?.kind || "").toLowerCase();
  const m = rule.match;
  if (Array.isArray(m.itemTypes) && !m.itemTypes.includes(type)) return false;
  if (Array.isArray(m.materials) && kind && !m.materials.includes(kind)) return false;
  return true;
}

/**
 * Collect equipped item IDs into a Set for fast lookup.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} entityId
 */
function equippedSet(world, entityId) {
  const eq = world.get(entityId, Equipment);
  const set = new Set();
  if (!eq) return set;
  for (let i = 0; i < GEAR_SLOTS.length; i++) {
    const id = Number(eq[GEAR_SLOTS[i]] || 0) | 0;
    if (id > 0) set.add(id);
  }
  return set;
}

/**
 * Install the item-destruction-on-damage listener. Call once per world.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function installItemDestructionListener(world) {
  if (world[INSTALLED_KEY]) return;
  world[INSTALLED_KEY] = true;

  world.on("damaged", ({ target, type, amount }) => {
    if (!(amount > 0)) return;
    if (!(target > 0) || !world.isAlive(target)) return;
    if (!world.has(target, Player)) return;

    const element = String(type || "").toLowerCase();
    const stats = resolveCanonicalStats(world, target);
    const worn = equippedSet(world, target);

    for (let r = 0; r < DESTRUCTION_RULES.length; r++) {
      const rule = DESTRUCTION_RULES[r];
      if (!rule.elements.includes(element)) continue;
      if (hasResistance(stats, rule.resistKey)) continue;

      const items = inventoryItems(world, target);
      for (let i = 0; i < items.length; i++) {
        const itemId = items[i];
        if (!(itemId > 0) || !world.isAlive(itemId)) continue;
        if (worn.has(itemId)) continue;

        const info = world.get(itemId, ItemInfo);
        if (!info) continue;
        const mat = world.get(itemId, Material);
        if (!matchesItem(info, mat, rule)) continue;

        if (world.rand() >= DESTRUCTION_CHANCE) continue;

        const ni = world.get(itemId, NamedIdentity);
        const name = String(ni?.name || info.description || info.type || "item");

        applyMaterialTransform(world, itemId, rule.transform);

        world.emit("item:destroyed:element", {
          target,
          itemId,
          itemName: name,
          element,
          verb: rule.verb,
        });
      }
    }
  });
}
