import { Beatitude } from "../../../rules/components/Beatitude.js";
import { NamedIdentity } from "../../../rules/components/NamedIdentity.js";
import { Position } from "../../../rules/components/Position.js";
import { applyWaterExposure } from "../../../rules/utils/waterExposure.js";
import { spawnMonsterEntity } from "../../../rules/utils/spawnMonsterEntity.js";
import { findNearestValidTileAround } from "../../../rules/utils/queries.js";
import { FountainDipResolved } from "../../../events/FountainDipResolved.js";

function emit(ctx, payload) {
  ctx.world.emit(new FountainDipResolved({
    actor: ctx.actor,
    targetId: ctx.targetId,
    itemId: ctx.intent.itemId,
    ...payload,
  }));
}

export function resolveFountainDip(ctx, rng) {
  const { world, actor, targetId } = ctx;
  const itemId = ctx.intent.itemId | 0;
  const itemName = world.get(itemId, NamedIdentity)?.name || "the item";
  const previous = String(world.get(itemId, Beatitude)?.state || "uncursed");
  const roll = rng();

  if (roll < 0.30) {
    if (previous === "cursed") {
      world.set(itemId, Beatitude, { state: "uncursed" });
      emit(ctx, { effect: "uncurse", itemName });
    } else emit(ctx, { effect: "nothing", itemName });
    return;
  }
  if (roll < 0.50) {
    if (previous === "uncursed") {
      world.set(itemId, Beatitude, { state: "blessed" });
      emit(ctx, { effect: "bless", itemName });
    } else emit(ctx, { effect: "nothing", itemName });
    return;
  }
  if (roll < 0.65) {
    if (previous !== "cursed") {
      world.set(itemId, Beatitude, { state: "cursed" });
      emit(ctx, { effect: "curse", itemName });
    } else emit(ctx, { effect: "nothing", itemName });
    return;
  }
  if (roll < 0.80) {
    emit(ctx, { effect: "nothing", itemName });
    return;
  }
  if (roll < 0.90) {
    const exposure = applyWaterExposure(world, itemId, { actor, sourceId: targetId, waterType: "plain" });
    emit(ctx, {
      effect: String(exposure?.effect || "wet"),
      itemName,
      stacks: Number(exposure?.stacks || 0) | 0,
      ruined: exposure?.ruined === true,
    });
    return;
  }

  const pos = world.get(targetId, Position);
  const tile = pos ? findNearestValidTileAround(world, pos, { maxDistance: 2 }) : null;
  let spawnedName = null;
  if (tile) {
    const def = rng() < 0.5
      ? { name: "Water Nymph", identity: "nymph", maxHp: 14, baseHp: 14, attack: 2, defense: 1, damageDice: "1d4", faction: "enemy", speed: 3 }
      : { name: "Water Snake", identity: "cave_snake", maxHp: 10, baseHp: 10, attack: 3, defense: 0, damageDice: "1d6", faction: "enemy", speed: 2 };
    if (spawnMonsterEntity(world, { ...def, x: tile.x, y: tile.y }) > 0) spawnedName = def.name;
  }
  emit(ctx, { effect: "creature", itemName, spawnedName });
}
