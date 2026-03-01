// rules/utils/transmogrify.js
// In-place item transmogrification: changes what an item IS while keeping
// the same entity ID, so inventory refs, Owner, Position all stay valid.

import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Material } from "../components/Material.js";
import { Potion } from "../components/Potion.js";
import { Consumable } from "../components/Consumable.js";
import { DamageSpec } from "../components/DamageSpec.js";
import { createItemById, isValidItemId } from "./itemFactory.js";
import { identify } from "../data/identification.js";

/** Components that are type-specific and should be stripped when transmogrifying
 *  unless the target item explicitly re-adds them. */
const TYPE_SPECIFIC_COMPONENTS = [Potion, Consumable, DamageSpec];

/**
 * Transmogrify an existing item entity into a different item, in-place.
 * The entity keeps its ID, Position, Owner, and inventory slot — only the
 * "what it is" components are swapped.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} entityId  - The entity to transmogrify.
 * @param {string} targetItemId - Identity string of the target item
 *   (e.g. 'potion_health', 'gold', 'sword_plain').
 * @param {object} [opts]
 * @param {number} [opts.count] - Override stack count on the result.
 * @returns {{ ok: boolean, from: string, to: string }}
 *   `ok` is false when entityId is dead or targetItemId is unknown.
 */
export function transmogrify(world, entityId, targetItemId, opts = {}) {
  if (!world.isAlive(entityId)) return { ok: false, from: "", to: "" };
  if (!isValidItemId(targetItemId)) return { ok: false, from: "", to: "" };

  // Snapshot what it was.
  const oldNi = world.get(entityId, NamedIdentity);
  const fromIdentity = oldNi?.identity ?? "";

  // Create a temporary "template" entity so the factory resolves all the
  // component data for us, then copy its components onto our real entity.
  const templateId = createItemById(world, targetItemId, opts);
  if (templateId == null) return { ok: false, from: fromIdentity, to: "" };

  // --- Copy core item components from template → entity ---
  _copyOrAdd(world, templateId, entityId, NamedIdentity);
  _copyOrAdd(world, templateId, entityId, ItemInfo);
  _copyOrAdd(world, templateId, entityId, Material);

  // --- Strip type-specific components that the new item doesn't have ---
  for (const Comp of TYPE_SPECIFIC_COMPONENTS) {
    if (world.has(templateId, Comp)) {
      _copyOrAdd(world, templateId, entityId, Comp);
    } else if (world.has(entityId, Comp)) {
      world.remove(entityId, Comp);
    }
  }

  // Override count if requested.
  if (opts.count > 0) {
    const info = world.get(entityId, ItemInfo);
    if (info) info.count = opts.count | 0;
  }

  const toNi = world.get(entityId, NamedIdentity);
  const toIdentity = toNi?.identity ?? targetItemId;

  // Transmogrified items are always identified
  if (toIdentity) identify(toIdentity);

  // Clean up the disposable template entity.
  world.destroy(templateId);

  return { ok: true, from: fromIdentity, to: toIdentity };
}

/** Copy a component's data from src to dst, adding or overwriting as needed. */
function _copyOrAdd(world, srcId, dstId, Comp) {
  const data = world.get(srcId, Comp);
  if (!data) return;
  if (world.has(dstId, Comp)) {
    const dst = world.get(dstId, Comp);
    Object.assign(dst, data);
  } else {
    world.add(dstId, Comp, data);
  }
}
