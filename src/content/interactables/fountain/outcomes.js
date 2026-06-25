import { Vitality } from "../../../rules/components/Vitality.js";
import { Mana } from "../../../rules/components/Mana.js";
import { Position } from "../../../rules/components/Position.js";
import { ItemInfo } from "../../../rules/components/ItemInfo.js";
import { Beatitude } from "../../../rules/components/Beatitude.js";
import { NamedIdentity } from "../../../rules/components/NamedIdentity.js";
import { DungeonState } from "../../../rules/components/DungeonState.js";
import { GoldStack } from "../../../rules/archetypes/Items.js";
import { createFrom } from "../../../lib/ecs-js/archetype.js";
import { createRng } from "../../../lib/ecs-js/rng.js";
import { effectiveMaxHp, effectiveMaxMana } from "../../../rules/utils/passiveBonuses.js";
import { ensureActiveEffects } from "../../../rules/utils/effects.js";
import { upsertTimedEffect } from "../../../rules/utils/effectSemantics.js";
import { inventoryItems } from "../../../rules/utils/inventoryFacade.js";
import { dealDamage } from "../../../rules/utils/dealDamage.js";
import { spawnMonsterEntity } from "../../../rules/utils/spawnMonsterEntity.js";
import { findNearestValidTileAround } from "../../../rules/utils/queries.js";
import { forEachLoadedTile, getTile, isWalkable, setTile } from "../../../rules/environment/dungeon/tileMap.js";
import { TILE_SHALLOW_WATER } from "../../../rules/environment/dungeon/constants.js";
import { resolveLootTable, materializeDrop } from "../../../rules/data/lootResolver.js";
import { FountainDrinkResolved } from "../../../events/FountainDrinkResolved.js";

function emit(ctx, payload) {
  ctx.world.emit(new FountainDrinkResolved({ actor: ctx.actor, targetId: ctx.targetId, ...payload }));
}

function primary(ctx) {
  const { world, actor, state, rng } = ctx;
  const vit = world.get(actor, Vitality);
  if (state.primaryEffect === "heal") {
    const cap = effectiveMaxHp(world, actor, vit);
    const previous = vit.hp;
    const hp = Math.min(cap, previous + Math.max(1, Math.floor(cap * (0.2 + rng() * 0.2))));
    world.set(actor, Vitality, { ...vit, hp });
    emit(ctx, { effect: "heal", amount: hp - previous });
    return;
  }
  const mana = world.get(actor, Mana);
  if (!mana || mana.maxMana <= 0) {
    emit(ctx, { effect: "nothing" });
    return;
  }
  const cap = effectiveMaxMana(world, actor, mana);
  const previous = mana.mana;
  const next = Math.min(cap, previous + Math.max(1, Math.floor(cap * 0.3)));
  world.set(actor, Mana, { ...mana, mana: next });
  emit(ctx, { effect: "mana", amount: next - previous });
}

function buff(ctx) {
  const buffs = ["lucky", "keen_eye", "bear_vigor"];
  const buff = buffs[Math.floor(ctx.rng() * buffs.length)];
  const turns = 30 + Math.floor(ctx.rng() * 40);
  const effects = ensureActiveEffects(ctx.world, ctx.actor);
  if (effects) upsertTimedEffect(effects.effects, { key: buff, turnsLeft: turns, potency: 1 });
  emit(ctx, { effect: "buff", buff, turns });
}

function seeInvisible(ctx) {
  const turns = 40 + Math.floor(ctx.rng() * 60);
  const effects = ensureActiveEffects(ctx.world, ctx.actor);
  if (effects) upsertTimedEffect(effects.effects, { key: "esp_sense", turnsLeft: turns, potency: 1 });
  emit(ctx, { effect: "see_invisible", turns });
}

function nothing(ctx) { emit(ctx, { effect: "nothing" }); }

function gold(ctx) {
  const pos = ctx.world.get(ctx.targetId, Position);
  const amount = 8 + Math.floor(ctx.rng() * 25);
  if (pos) {
    const id = createFrom(ctx.world, GoldStack, { x: pos.x, y: pos.y });
    if (id > 0 && !ctx.world.has(id, Position)) ctx.world.add(id, Position, { x: pos.x, y: pos.y });
    const info = id > 0 ? ctx.world.get(id, ItemInfo) : null;
    if (info) ctx.world.set(id, ItemInfo, { ...info, count: amount });
  }
  emit(ctx, { effect: "gold", amount });
}

function curse(ctx) {
  const candidates = inventoryItems(ctx.world, ctx.actor).filter((id) => {
    if (!ctx.world.isAlive(id)) return false;
    return String(ctx.world.get(id, Beatitude)?.state || "uncursed") !== "cursed";
  });
  let cursedName = null;
  if (candidates.length > 0) {
    const id = candidates[Math.floor(ctx.rng() * candidates.length)];
    ctx.world.set(id, Beatitude, { state: "cursed" });
    cursedName = ctx.world.get(id, NamedIdentity)?.name || "an item";
  }
  emit(ctx, { effect: "curse", cursedName });
}

