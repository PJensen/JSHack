import { Unpaid } from "../components/Unpaid.js";

function unauthorizedUseLine(reason, amount) {
  const charge = Math.max(0, Number(amount || 0) | 0);
  if (String(reason || "") === "knowledge_theft") {
    return `That knowledge is not free. You owe me ${charge} gold.`;
  }
  if (String(reason || "") === "consumption_theft") {
    return `You drink it, you buy it. That is ${charge} gold.`;
  }
  return `That is not free. You owe me ${charge} gold.`;
}

/**
 * Queue persistent shop debt for value extracted from unpaid merchandise.
 * This is intentionally interaction-context shaped so item verbs share one
 * commerce path without mutating from content hooks.
 */
export function queueShopDebtForUnauthorizedUse(ctx, spec = {}) {
  const actorId = Number(spec.actorId || ctx?.actor || 0) | 0;
  const itemId = Number(spec.itemId || ctx?.primary || 0) | 0;
  if (!(actorId > 0) || !(itemId > 0)) return null;

  const unpaid = ctx?.query?.get?.(itemId, Unpaid);
  if (!unpaid || !(Number(unpaid.shopkeeperId || 0) > 0)) return null;

  const amount = Math.max(0, Math.ceil(Number(spec.amount ?? unpaid.price ?? 0)));
  if (amount <= 0) return null;

  const identity = String(spec.identity ?? ctx?.query?.identity?.(itemId) ?? "").toLowerCase();
  const reason = String(spec.reason || "unauthorized_use");
  const record = {
    type: "recordShopDebt",
    actorId,
    shopkeeperId: unpaid.shopkeeperId | 0,
    amount,
    reason,
    itemId,
    identity,
    name: String(spec.name ?? ctx?.query?.name?.(itemId) ?? ""),
  };

  ctx.mutate.queue(record);
  ctx.io.emit("shop:unauthorized-use", {
    actor: actorId,
    shopkeeperId: record.shopkeeperId,
    itemId,
    identity,
    amount,
    reason,
  });
  ctx.io.emit("npc:dialogue", {
    actor: record.shopkeeperId,
    targetId: actorId,
    text: unauthorizedUseLine(reason, amount),
    source: "shop:unauthorized-use",
  });

  return record;
}
