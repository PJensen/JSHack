import { defineInteractable } from "../../index.js";
import { Collider } from "../../../rules/components/Collider.js";
import { Position } from "../../../rules/components/Position.js";
import { Vitality } from "../../../rules/components/Vitality.js";
import { Interactable } from "../../../rules/components/Interactable.js";
import { DungeonState } from "../../../rules/components/DungeonState.js";
import { defineVerbRule } from "../../../rules/kernel/verbRule.js";
import { chanceTable } from "../../../rules/kernel/chanceTable.js";
import { RuleResult } from "../../../rules/kernel/RuleResult.js";
import { resolveLootTable } from "../../../rules/data/lootResolver.js";
import { UrnInteractionResolved } from "../../../events/UrnInteractionResolved.js";
import { SarcophagusInteractionResolved } from "../../../events/SarcophagusInteractionResolved.js";

const ASHES_DROP = Object.freeze({
  kind: "archetype",
  params: Object.freeze({ archetype: "Ashes" }),
});

function depthOf(ctx) {
  const authored = Number(ctx.params?.interactableParams?.depth || 0) | 0;
  if (authored > 0) return authored;
  const dungeon = ctx.query.first(DungeonState)?.value;
  return Math.max(1, Number(dungeon?.currentDepth || 1) | 0);
}

function positionOf(ctx) {
  return ctx.query.get(ctx.target, Position);
}

function eventPoint(pos) {
  return pos ? { x: pos.x | 0, y: pos.y | 0 } : null;
}

function scatterAshes(ctx, pos) {
  ctx.mutate.materializeDrop(ASHES_DROP, pos);
}

function resolveDropsToGround(ctx, tableId, pos, depth) {
  const drops = resolveLootTable(tableId, ctx.rng, depth);
  for (let i = 0; i < drops.length; i++) {
    ctx.mutate.materializeDrop(drops[i], pos);
  }
  return drops.length;
}

function resolveDropsToInventory(ctx, tableId, ownerId, pos, depth, capacity = 20) {
  const drops = resolveLootTable(tableId, ctx.rng, depth);
  for (let i = 0; i < drops.length; i++) {
    ctx.mutate.materializeDropToInventory(drops[i], ownerId, pos, { capacity });
  }
  return drops;
}

function finishUrn(ctx, outcome, pos, payload = {}) {
  ctx.mutate.destroy(ctx.target);
  ctx.io.emitAfter(() => new UrnInteractionResolved({
    actor: ctx.actor,
    targetId: ctx.target,
    outcome,
    at: eventPoint(pos),
    ...payload,
  }));
  return RuleResult.handled({ outcomeId: outcome });
}

function openSarcophagus(ctx) {
  if (ctx.query.has(ctx.target, Collider)) {
    ctx.mutate.patchComponent(ctx.target, Collider, { solid: false, blocksSight: false });
  }
  ctx.mutate.removeComponent(ctx.target, Interactable);
  ctx.mutate.ensureInventory(ctx.target, 20);
}

function finishSarcophagus(ctx, outcome, pos, depth, payload = {}) {
  ctx.io.emitAfter(() => new SarcophagusInteractionResolved({
    actor: ctx.actor,
    targetId: ctx.target,
    outcome,
    depth,
    at: eventPoint(pos),
    ...payload,
  }));
  return RuleResult.handled({ outcomeId: outcome });
}

function spawnMonsterNear(ctx, monsterId, fallbackName) {
  const tile = ctx.query.nearestValidTileAround(ctx.target, 2);
  if (!tile) return null;
  ctx.mutate.spawnMonster(monsterId, tile.x, tile.y, { name: fallbackName });
  return fallbackName;
}

function pickSkeleton(ctx, depth) {
  if (depth >= 12) {
    return ctx.rng.next() < 0.35
      ? { id: "skeletal_marksman", name: "Skeletal Marksman" }
      : { id: "wight", name: "Wight" };
  }
  if (depth >= 7) {
    return ctx.rng.next() < 0.45
      ? { id: "bone_bowman", name: "Bone Bowman" }
      : { id: "skeletal_shadow_caster", name: "Skeletal Shadow Caster" };
  }
  if (ctx.rng.next() < 0.33) return { id: "skeleton_archer", name: "Skeleton Archer" };
  return { id: "skeleton", name: "Skeleton" };
}