function poison(ctx) {
  const vit = ctx.world.get(ctx.actor, Vitality);
  const amount = Math.max(1, Math.floor(vit.maxHp * (0.05 + ctx.rng() * 0.05)));
  dealDamage(ctx.world, { target: ctx.actor, amount, type: "poison", source: ctx.targetId, cause: "fountain" });
  emit(ctx, { effect: "poison", amount });
}

function creature(ctx) {
  const pos = ctx.world.get(ctx.targetId, Position);
  const tile = pos ? findNearestValidTileAround(ctx.world, pos, { maxDistance: 2 }) : null;
  let spawnedName = null;
  if (tile) {
    const def = ctx.rng() < 0.5
      ? { name: "Water Nymph", identity: "nymph", maxHp: 14, baseHp: 14, attack: 2, defense: 1, damageDice: "1d4", faction: "enemy", speed: 3 }
      : { name: "Water Snake", identity: "cave_snake", maxHp: 10, baseHp: 10, attack: 3, defense: 0, damageDice: "1d6", faction: "enemy", speed: 2 };
    if (spawnMonsterEntity(ctx.world, { ...def, x: tile.x, y: tile.y }) > 0) spawnedName = def.name;
  }
  emit(ctx, { effect: "creature", spawnedName });
}

function teleport(ctx) {
  const pos = ctx.world.get(ctx.actor, Position);
  if (!pos) return nothing(ctx);
  const from = { x: pos.x | 0, y: pos.y | 0 };
  const candidates = [];
  forEachLoadedTile((x, y) => {
    if (!isWalkable(x, y)) return;
    const dx = x - from.x;
    const dy = y - from.y;
    if ((dx * dx) + (dy * dy) >= 36) candidates.push({ x, y });
  });
  if (candidates.length === 0) return nothing(ctx);
  const to = candidates[Math.floor(ctx.rng() * candidates.length)];
  ctx.world.set(ctx.actor, Position, to);
  ctx.world.emit("moved", { id: ctx.actor, from, to });
  ctx.world.emit("teleported", { id: ctx.actor, from, to, source: "fountain" });
  emit(ctx, { effect: "teleport", from, to });
}

function gush(ctx) {
  const pos = ctx.world.get(ctx.targetId, Position);
  let tilesFlooded = 0;
  if (pos) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if ((dx * dx) + (dy * dy) > 5) continue;
        const x = (pos.x | 0) + dx;
        const y = (pos.y | 0) + dy;
        if (getTile(x, y) === TILE_SHALLOW_WATER || !isWalkable(x, y)) continue;
        setTile(x, y, TILE_SHALLOW_WATER);
        tilesFlooded++;
      }
    }
  }
  emit(ctx, { effect: "gush", tilesFlooded });
}

function wish(ctx) {
  const pos = ctx.world.get(ctx.targetId, Position);
  let wishedItem = null;
  if (pos) {
    let depth = 1;
    for (const [, state] of ctx.world.query(DungeonState)) depth = Math.max(1, Number(state.currentDepth || 1));
    const rng = createRng((ctx.world.seed ^ (ctx.targetId * 0xBEEF) ^ (ctx.world.step * 0x1337)) >>> 0);
    const drop = resolveLootTable("chest:magic", rng, depth, 0, {})[0];
    const id = drop ? materializeDrop(ctx.world, drop, pos) : 0;
    if (id > 0) wishedItem = ctx.world.get(id, NamedIdentity)?.name || "something";
  }
  emit(ctx, { effect: "wish", wishedItem });
}

export const FOUNTAIN_DRINK_OUTCOMES = Object.freeze([
  Object.freeze({ id: "primary", weight: 30, run: primary }),
  Object.freeze({ id: "buff", weight: 12, run: buff }),
  Object.freeze({ id: "see_invisible", weight: 10, run: seeInvisible }),
  Object.freeze({ id: "nothing", weight: 8, run: nothing }),
  Object.freeze({ id: "gold", weight: 8, run: gold }),
  Object.freeze({ id: "curse", weight: 7, run: curse }),
  Object.freeze({ id: "poison", weight: 7, run: poison }),
  Object.freeze({ id: "creature", weight: 6, run: creature }),
  Object.freeze({ id: "teleport", weight: 5, run: teleport }),
  Object.freeze({ id: "gush", weight: 4, run: gush }),
  Object.freeze({ id: "wish", weight: 3, run: wish }),
]);

export function chooseFountainDrinkOutcome(rng) {
  const total = FOUNTAIN_DRINK_OUTCOMES.reduce((sum, outcome) => sum + outcome.weight, 0);
  let roll = rng() * total;
  for (const outcome of FOUNTAIN_DRINK_OUTCOMES) {
    roll -= outcome.weight;
    if (roll < 0) return outcome;
  }
  return FOUNTAIN_DRINK_OUTCOMES[FOUNTAIN_DRINK_OUTCOMES.length - 1];
}
