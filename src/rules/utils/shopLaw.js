import { attach, children } from "../../lib/ecs-js/hierarchy.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { RoomMetadata } from "../components/RoomMetadata.js";
import { ShopIncident } from "../components/ShopIncident.js";
import { Unpaid } from "../components/Unpaid.js";
import { calculateCarriedUnpaidBill } from "./shopEnforcement.js";
import { calculateShopDebt, recordShopDebt } from "./shopDebt.js";
import { emitSafe } from "./emitSafe.js";

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

function itemIdentity(world, itemId) {
  return String(world.get(itemId, NamedIdentity)?.identity || "").toLowerCase();
}

function itemName(world, itemId) {
  const name = String(world.get(itemId, NamedIdentity)?.name || "");
  if (name) return name;
  return String(world.get(itemId, ItemInfo)?.name || "");
}

function inferSeverity(amount, reason) {
  const value = Math.max(0, Number(amount || 0));
  let severity = value >= 500
    ? 4
    : value >= 150
    ? 3
    : value >= 50
    ? 2
    : value > 0
    ? 1
    : 0;
  const r = String(reason || "");
  if (r === "teleport_exit" || r === "thrown_out" || r === "destroyed") {
    severity += 1;
  }
  return Math.max(0, Math.min(5, severity));
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

export function recordShopIncident(world, spec = {}) {
  const shopkeeperId = normId(spec.shopkeeperId);
  const actorId = normId(spec.actorId ?? spec.actor);
  if (!(shopkeeperId > 0) || !(actorId > 0)) return null;
  if (!world?.isAlive?.(shopkeeperId)) return null;

  const amount = Math.max(0, Math.ceil(Number(spec.amount || 0)));
  const reason = String(spec.reason || "carried_out");
  const incident = {
    shopkeeperId,
    actorId,
    itemId: normId(spec.itemId),
    amount,
    reason,
    evidence: String(spec.evidence || "ledger"),
    severity: Number.isFinite(spec.severity)
      ? Math.max(0, Number(spec.severity) | 0)
      : inferSeverity(amount, reason),
    createdTurn: Number.isFinite(spec.turn)
      ? (Number(spec.turn) | 0)
      : (Number(world.step || 0) | 0),
    resolved: spec.resolved === true,
  };

  const incidentId = world.create();
  world.add(incidentId, ShopIncident, incident);
  attach(world, incidentId, shopkeeperId);

  const rec = Object.freeze({ id: incidentId | 0, ...incident });
  emitSafe(world, "shop:incident-recorded", rec);
  return rec;
}

export function shopIncidentRecords(world, shopkeeperId = 0) {
  const owner = normId(shopkeeperId);
  const out = [];
  if (owner > 0) {
    for (const incidentId of children(world, owner)) {
      const incident = world.get(incidentId, ShopIncident);
      if (incident) {
        out.push(Object.freeze({ id: incidentId | 0, ...incident }));
      }
    }
    return out;
  }

  for (const [incidentId, incident] of world.query(ShopIncident)) {
    out.push(Object.freeze({ id: incidentId | 0, ...incident }));
  }
  return out;
}

export function evaluateShopLawResponse(_world, spec = {}) {
  const severity = Number.isFinite(spec.severity)
    ? (Number(spec.severity) | 0)
    : inferSeverity(spec.amount, spec.reason);
  const reason = String(spec.reason || "");
  return Object.freeze({
    severity,
    alarm: severity >= 4,
    pursuit: severity >= 3 || reason === "teleport_exit",
    escaped: reason === "teleport_exit" || reason === "thrown_out" ||
      reason === "destroyed",
  });
}

export function recordUnpaidExtraction(world, spec = {}) {
  const actorId = normId(spec.actorId ?? spec.actor);
  const shopkeeperId = normId(spec.shopkeeperId);
  const itemId = normId(spec.itemId);
  const amount = Math.max(0, Math.ceil(Number(spec.amount || 0)));
  if (!(actorId > 0) || !(shopkeeperId > 0) || amount <= 0) return null;

  const reason = String(spec.reason || "carried_out");
  const debt = recordShopDebt(world, {
    actorId,
    shopkeeperId,
    amount,
    reason,
    itemId,
    identity: String(
      spec.identity ?? (itemId > 0 ? itemIdentity(world, itemId) : ""),
    ),
    name: String(spec.name ?? (itemId > 0 ? itemName(world, itemId) : "")),
    turn: spec.turn,
  });
  if (!debt) return null;

  const incident = recordShopIncident(world, {
    actorId,
    shopkeeperId,
    itemId,
    amount,
    reason,
    evidence: spec.evidence || "ledger",
    severity: spec.severity,
    turn: spec.turn,
  });
  const response = evaluateShopLawResponse(
    world,
    incident || { amount, reason, severity: spec.severity },
  );
  const event = {
    actor: actorId,
    shopkeeperId,
    itemId,
    amount,
    reason,
    debt,
    incident,
    response,
  };
  emitSafe(world, "shop:debt-created", {
    debtorId: actorId,
    shopkeeperId,
    amount: debt.amount,
    reason: debt.reason,
    itemId: debt.itemId,
    identity: debt.identity,
  });
  if (response.escaped) emitSafe(world, "shop:theft-escaped", event);
  if (response.pursuit) emitSafe(world, "shop:pursuit-requested", event);
  if (response.alarm) emitSafe(world, "shop:alarm", event);
  return Object.freeze(event);
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

function onUnauthorizedUse(world, ev = {}) {
  const actorId = normId(ev.actor);
  const shopkeeperId = normId(ev.shopkeeperId);
  const amount = Math.max(0, Math.ceil(Number(ev.amount || 0)));
  if (!(actorId > 0) || !(shopkeeperId > 0) || amount <= 0) return;
  const rawReason = String(ev.reason || "unauthorized_use");
  const reason = rawReason === "consumption_theft" ? "consumed" : rawReason;
  recordShopIncident(world, {
    actorId,
    shopkeeperId,
    itemId: normId(ev.itemId),
    amount,
    reason,
    evidence: rawReason === "knowledge_theft" ? "ledger" : "arcane_mark",
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
    recordShopIncident(world, {
      actorId,
      shopkeeperId,
      amount: bill,
      reason: distance > 1 ? "teleport_exit" : "carried_out",
      evidence: "ledger",
      severity: distance > 1 ? 3 : undefined,
    });
    const response = evaluateShopLawResponse(world, {
      amount: bill,
      reason: distance > 1 ? "teleport_exit" : "carried_out",
      severity: distance > 1 ? 3 : undefined,
    });
    const event = {
      actor: actorId,
      shopkeeperId,
      amount: bill,
      reason: distance > 1 ? "teleport_exit" : "carried_out",
      response,
    };
    emitSafe(world, "shop:theft-escaped", event);
    if (response.pursuit) emitSafe(world, "shop:pursuit-requested", event);
    if (response.alarm) emitSafe(world, "shop:alarm", event);
  }
}

export function installShopLawListeners(world) {
  if (!world || world[INSTALLED]) return;
  world[INSTALLED] = true;

  world.on("item:thrown", (ev) => onItemThrown(world, ev));
  world.on("item:dropped", (ev) => onItemDropped(world, ev));
  world.on("shop:unauthorized-use", (ev) => onUnauthorizedUse(world, ev));
  world.on("moved", (ev) => onMoved(world, ev));
}
