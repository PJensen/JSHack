import { Alignment } from "../components/Alignment.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Unpaid } from "../components/Unpaid.js";
import { inventoryItems } from "./inventoryFacade.js";
import { calculateShopDebt, shopDebtRecords } from "./shopDebt.js";

export const SHOP_ENFORCEMENT_DECISIONS = Object.freeze({
  allow: "allow",
  demandPayment: "demand_payment",
  creditExtended: "credit_extended",
  containment: "containment",
  debtRefused: "debt_refused",
});

export function calculateCarriedUnpaidBill(world, actorId, shopkeeperId) {
  let total = 0;
  for (const itemId of inventoryItems(world, actorId)) {
    const unpaid = world.get(itemId, Unpaid);
    if (unpaid && unpaid.shopkeeperId === shopkeeperId) total += unpaid.price;
  }
  return total;
}

export function countCarriedUnpaidItems(world, actorId, shopkeeperId) {
  let count = 0;
  for (const itemId of inventoryItems(world, actorId)) {
    const unpaid = world.get(itemId, Unpaid);
    if (unpaid && unpaid.shopkeeperId === shopkeeperId) count += 1;
  }
  return count;
}

export function countGold(world, actorId) {
  let total = 0;
  for (const id of inventoryItems(world, actorId)) {
    const info = world.get(id, ItemInfo);
    if (info && info.type === "currency") total += Math.max(0, Number(info.count || 0));
  }
  return total;
}

function alignmentCreditBonus(world, actorId) {
  const alignment = world.get(actorId, Alignment);
  let bonus = 0;
  if (alignment?.lawChaos === "lawful") bonus += 20;
  if (alignment?.lawChaos === "chaotic") bonus -= 20;
  if (alignment?.goodEvil === "good") bonus += 10;
  if (alignment?.goodEvil === "evil") bonus -= 10;
  return bonus;
}

function oldestDebtAge(world, debts) {
  const now = Number(world.step || 0) | 0;
  let oldest = 0;
  for (const debt of debts) {
    const age = Math.max(0, now - (Number(debt?.createdTurn ?? debt?.turn ?? now) | 0));
    if (age > oldest) oldest = age;
  }
  return oldest;
}

export function evaluateShopExitClaim(world, {
  actorId,
  shopkeeperId,
  policy = {},
} = {}) {
  const actor = Number(actorId || 0) | 0;
  const shopkeeper = Number(shopkeeperId || 0) | 0;
  const carriedBill = calculateCarriedUnpaidBill(world, actor, shopkeeper);
  const debtTotal = calculateShopDebt(world, actor, shopkeeper);
  const bill = carriedBill + debtTotal;
  const carriedCount = countCarriedUnpaidItems(world, actor, shopkeeper);
  const debtRecords = shopDebtRecords(world, actor, shopkeeper);
  const debtCount = debtRecords.length;
  const debtAge = oldestDebtAge(world, debtRecords);
  const gold = countGold(world, actor);
  const canPay = gold >= bill;

  const trustedCreditLimit = Math.max(0, Number(policy.trustedCreditLimit ?? 75));
  const baseCreditLimit = Math.max(0, Number(policy.creditLimit ?? 25));
  const debtAgePenalty = Math.floor(debtAge / Math.max(1, Number(policy.agePenaltyTurns ?? 25))) * 10;
  const creditScore = alignmentCreditBonus(world, actor)
    - Math.max(0, bill - baseCreditLimit)
    - Math.max(0, debtCount - 1) * 20
    - carriedCount * 15
    - debtAgePenalty;

  const reasons = [];
  if (carriedBill > 0) reasons.push("carried_unpaid_goods");
  if (debtTotal > 0) reasons.push("unpaid_extracted_value");
  if (debtCount > 1) reasons.push("repeat_debt");
  if (debtAge > 0) reasons.push("aged_debt");
  if (canPay) reasons.push("can_pay_now");
  else if (bill > 0) reasons.push("cannot_pay_now");

  if (bill <= 0) {
    return Object.freeze({
      kind: SHOP_ENFORCEMENT_DECISIONS.allow,
      blocksExit: false,
      bill,
      carriedBill,
      debtTotal,
      carriedCount,
      debtCount,
      debtAge,
      gold,
      canPay,
      creditScore,
      reasons: Object.freeze(reasons),
    });
  }

  let kind = SHOP_ENFORCEMENT_DECISIONS.containment;
  let blocksExit = true;
  if (canPay) {
    kind = SHOP_ENFORCEMENT_DECISIONS.demandPayment;
  } else if (carriedBill <= 0 && debtTotal <= trustedCreditLimit && creditScore >= 0) {
    kind = SHOP_ENFORCEMENT_DECISIONS.creditExtended;
    blocksExit = false;
  } else if (debtAge >= Number(policy.refusalAgeTurns ?? 50) || debtCount >= Number(policy.refusalDebtCount ?? 3)) {
    kind = SHOP_ENFORCEMENT_DECISIONS.debtRefused;
  }

  return Object.freeze({
    kind,
    blocksExit,
    bill,
    carriedBill,
    debtTotal,
    carriedCount,
    debtCount,
    debtAge,
    gold,
    canPay,
    creditScore,
    reasons: Object.freeze(reasons),
  });
}