const urnBreakTable = chanceTable("crypt.urn.break", [
  {
    id: "ashes-loot",
    weight: 45,
    apply(ctx) {
      const pos = positionOf(ctx);
      const depth = depthOf(ctx);
      scatterAshes(ctx, pos);
      const lootCount = resolveDropsToGround(ctx, "urn:contents", pos, depth);
      return finishUrn(ctx, "ashes-loot", pos, { lootCount });
    },
  },
  {
    id: "empty-ashes",
    weight: 25,
    apply(ctx) {
      const pos = positionOf(ctx);
      scatterAshes(ctx, pos);
      return finishUrn(ctx, "empty-ashes", pos);
    },
  },
  {
    id: "spectral-snake",
    weight: 12,
    when: (ctx) => !!ctx.query.nearestValidTileAround(ctx.target, 2),
    apply(ctx) {
      const pos = positionOf(ctx);
      scatterAshes(ctx, pos);
      const spawnedName = spawnMonsterNear(ctx, "spectral_snake", "Spectral Snake");
      return finishUrn(ctx, "spectral-snake", pos, { spawnedName });
    },
  },
  {
    id: "poison-dust",
    weight: 10,
    apply(ctx) {
      const pos = positionOf(ctx);
      scatterAshes(ctx, pos);
      const turns = ctx.rng.int(3, 6);
      ctx.mutate.upsertTimedEffect(ctx.actor, { key: "poison", turnsLeft: turns, potency: 1 });
      return finishUrn(ctx, "poison-dust", pos);
    },
  },
  {
    id: "shard-trap",
    weight: 8,
    when: (ctx) => !!ctx.query.get(ctx.actor, Vitality),
    apply(ctx) {
      const pos = positionOf(ctx);
      scatterAshes(ctx, pos);
      const damage = ctx.rng.int(2, 5);
      ctx.mutate.queue({
        type: "damage",
        entityId: ctx.actor,
        amount: damage,
        damageType: "pierce",
        source: ctx.target,
      });
      return finishUrn(ctx, "shard-trap", pos, { damage });
    },
  },
]);

