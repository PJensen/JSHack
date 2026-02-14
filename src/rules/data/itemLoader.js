import { createFrom } from "../../lib/ecs-js/archetype.js";
import { MagicItem } from "../archetypes/Items.js";
import { Material } from "../components/Material.js";
import { getItem } from "./items.js";

/**
 * Build a magic item entity from ITEM_DEFS.
 * Includes optional Material when the definition provides one.
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {string} itemId
 * @param {{ count?: number }} [opts]
 */
export function buildMagicItem(world, itemId, opts = {}) {
  const def = getItem(itemId);
  if (!def) throw new Error(`Unknown item id: ${itemId}`);

  const overrideCount = Number(opts.count || 0) | 0;
  const count = overrideCount > 0 ? overrideCount : Number(def.charges || 1) | 0;

  const id = createFrom(world, MagicItem, {
    name: def.name,
    identity: def.id,
    type: def.type,
    slot: def.slot,
    weight: 1,
    value: 0,
    description: def.description,
    count,
    rarity: def.rarity || 1,
    rarityName: def.rarityName || "common",
  });

  if (typeof def.material === "string" && def.material) {
    world.add(id, Material, { kind: def.material });
  }

  return id;
}

