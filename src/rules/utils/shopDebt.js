import { ShopDebtLedger } from "../components/ShopDebtLedger.js";

function ensureLedger(world, actorId) {
  let ledger = /** @type any */ (world.get(actorId, ShopDebtLedger));
  if (!ledger) {
    try { world.add(actorId, ShopDebtLedger, { debts: [] }); } catch {}
    ledger = /** @type any */ (world.get(actorId, ShopDebtLedger));
  }
  if (ledger && !Array.isArray(ledger.debts)) ledger.debts = [];
  return ledger;
}

export function recordShopDebt(world, spec) {
  const actorId = Number(spec?.actorId || 0) | 0;
  const shopkeeperId = Number(spec?.shopkeeperId || 0) | 0;
  const amount = Math.max(0, Math.ceil(Number(spec?.amount || 0)));
  if (!(actorId > 0) || !(shopkeeperId > 0) || amount <= 0) return null;

  const ledger = ensureLedger(world, actorId);
  if (!ledger) return null;

  const debt = {
    shopkeeperId,
    amount,
    reason: String(spec?.reason || "unauthorized_use"),
    itemId: Number(spec?.itemId || 0) | 0,
    identity: String(spec?.identity || ""),
    name: String(spec?.name || ""),
    turn: Number.isFinite(spec?.turn) ? (Number(spec.turn) | 0) : (Number(world.step || 0) | 0),
  };
  ledger.debts.push(debt);
  return debt;
}

export function shopDebtRecords(world, actorId, shopkeeperId = 0) {
  const ledger = /** @type any */ (world.get(actorId, ShopDebtLedger));
  const debts = Array.isArray(ledger?.debts) ? ledger.debts : [];
  const sid = Number(shopkeeperId || 0) | 0;
  if (!(sid > 0)) return debts.slice();
  return debts.filter((debt) => (Number(debt?.shopkeeperId || 0) | 0) === sid);
}

export function calculateShopDebt(world, actorId, shopkeeperId = 0) {
  let total = 0;
  for (const debt of shopDebtRecords(world, actorId, shopkeeperId)) {
    total += Math.max(0, Number(debt?.amount || 0));
  }
  return total;
}

export function clearShopDebt(world, actorId, shopkeeperId = 0) {
  const ledger = /** @type any */ (world.get(actorId, ShopDebtLedger));
  if (!ledger || !Array.isArray(ledger.debts)) return 0;
  const sid = Number(shopkeeperId || 0) | 0;
  const before = ledger.debts.length;
  if (sid > 0) {
    ledger.debts = ledger.debts.filter((debt) => (Number(debt?.shopkeeperId || 0) | 0) !== sid);
  } else {
    ledger.debts = [];
  }
  return before - ledger.debts.length;
}