const sarcophagusOpenTable = chanceTable("crypt.sarcophagus.open", [
  {
    id: "burial-loot",
    weight: 36,
    apply(ctx) {
      const pos = positionOf(ctx);
      const depth = depthOf(ctx);
      openSarcophagus(ctx);
      const drops = resolveDropsToInventory(ctx, "sarcophagus:contents", ctx.target, pos, depth);
      ctx.io.emitAfter(() => new SarcophagusInteractionResolved({
        actor: ctx.actor,
        targetId: ctx.target,
        outcome: "burial-loot",
        depth,
        at: eventPoint(pos),
        lootCount: drops.length,
      }));
      return RuleResult.handled({ outcomeId: "burial-loot" });
    },
  },
  {
    id: "skeleton",
    weight: 26,
    when: (ctx) => !!ctx.query.nearestValidTileAround(ctx.target, 2),
    apply(ctx) {
      const pos = positionOf(ctx);
      const depth = depthOf(ctx);
      const monster = pickSkeleton(ctx, depth);
      openSarcophagus(ctx);
      const spawnedName = spawnMonsterNear(ctx, monster.id, monster.name);
      return finishSarcophagus(ctx, "skeleton", pos, depth, { spawnedName });
    },
  },
  {
    id: "booby-trap",
    weight: 14,
    when: (ctx) => !!ctx.query.get(ctx.actor, Vitality),
    apply(ctx) {
      const pos = positionOf(ctx);
      const depth = depthOf(ctx);
      const damage = ctx.rng.int(4, 8 + Math.min(8, depth));
      openSarcophagus(ctx);
      ctx.mutate.queue({
        type: "damage",
        entityId: ctx.actor,
        amount: damage,
        damageType: "pierce",
        source: ctx.target,
      });
      if (ctx.rng.next() < 0.4) {
        ctx.mutate.upsertTimedEffect(ctx.actor, { key: "bleed", turnsLeft: 2, potency: 1 });
      }
      return finishSarcophagus(ctx, "booby-trap", pos, depth, { damage });
    },
  },
  {
    id: "restless-dead",
    weight: 10,
    when: (ctx) => depthOf(ctx) >= 4 && !!ctx.query.nearestValidTileAround(ctx.target, 2),
    apply(ctx) {
      const pos = positionOf(ctx);
      const depth = depthOf(ctx);
      const monster = depth >= 9
        ? { id: "carrion_shade", name: "Carrion Shade" }
        : { id: "wight", name: "Wight" };
      openSarcophagus(ctx);
      const spawnedName = spawnMonsterNear(ctx, monster.id, monster.name);
      return finishSarcophagus(ctx, "restless-dead", pos, depth, { spawnedName });
    },
  },
  {
    id: "treasure-cache",
    weight: 8,
    apply(ctx) {
      const pos = positionOf(ctx);
      const depth = depthOf(ctx);
      openSarcophagus(ctx);
      const drops = resolveDropsToInventory(ctx, "sarcophagus:contents", ctx.target, pos, depth);
      const bonus = resolveLootTable("sub:jewelry", ctx.rng, depth);
      for (let i = 0; i < bonus.length; i++) {
        ctx.mutate.materializeDropToInventory(bonus[i], ctx.target, pos, { capacity: 20 });
      }
      ctx.io.emitAfter(() => new SarcophagusInteractionResolved({
        actor: ctx.actor,
        targetId: ctx.target,
        outcome: "treasure-cache",
        depth,
        at: eventPoint(pos),
        lootCount: drops.length + bonus.length,
      }));
      return RuleResult.handled({ outcomeId: "treasure-cache" });
    },
  },
  {
    id: "spore-cloud",
    weight: 5,
    apply(ctx) {
      const pos = positionOf(ctx);
      const depth = depthOf(ctx);
      openSarcophagus(ctx);
      ctx.mutate.spawnHazard({
        x: pos.x,
        y: pos.y,
        kind: "poison",
        medium: "air",
        turnsLeft: ctx.rng.int(3, 5),
        radius: 1,
        tickDamage: 1 + Math.floor(Math.min(10, depth) / 5),
        damageType: "poison",
        cause: "sarcophagus:spore-cloud",
        sourceId: ctx.target,
        sourceKind: "sarcophagus",
        identity: "venom_spores",
        name: "Venom Spores",
        meta: { source: "sarcophagus" },
      });
      return finishSarcophagus(ctx, "spore-cloud", pos, depth);
    },
  },
  {
    id: "empty",
    weight: 6,
    apply(ctx) {
      const pos = positionOf(ctx);
      const depth = depthOf(ctx);
      openSarcophagus(ctx);
      return finishSarcophagus(ctx, "empty", pos, depth);
    },
  },
]);

export const urnBreakRule = defineVerbRule({
  id: "crypt.urn.break",
  verb: "break",
  when(ctx) {
    return !!positionOf(ctx);
  },
  apply: (ctx) => urnBreakTable.resolve(ctx),
});

export const sarcophagusOpenRule = defineVerbRule({
  id: "crypt.sarcophagus.open",
  verb: "open",
  when(ctx) {
    return !!positionOf(ctx);
  },
  apply: (ctx) => sarcophagusOpenTable.resolve(ctx),
});

defineInteractable("breakUrn", {
  defaultVerb: "break",
  verbs: {
    break: urnBreakRule,
  },
});

defineInteractable("openSarcophagus", {
  defaultVerb: "open",
  verbs: {
    open: sarcophagusOpenRule,
  },
});

export const URN_BREAK_OUTCOMES = urnBreakTable.entries;
export const SARCOPHAGUS_OPEN_OUTCOMES = sarcophagusOpenTable.entries;
