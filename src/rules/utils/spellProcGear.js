import { children } from "../../lib/ecs-js/index.js";
import { Equipment, NON_AMMO_GEAR_SLOTS } from "../components/Equipment.js";
import { ProcPackageNode } from "../components/ProcPackageNode.js";

function itemHasProcPackage(world, itemId, packageId) {
  const wanted = String(packageId || "").trim();
  const root = Number(itemId || 0) | 0;
  if (!wanted || !(root > 0) || !world?.isAlive?.(root)) return false;

  const stack = [root];
  while (stack.length > 0) {
    const entityId = stack.pop();
    if (!(entityId > 0) || !world.isAlive?.(entityId)) continue;
    const marker = world.get(entityId, ProcPackageNode);
    if (String(marker?.packageId || "") === wanted) return true;
    for (const childId of children(world, entityId)) stack.push(childId);
  }
  return false;
}

export function hasEquippedProcPackage(world, actorId, packageId, slots = NON_AMMO_GEAR_SLOTS) {
  const resolvedActorId = Number(actorId || 0) | 0;
  const eq = world.get(resolvedActorId, Equipment);
  if (!eq) return false;
  const slotList = Array.isArray(slots) ? slots : NON_AMMO_GEAR_SLOTS;
  for (let i = 0; i < slotList.length; i++) {
    const slot = String(slotList[i] || "");
    const itemId = Number(eq[slot] || 0) | 0;
    if (itemId > 0 && itemHasProcPackage(world, itemId, packageId)) return true;
  }
  return false;
}

export function hasEquippedProcPackageInSlot(world, actorId, slot, packageId) {
  const resolvedActorId = Number(actorId || 0) | 0;
  const eq = world.get(resolvedActorId, Equipment);
  if (!eq) return false;
  const itemId = Number(eq[String(slot || "")] || 0) | 0;
  if (!(itemId > 0)) return false;
  return itemHasProcPackage(world, itemId, packageId);
}
