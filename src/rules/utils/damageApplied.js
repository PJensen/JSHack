import { DamageApplied } from "../components/DamageApplied.js";
import { Lifespan } from "../components/Lifespan.js";

/**
 * Create a one-turn damage record for scheduled rules-side reactions.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {Partial<DamageApplied["defaults"]>} data
 * @returns {number}
 */
export function recordDamageApplied(world, data) {
  const id = world.create();
  world.add(id, DamageApplied, {
    ...data,
    target: Number(data.target || 0) | 0,
    source: Number(data.source || 0) | 0,
    amount: Number(data.amount || 0) | 0,
    hpBefore: Number(data.hpBefore || 0) | 0,
    hpAfter: Number(data.hpAfter || 0) | 0,
    maxHp: Number(data.maxHp || 0) | 0,
    rawAmount: Number(data.rawAmount || 0) | 0,
    type: String(data.type || ""),
    cause: String(data.cause || ""),
    critical: !!data.critical,
    weaponId: Number(data.weaponId || 0) | 0,
    weaponFamily: String(data.weaponFamily || ""),
    offhand: !!data.offhand,
    step: Number(data.step ?? world.step ?? 0) | 0,
  });
  world.add(id, Lifespan, { turnsLeft: 1, onExpiry: "remove", expiryEvent: "" });
  return id;
}
