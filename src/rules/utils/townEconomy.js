import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Position } from "../components/Position.js";
import { ShopInventory } from "../components/ShopInventory.js";
import {
  addToInventory,
  hasCapacityForItem,
  inventoryItems,
  removeFromInventory,
  transferItem,
} from "./inventoryFacade.js";
import { createItemById } from "./itemFactory.js";
import { manhattanScalar } from "./distance.js";

export const TOWN_STORAGE = Object.freeze({
  mill: "Mill Chest",
  smithy: "Smithy Chest",
  lumber: "Lumber Chest",
  herb: "Herb Chest",
  tavern: "Tavern Chest",
});

export function findTownContainers(world) {
  /** @type {{ mill:number, smithy:number, lumber:number, herb:number, tavern:number, alchemist:number, herbalist:number, home:number }} */
  const out = { mill: 0, smithy: 0, lumber: 0, herb: 0, tavern: 0, alchemist: 0, herbalist: 0, home: 0 };
  /** @type {number[]} */
  const herbCandidates = [];
  for (const [id, ni] of world.query(NamedIdentity)) {
    const name = String(ni.name || "");
    const identity = String(ni.identity || "");
    if (!out.mill && world.has(id, Inventory) && (identity === "mill_chest" || name === TOWN_STORAGE.mill)) out.mill = id;
    else if (!out.smithy && world.has(id, Inventory) && (identity === "smithy_chest" || name === TOWN_STORAGE.smithy)) out.smithy = id;
    else if (!out.lumber && world.has(id, Inventory) && (identity === "lumber_chest" || name === TOWN_STORAGE.lumber)) out.lumber = id;
    else if (world.has(id, Inventory) && (identity === "herb_chest" || name === TOWN_STORAGE.herb)) herbCandidates.push(id);
    else if (!out.tavern && world.has(id, Inventory) && (identity === "tavern_chest" || name === TOWN_STORAGE.tavern)) out.tavern = id;
    else if (!out.alchemist && identity === "townfolk_alchemist" && world.has(id, ShopInventory)) out.alchemist = id;
    else if (!out.herbalist && identity === "townfolk_herbalist") out.herbalist = id;
    else if (!out.home && name === "Stash Chest" && world.has(id, Inventory)) out.home = id;
  }
  if (herbCandidates.length > 0) {
    const anchorId = out.herbalist || out.alchemist;
    const anchorPos = anchorId > 0 ? world.get(anchorId, Position) : null;
    let bestId = herbCandidates[0];
    let bestDist = Infinity;
    for (const chestId of herbCandidates) {
      const pos = world.get(chestId, Position);
      if (!anchorPos || !pos) {
        bestId = chestId;
        break;
      }
      const dist = manhattanScalar(pos.x, pos.y, anchorPos.x, anchorPos.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = chestId;
      }
    }
    out.herb = bestId;
  }
  return out;
}

export function countInventoryIdentity(world, ownerId, identity) {
  let total = 0;
  if (!(ownerId > 0)) return 0;
  for (const itemId of inventoryItems(world, ownerId)) {
    const ni = world.get(itemId, NamedIdentity);
    if (String(ni?.identity || "") !== String(identity)) continue;
    const info = world.get(itemId, ItemInfo);
    total += Math.max(1, Number(info?.count || 1) | 0);
  }
  return total;
}

export function countInventoryIdentityFast(world, ownerId, identity) {
  return countInventoryIdentity(world, ownerId, identity);
}

export function countInventoryByIdentity(world, ownerId) {
  /** @type {Record<string, number>} */
  const counts = Object.create(null);
  if (!(ownerId > 0)) return counts;
  for (const itemId of inventoryItems(world, ownerId)) {
    const ni = world.get(itemId, NamedIdentity);
    const identity = String(ni?.identity || "");
    if (!identity) continue;
    const info = world.get(itemId, ItemInfo);
    counts[identity] = (counts[identity] || 0) + Math.max(1, Number(info?.count || 1) | 0);
  }
  return counts;
}

export function consumeInventoryIdentity(world, ownerId, identity, amount) {
  let left = Math.max(0, Number(amount) | 0);
  if (!(ownerId > 0) || left <= 0) return 0;
  for (const itemId of inventoryItems(world, ownerId)) {
    if (left <= 0) break;
    const ni = world.get(itemId, NamedIdentity);
    if (String(ni?.identity || "") !== String(identity)) continue;
    const info = world.get(itemId, ItemInfo);
    const count = Math.max(1, Number(info?.count || 1) | 0);
    if (count > left && info) {
      world.mutate(itemId, ItemInfo, (rec) => {
        rec.count = Math.max(1, count - left);
      });
      return amount;
    }
    left -= count;
    removeFromInventory(world, ownerId, itemId);
    try { world.destroy(itemId); } catch {}
  }
  return (Math.max(0, Number(amount) | 0) - left);
}

export function findInventoryItemsByIdentity(world, ownerId, identity) {
  const out = [];
  if (!(ownerId > 0)) return out;
  const want = String(identity || "");
  for (const itemId of inventoryItems(world, ownerId)) {
    const ni = world.get(itemId, NamedIdentity);
    if (String(ni?.identity || "") === want) out.push(itemId);
  }
  return out;
}

export function findFirstInventoryItemByIdentity(world, ownerId, identity) {
  for (const itemId of findInventoryItemsByIdentity(world, ownerId, identity)) return itemId;
  return 0;
}

export function inventoryHasIdentity(world, ownerId, identity, amount = 1) {
  return countInventoryIdentity(world, ownerId, identity) >= Math.max(1, Number(amount) | 0);
}

export function transferFirstIdentity(world, fromId, toId, identity) {
  if (!(fromId > 0) || !(toId > 0)) return 0;
  const itemId = findFirstInventoryItemByIdentity(world, fromId, identity);
  if (!(itemId > 0) || !hasCapacityForItem(world, toId, itemId)) return 0;
  return transferItem(world, itemId, fromId, toId) ? itemId : 0;
}

export function transferUpToIdentity(world, fromId, toId, identity, amount) {
  let moved = 0;
  const target = Math.max(0, Number(amount) | 0);
  while (moved < target) {
    const itemId = transferFirstIdentity(world, fromId, toId, identity);
    if (!(itemId > 0)) break;
    moved++;
  }
  return moved;
}

export function createInventoryItem(world, ownerId, itemId, opts = {}) {
  if (!(ownerId > 0)) return 0;
  const created = createItemById(world, itemId, opts);
  if (!(created > 0)) return 0;
  if (!addToInventory(world, ownerId, created)) {
    try { world.destroy(created); } catch {}
    return 0;
  }
  return created;
}

export function findTownAnchor(world) {
  for (const [, pos, ni] of world.query(Position, NamedIdentity)) {
    if (String(ni.identity || "") === "house_sign") return { x: pos.x, y: pos.y };
  }
  return { x: 0, y: 0 };
}
