import { attach, children, detach } from "../../lib/ecs-js/hierarchy.js";
import { ShopDebt, SHOP_DEBT_STATUS } from "../components/ShopDebt.js";

const DEFINED = Symbol.for("jshack:shopDebtVirtuals:defined");
const SHOP_DEBT_VIEW_KEY = Symbol.for("jshack:shopDebtVirtuals:ShopDebtView");

function getShopDebtVirtual(world) {
  return world?.[SHOP_DEBT_VIEW_KEY] || null;
}

function clearDebtVirtual(world) {
  const Virtual = getShopDebtVirtual(world);
  if (Virtual && typeof world?.vclear === "function") world.vclear(Virtual);
}

function normalizeDebtRecord(debtId, debt) {
  return Object.freeze({
    id: debtId | 0,
    shopkeeperId: Number(debt?.shopkeeperId || 0) | 0,
    amount: Math.max(0, Number(debt?.amount || 0)),
    reason: String(debt?.reason || "unauthorized_use"),
    itemId: Number(debt?.itemId || 0) | 0,
    identity: String(debt?.identity || ""),
    name: String(debt?.name || ""),
    turn: Number(debt?.createdTurn || 0) | 0,
    createdTurn: Number(debt?.createdTurn || 0) | 0,
    status: String(debt?.status || SHOP_DEBT_STATUS.unpaid),
  });
}

function collectShopDebtView(world, actorId) {
  const debts = [];
  const byShopkeeper = {};
  let total = 0;
  if (!(actorId > 0) || !world?.isAlive?.(actorId)) {
    return Object.freeze({ debts: Object.freeze(debts), byShopkeeper: Object.freeze(byShopkeeper), total });
  }

  for (const debtId of children(world, actorId)) {
    const debt = /** @type any */ (world.get(debtId, ShopDebt));
    if (!debt || String(debt.status || SHOP_DEBT_STATUS.unpaid) !== SHOP_DEBT_STATUS.unpaid) continue;
    const rec = normalizeDebtRecord(debtId, debt);
    if (!(rec.shopkeeperId > 0) || rec.amount <= 0) continue;
    debts.push(rec);
    total += rec.amount;

    const key = String(rec.shopkeeperId);
    const prev = byShopkeeper[key] || { total: 0, debts: [] };
    prev.total += rec.amount;
    prev.debts.push(rec);
    byShopkeeper[key] = prev;
  }

  for (const key of Object.keys(byShopkeeper)) {
    byShopkeeper[key] = Object.freeze({
      total: byShopkeeper[key].total,
      debts: Object.freeze(byShopkeeper[key].debts.slice()),
    });
  }

  return Object.freeze({
    debts: Object.freeze(debts),
    byShopkeeper: Object.freeze(byShopkeeper),
    total,
  });
}

export function defineShopDebtVirtuals(world) {
  if (world[DEFINED]) return;
  if (typeof world?.defineVirtual !== "function" || typeof world?.vget !== "function") {
    throw new Error("defineShopDebtVirtuals: installVirtuals(world) must run first");
  }
  world[DEFINED] = true;
  world[SHOP_DEBT_VIEW_KEY] = world.defineVirtual("ShopDebtView", (world, actorId) => collectShopDebtView(world, actorId | 0));
}

export function getShopDebtViewVirtual(world) {
  return getShopDebtVirtual(world);
}

export function getShopDebtView(world, actorId) {
  const Virtual = getShopDebtVirtual(world);
  if (Virtual && typeof world?.vget === "function") return world.vget(actorId | 0, Virtual);
  return collectShopDebtView(world, actorId | 0);
}

export function recordShopDebt(world, spec) {
  const actorId = Number(spec?.actorId || 0) | 0;
  const shopkeeperId = Number(spec?.shopkeeperId || 0) | 0;
  const amount = Math.max(0, Math.ceil(Number(spec?.amount || 0)));
  if (!(actorId > 0) || !(shopkeeperId > 0) || amount <= 0) return null;
  if (!world?.isAlive?.(actorId)) return null;

  const debtId = world.create();
  const debt = {
    shopkeeperId,
    amount,
    reason: String(spec?.reason || "unauthorized_use"),
    itemId: Number(spec?.itemId || 0) | 0,
    identity: String(spec?.identity || ""),
    name: String(spec?.name || ""),
    createdTurn: Number.isFinite(spec?.turn) ? (Number(spec.turn) | 0) : (Number(world.step || 0) | 0),
    status: SHOP_DEBT_STATUS.unpaid,
  };
  world.add(debtId, ShopDebt, debt);
  attach(world, debtId, actorId);
  clearDebtVirtual(world);
  return normalizeDebtRecord(debtId, debt);
}

export function shopDebtRecords(world, actorId, shopkeeperId = 0) {
  const view = getShopDebtView(world, actorId);
  const sid = Number(shopkeeperId || 0) | 0;
  if (!(sid > 0)) return Array.from(view.debts || []);
  return Array.from(view.byShopkeeper?.[String(sid)]?.debts || []);
}

export function calculateShopDebt(world, actorId, shopkeeperId = 0) {
  const view = getShopDebtView(world, actorId);
  const sid = Number(shopkeeperId || 0) | 0;
  if (!(sid > 0)) return Math.max(0, Number(view.total || 0));
  return Math.max(0, Number(view.byShopkeeper?.[String(sid)]?.total || 0));
}

export function clearShopDebt(world, actorId, shopkeeperId = 0) {
  const sid = Number(shopkeeperId || 0) | 0;
  const toClear = [];
  for (const debtId of children(world, actorId | 0)) {
    const debt = /** @type any */ (world.get(debtId, ShopDebt));
    if (!debt || String(debt.status || SHOP_DEBT_STATUS.unpaid) !== SHOP_DEBT_STATUS.unpaid) continue;
    if (sid > 0 && (Number(debt.shopkeeperId || 0) | 0) !== sid) continue;
    toClear.push(debtId);
  }

  for (const debtId of toClear) {
    try { detach(world, debtId, { remove: true }); } catch {}
    try { world.destroy(debtId); } catch {}
  }
  if (toClear.length > 0) clearDebtVirtual(world);
  return toClear.length;
}
