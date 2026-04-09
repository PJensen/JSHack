import { Interactable } from "../components/Interactable.js";
import { Position } from "../components/Position.js";
import { currentDepth } from "../utils/worldAccess.js";

const FOUNTAIN_SOURCE_DB_AT_1_TILE = 80;

const FOUNTAIN_CLARITY = Object.freeze({
  far: "you hear faint gurgling",
  mid: "you hear running water",
  near: "you hear water gushing to life",
});

/**
 * Refill dry fountains as soon as cooldown expires.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
export function fountainRegrowthSystem(world) {
  const nowStep = Number(world.step || 0) | 0;
  const depth = currentDepth(world, 0);

  for (const [targetId, inter, pos] of world.query(Interactable, Position)) {
    if (String(inter?.action || "") !== "drinkFountain") continue;

    const params = (inter.params && typeof inter.params === "object")
      ? { ...inter.params }
      : {};
    const chargesRemaining = Math.max(0, Number(params.chargesRemaining || 0) | 0);
    const maxCharges = Math.max(1, Number(params.maxCharges || 1) | 0);
    const cooldownTurns = Math.max(1, Number(params.cooldownTurns || 1) | 0);
    const dryUntilStep = Number(params.dryUntilStep ?? -1);

    if (chargesRemaining > 0) continue;
    if (!Number.isFinite(dryUntilStep) || dryUntilStep < 0) continue;
    if (nowStep < (dryUntilStep | 0)) continue;

    params.chargesRemaining = maxCharges;
    params.maxCharges = maxCharges;
    params.cooldownTurns = cooldownTurns;
    params.dryUntilStep = -1;
    world.set(targetId, Interactable, { action: inter.action, params });

    world.emit?.("fountain:refilled", {
      targetId,
      chargesRemaining: maxCharges,
      cooldownTurns,
    });
    world.emit?.("ambient:sound", {
      source: "fountain",
      at: { x: Number(pos?.x || 0) | 0, y: Number(pos?.y || 0) | 0 },
      depth,
      sourceDbAt1Tile: FOUNTAIN_SOURCE_DB_AT_1_TILE,
      clarity: FOUNTAIN_CLARITY,
      targetId,
    });
  }
}
