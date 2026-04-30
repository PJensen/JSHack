import { attach, children, getParent } from "../../lib/ecs-js/hierarchy.js";
import { Equipment, GEAR_SLOTS } from "../components/Equipment.js";
import { EquipmentRoot } from "../components/EquipmentRoot.js";
import { EquippedSlotNode } from "../components/EquippedSlotNode.js";
import { firstChildWith, childrenWith } from "./topology.js";

function normalizeSlot(slot) {
  const key = String(slot || "").trim().toLowerCase();
  if (key === "shield") return "offhand";
  if (key === "ring") return "ring1";
  return key;
}

export function findEquipmentRoot(world, actorId) {
  const actor = Number(actorId || 0) | 0;
  if (!(actor > 0)) return 0;
  const found = firstChildWith(world, actor, EquipmentRoot);
  return found ? found[0] : 0;
}

export function getOrCreateEquipmentRoot(world, actorId) {
  const actor = Number(actorId || 0) | 0;
  if (!(actor > 0)) return 0;
  const existing = findEquipmentRoot(world, actor);
  if (existing > 0) return existing;
  const root = world.create();
  world.add(root, EquipmentRoot);
  attach(world, root, actor);
  return root;
}

export function findEquippedSlotNode(world, actorId, slot) {
  const root = findEquipmentRoot(world, actorId);
  const wanted = normalizeSlot(slot);
  if (!(root > 0) || !wanted) return 0;
  for (const [slotNode, record] of childrenWith(world, root, EquippedSlotNode)) {
    if (normalizeSlot(record?.slot) === wanted) return slotNode;
  }
  return 0;
}

export function getOrCreateEquippedSlotNode(world, actorId, slot) {
  const wanted = normalizeSlot(slot);
  if (!wanted) return 0;
  const existing = findEquippedSlotNode(world, actorId, wanted);
  if (existing > 0) return existing;
  const root = getOrCreateEquipmentRoot(world, actorId);
  if (!(root > 0)) return 0;
  const slotNode = world.create();
  world.add(slotNode, EquippedSlotNode, { slot: wanted });
  attach(world, slotNode, root);
  return slotNode;
}

function firstItemChild(world, slotNode) {
  for (const childId of children(world, slotNode)) return childId;
  return 0;
}

export function getEquippedItemFromTopology(world, actorId, slot) {
  const slotNode = findEquippedSlotNode(world, actorId, slot);
  return slotNode > 0 ? firstItemChild(world, slotNode) : 0;
}

export function setEquippedSlotTopology(world, actorId, slot, itemId) {
  const actor = Number(actorId || 0) | 0;
  const item = Number(itemId || 0) | 0;
  const wanted = normalizeSlot(slot);
  if (!(actor > 0) || !wanted) return 0;
  const slotNode = getOrCreateEquippedSlotNode(world, actor, wanted);
  if (!(slotNode > 0)) return 0;
  if (item > 0) attach(world, item, slotNode);
  return slotNode;
}

export function clearEquippedSlotTopology(world, actorId, slot) {
  const slotNode = findEquippedSlotNode(world, actorId, slot);
  if (!(slotNode > 0)) return 0;
  const itemId = firstItemChild(world, slotNode);
  if (!(itemId > 0)) return 0;
  attach(world, itemId, actorId);
  return itemId;
}

export function resolveEquipmentView(world, actorId) {
  const actor = Number(actorId || 0) | 0;
  const view = {};
  for (const slot of GEAR_SLOTS) view[slot] = 0;
  if (!(actor > 0)) return Object.freeze(view);

  const eq = world.get(actor, Equipment);
  if (eq) {
    for (const slot of GEAR_SLOTS) view[slot] = Number(eq[slot] || 0) | 0;
  }

  const root = findEquipmentRoot(world, actor);
  if (root > 0) {
    for (const [slotNode, record] of childrenWith(world, root, EquippedSlotNode)) {
      const slot = normalizeSlot(record?.slot);
      if (!GEAR_SLOTS.includes(slot)) continue;
      const itemId = firstItemChild(world, slotNode);
      if (itemId > 0) view[slot] = itemId;
    }
  }

  return Object.freeze(view);
}

export function isEquippedInTopology(world, actorId, itemId) {
  const item = Number(itemId || 0) | 0;
  if (!(item > 0)) return "";
  const parent = getParent(world, item);
  if (!(parent > 0) || !world.has(parent, EquippedSlotNode)) return "";
  const root = getParent(world, parent);
  if (root !== findEquipmentRoot(world, actorId)) return "";
  return normalizeSlot(world.get(parent, EquippedSlotNode)?.slot);
}
