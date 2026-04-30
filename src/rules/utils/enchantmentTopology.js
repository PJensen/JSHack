import { AffixTopologyNode } from "../components/AffixTopologyNode.js";
import { Charges } from "../components/Charges.js";
import { EnchantmentNode } from "../components/EnchantmentNode.js";
import { Source } from "../components/Source.js";
import { getAffixTriggerScripts, getAffixTriggers } from "../data/affixes.js";
import { attachProcPackage } from "../data/procPackages.js";
import { addAttachedComponent, attachProcNode, gateEventKind } from "./statProcAuthoring.js";

function positiveEntityId(value) {
  const id = Number(value || 0) | 0;
  return id > 0 ? id : 0;
}

function attachAffixRuntime(world, parentId, affixId) {
  const resolvedAffixId = String(affixId || "").trim();
  if (!resolvedAffixId) return 0;

  const affixNodeId = addAttachedComponent(world, parentId, AffixTopologyNode, {
    affixId: resolvedAffixId,
  });
  const triggers = getAffixTriggers(resolvedAffixId);
  for (let i = 0; i < triggers.length; i++) {
    const trigger = String(triggers[i] || "");
    if (!trigger) continue;
    const scripts = getAffixTriggerScripts(resolvedAffixId, trigger);
    for (let j = 0; j < scripts.length; j++) {
      attachProcNode(world, affixNodeId, {
        priority: i * 100 + j,
        gates: [gateEventKind(trigger)],
        script: scripts[j],
      });
    }
  }
  return affixNodeId;
}

/**
 * Attach a runtime enchantment subtree to an item.
 *
 * Shape:
 * item -> EnchantmentNode -> AffixTopologyNode / ProcPackageNode -> ProcNode
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} itemId
 * @param {{
 *   defId?: string,
 *   level?: number,
 *   affixId?: string,
 *   procPackageId?: string,
 *   charges?: number,
 *   maxCharges?: number,
 *   sourceKind?: string,
 *   sourceId?: number,
 *   sourceKey?: string,
 * }} def
 * @returns {number}
 */
export function attachEnchantmentNode(world, itemId, def = {}) {
  const item = positiveEntityId(itemId);
  if (!(item > 0) || !world?.isAlive?.(item)) return 0;

  const affixId = String(def.affixId || "").trim();
  const procPackageId = String(def.procPackageId || "").trim();
  const defId = String(def.defId || affixId || procPackageId || "enchantment");
  const enchantmentId = addAttachedComponent(world, item, EnchantmentNode, {
    defId,
    level: Math.max(1, Number(def.level || 1) | 0),
  });

  if (def.sourceKind || def.sourceId || def.sourceKey) {
    world.add(enchantmentId, Source, {
      kind: String(def.sourceKind || ""),
      id: positiveEntityId(def.sourceId),
      key: String(def.sourceKey || ""),
    });
  }

  const maxCharges = Math.max(0, Number(def.maxCharges ?? def.charges ?? 0) | 0);
  if (maxCharges > 0) {
    world.add(enchantmentId, Charges, {
      current: Math.min(maxCharges, Math.max(0, Number(def.charges ?? maxCharges) | 0)),
      max: maxCharges,
    });
  }

  if (affixId) attachAffixRuntime(world, enchantmentId, affixId);
  if (procPackageId) attachProcPackage(world, enchantmentId, procPackageId);

  return enchantmentId;
}
