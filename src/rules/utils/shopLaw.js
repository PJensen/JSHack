import { RoomMetadata } from "../components/RoomMetadata.js";
import { Unpaid } from "../components/Unpaid.js";
import { calculateCarriedUnpaidBill } from "./shopEnforcement.js";
import { calculateShopDebt } from "./shopDebt.js";
import {
  evaluateShopLawResponse,
  recordShopClaim,
  recordShopIncident,
  recordUnpaidExtraction,
  shopClaimRecords,
  shopIncidentRecords,
} from "./shopClaims.js";

const INSTALLED = Symbol.for("jshack:shopLaw:listeners:installed");

function normId(value) {
  return Number(value || 0) | 0;
}

function normPoint(point) {
  if (!point || typeof point !== "object") return null;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: x | 0, y: y | 0 };
}

function isInRoom(x, y, room) {
  return (
    x >= (room.x | 0) &&
    x < ((room.x | 0) + (room.w | 0)) &&
    y >= (room.y | 0) &&
    y < ((room.y | 0) + (room.h | 0))
  );
}

export function findShopAt(world, x, y) {
  const px = Number.isFinite(Number(x)) ? (Number(x) | 0) : 0;
  const py = Number.isFinite(Number(y)) ? (Number(y) | 0) : 0;
  for (const [roomId, room] of world.query(RoomMetadata)) {
    if (String(room?.roomType || "") !== "shop") continue;
    const shopkeeperId = normId(room.shopkeeperId);
    if (!(shopkeeperId > 0)) continue;
    if (isInRoom(px, py, room)) {
      return { roomId: roomId | 0, room, shopkeeperId };
    }
  }
  return null;
}

export function findOwnerShop(world, shopkeeperId) {
  const owner = normId(shopkeeperId);
  if (!(owner > 0)) return null;
  for (const [roomId, room] of world.query(RoomMetadata)) {
    if (String(room?.roomType || "") !== "shop") continue;
    if (normId(room.shopkeeperId) !== owner) continue;
    return { roomId: roomId | 0, room, shopkeeperId: owner };
  }
  return null;
}

export function isInsideShopRoom(world, x, y, shopkeeperId) {
  const shop = findOwnerShop(world, shopkeeperId);
  if (!shop) return false;
  const px = Number.isFinite(Number(x)) ? (Number(x) | 0) : 0;
  const py = Number.isFinite(Number(y)) ? (Number(y) | 0) : 0;
  return isInRoom(px, py, shop.room);
}

function onItemThrown(world, ev = {}) {
  const actorId = normId(ev.actor);
  const itemId = normId(ev.itemId);
  if (!(actorId > 0) || !(itemId > 0)) return;
  const unpaid = world.get(itemId, Unpaid);
  if (!unpaid) return;

  const shopkeeperId = normId(unpaid.shopkeeperId);
  const from = normPoint(ev.from);
  const to = normPoint(ev.to);
  if (!from || !to) return;
  if (!isInsideShopRoom(world, from.x, from.y, shopkeeperId)) return;
  if (isInsideShopRoom(world, to.x, to.y, shopkeeperId)) return;

  recordUnpaidExtraction(world, {
    actorId,
    shopkeeperId,
    itemId,
    amount: unpaid.price,
    reason: ev.consumed === true ? "destroyed" : "thrown_out",
    evidence: "seen",
  });
}

function onItemDropped(world, ev = {}) {
  const actorId = normId(ev.actor);
  const itemId = normId(ev.itemId);
  if (!(actorId > 0) || !(itemId > 0)) return;
  const unpaid = world.get(itemId, Unpaid);
  if (!unpaid) return;

  const shopkeeperId = normId(unpaid.shopkeeperId);
  const at = normPoint(ev.at);
  if (!at || isInsideShopRoom(world, at.x, at.y, shopkeeperId)) return;

  recordUnpaidExtraction(world, {
    actorId,
    shopkeeperId,
    itemId,
    amount: unpaid.price,
    reason: "carried_out",
    evidence: "ledger",
  });
}

function onMoved(world, ev = {}) {
  const actorId = normId(ev.id ?? ev.actor);
  const from = normPoint(ev.from);
  const to = normPoint(ev.to);
  if (!(actorId > 0) || !from || !to) return;

  const distance = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  for (const [, room] of world.query(RoomMetadata)) {
    if (String(room?.roomType || "") !== "shop") continue;
    const shopkeeperId = normId(room.shopkeeperId);
    if (!(shopkeeperId > 0)) continue;
    if (!isInRoom(from.x, from.y, room) || isInRoom(to.x, to.y, room)) continue;

    const carriedBill = calculateCarriedUnpaidBill(
      world,
      actorId,
      shopkeeperId,
    );
    const debtTotal = calculateShopDebt(world, actorId, shopkeeperId);
    const bill = carriedBill + debtTotal;
    if (bill <= 0) continue;

    if (distance <= 1 && carriedBill <= 0) continue;
    recordShopClaim(world, {
      actorId,
      shopkeeperId,
      amount: bill,
      reason: distance > 1 ? "teleport_exit" : "carried_out",
      claimKind: distance > 1 ? "teleport_exit" : "carried_out",
      valueKind: distance > 1 ? "position" : "goods",
      evidence: "ledger",
      severity: distance > 1 ? 3 : undefined,
      createsDebt: false,
      recordIncident: true,
    });
  }
}

export function installShopLawListeners(world) {
  if (!world || world[INSTALLED]) return;
  world[INSTALLED] = true;

  world.on("item:thrown", (ev) => onItemThrown(world, ev));
  world.on("item:dropped", (ev) => onItemDropped(world, ev));
  world.on("moved", (ev) => onMoved(world, ev));
}

export {
  evaluateShopLawResponse,
  recordShopClaim,
  recordShopIncident,
  recordUnpaidExtraction,
  shopClaimRecords,
  shopIncidentRecords,
};
