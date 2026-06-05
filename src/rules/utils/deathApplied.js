import { normalizeGridPoint } from "../../shared/math/point.js";
import { DeathApplied } from "../components/DeathApplied.js";
import { Lifespan } from "../components/Lifespan.js";

/**
 * Create a one-turn death record for scheduled rules-side reactions.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {Partial<DeathApplied["defaults"]>} data
 * @returns {number}
 */
export function recordDeathApplied(world, data) {
  const id = world.create();
  world.add(id, DeathApplied, {
    ...data,
    target: Number(data.target || data.id || 0) | 0,
    killer: Number(data.killer || 0) | 0,
    cause: String(data.cause || ""),
    weaponId: Number(data.weaponId || 0) | 0,
    weaponFamily: String(data.weaponFamily || ""),
    damageType: String(data.damageType || ""),
    critical: !!data.critical,
    amount: Number(data.amount || 0) | 0,
    goreType: String(data.goreType || ""),
    sizeClass: String(data.sizeClass || ""),
    targetKind: String(data.targetKind || ""),
    at: normalizeGridPoint(data.at),
    step: Number(data.step ?? world.step ?? 0) | 0,
  });
  world.add(id, Lifespan, { turnsLeft: 1, onExpiry: "remove", expiryEvent: "" });
  return id;
}
