import { HealingApplied } from "../components/HealingApplied.js";
import { Lifespan } from "../components/Lifespan.js";

/** Create a one-turn healing record for scheduled rules-side reactions. */
export function recordHealingApplied(world, data) {
  const id = world.create();
  world.add(id, HealingApplied, {
    target: Number(data.target || 0) | 0,
    source: Number(data.source || 0) | 0,
    amount: Number(data.amount || 0) | 0,
    hpBefore: Number(data.hpBefore || 0) | 0,
    hpAfter: Number(data.hpAfter || 0) | 0,
    maxHp: Number(data.maxHp || 0) | 0,
    rawAmount: Number(data.rawAmount || 0) | 0,
    resolvedAmount: Number(data.resolvedAmount || 0) | 0,
    cause: String(data.cause || ""),
    step: Number(data.step ?? world.step ?? 0) | 0,
  });
  world.add(id, Lifespan, { turnsLeft: 1, onExpiry: "remove", expiryEvent: "" });
  return id;
}
