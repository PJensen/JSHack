import { FountainState } from "../components/FountainState.js";
import { Position } from "../components/Position.js";
import { currentDepth } from "../utils/worldAccess.js";
import { FountainRefilled } from "../../events/FountainRefilled.js";

const FOUNTAIN_SOURCE_DB_AT_1_TILE = 80;
const FOUNTAIN_CLARITY = Object.freeze({
  far: "you hear faint gurgling",
  mid: "you hear running water",
  near: "you hear water gushing to life",
});

/** Refill every dry fountain whose durable cooldown has elapsed. */
export function fountainRegrowthSystem(world) {
  const nowStep = Number(world.step || 0) | 0;
  const depth = currentDepth(world, 0);
  for (const [targetId, state] of world.query(FountainState)) {
    if (state.chargesRemaining > 0 || state.maxCharges <= 0) continue;
    if (state.dryUntilStep < 0 || nowStep < state.dryUntilStep) continue;

    world.set(targetId, FountainState, {
      ...state,
      chargesRemaining: state.maxCharges,
      dryUntilStep: -1,
    });
    world.emit(new FountainRefilled({
      targetId,
      chargesRemaining: state.maxCharges,
      cooldownTurns: state.cooldownTurns,
    }));

    const pos = world.get(targetId, Position);
    world.emit("ambient:sound", {
      source: "fountain",
      at: { x: Number(pos?.x || 0) | 0, y: Number(pos?.y || 0) | 0 },
      depth,
      sourceDbAt1Tile: FOUNTAIN_SOURCE_DB_AT_1_TILE,
      clarity: FOUNTAIN_CLARITY,
      targetId,
    });
  }
}
