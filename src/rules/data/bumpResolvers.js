// rules/data/bumpResolvers.js
// Ordered dispatch table for bump resolution.
//
// When an actor attempts to move into a blocked tile, the movement system
// iterates this list in priority order and runs the first matching resolver.
// Adding new bump interactions (push boulders, talk to NPCs, kick items)
// is a matter of inserting a new entry — no movement system edits needed.
//
// Each resolver has:
//   name     — human-readable label for debugging / profiling
//   test     — (world, actor, context) => boolean; context contains { nx, ny, target, tiles }
//   resolve  — (world, actor, context) => void; performs the bump action

import { Faction } from "../components/Faction.js";
import { Interactable } from "../components/Interactable.js";
import { Player } from "../components/Player.js";
import { Pet } from "../components/Pet.js";
import { AttackIntent } from "../components/Intents/AttackIntent.js";
import { Equipment } from "../components/Equipment.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Stamina } from "../components/Stamina.js";
import { Position } from "../components/Position.js";
import { Pushable } from "../components/Pushable.js";
import { Flying } from "../components/Flying.js";
import { areFactionsHostile } from "../utils/factionHostility.js";
import { findTileReaction } from "./tileReactions.js";
import { getTile, setTile, isLoaded, isWalkable } from "../environment/dungeon/tileMap.js";
import { TILE_VOID } from "../environment/dungeon/constants.js";
import { STAMINA_REGEN_COOLDOWN } from "./regenConstants.js";

/**
 * @typedef {{
 *   nx: number,
 *   ny: number,
 *   mdx: number,
 *   mdy: number,
 *   target: number,
 *   tiles: import('../utils/tileQueryCache.js').TileQueryState,
 * }} BumpContext
 */

/**
 * @typedef {{
 *   name: string,
 *   test: (world: any, actor: number, ctx: BumpContext) => boolean,
 *   resolve: (world: any, actor: number, ctx: BumpContext) => void,
 * }} BumpResolver
 */

// ── helpers ──────────────────────────────────────────────────────────

function isManhattan1(mdx, mdy) {
  return Math.abs(mdx) + Math.abs(mdy) === 1;
}

function emitSafe(world, event, payload) {
  try { world.emit?.(event, payload); } catch (e) {
    console.debug(`[bumpResolvers] emit ${event} failed:`, e);
  }
}

function targetIsAtBumpTile(targetId, nx, ny, tiles) {
  if (!(targetId > 0)) return false;
  return tiles.livingByCell.get(`${nx},${ny}`) === targetId;
}

// ── resolvers (priority order) ──────────────────────────────────────

/** Bump-attack: melee into a hostile living entity on an adjacent tile. */
const hostileMelee = {
  name: "hostile-melee",
  test(world, actor, ctx) {
    if (!isManhattan1(ctx.mdx, ctx.mdy)) return false;
    if (!(ctx.target > 0) || ctx.target === actor) return false;
    // Precision gate: never melee through stale occupancy or non-walkable terrain.
    if (!targetIsAtBumpTile(ctx.target, ctx.nx, ctx.ny, ctx.tiles)) return false;
    if (!isWalkable(ctx.nx, ctx.ny)) return false;
    // Flying target immune to melee from grounded attacker
    if (world.has(ctx.target, Flying) && !world.has(actor, Flying)) return false;
    const actorFac = world.get(actor, Faction);
    const targetFac = world.get(ctx.target, Faction);
    // Shopkeepers / neutrals with Interactable are handled by npc-interact
    if (targetFac && (targetFac.key === "shopkeeper" || targetFac.key === "neutral")
        && world.has(ctx.target, Interactable)) return false;
    return areFactionsHostile(actorFac?.key, targetFac?.key);
  },
  resolve(world, actor, ctx) {
    if (world.has(actor, AttackIntent)) return;
    // Emit out-of-reach when target is flying and attacker is grounded
    if (world.has(ctx.target, Flying) && !world.has(actor, Flying)) {
      emitSafe(world, "combat:target-flying", { attacker: actor, target: ctx.target });
      return;
    }
    let handled = 0;
    try {
      handled = Number(world.emit?.("bump:attack", { attacker: actor, target: ctx.target }) || 0);
    } catch { handled = 0; }
    if (handled <= 0) {
      try { world.add(actor, AttackIntent, { targetId: ctx.target }); } catch {}
    }
  },
};

/** Pet swap: player walks into own pet, swap positions (classic roguelike behavior). */
const petSwap = {
  name: "pet-swap",
  test(world, actor, ctx) {
    if (!world.has(actor, Player)) return false;
    if (!isManhattan1(ctx.mdx, ctx.mdy)) return false;
    if (!(ctx.target > 0) || ctx.target === actor) return false;
    return world.has(ctx.target, Pet);
  },
  resolve(world, actor, ctx) {
    const actorPos = world.get(actor, Position);
    const petPos = world.get(ctx.target, Position);
    if (!actorPos || !petPos) return;

    const aFrom = { x: actorPos.x, y: actorPos.y };
    const pFrom = { x: petPos.x, y: petPos.y };

    world.set(ctx.target, Position, aFrom);
    world.set(actor, Position, pFrom);

    emitSafe(world, "moved", { id: ctx.target, from: pFrom, to: aFrom });
    emitSafe(world, "moved", { id: actor, from: aFrom, to: pFrom });
  },
};

/** Bump-interact: walk into a neutral/shopkeeper NPC that has Interactable. */
const npcInteract = {
  name: "npc-interact",
  test(world, actor, ctx) {
    if (!isManhattan1(ctx.mdx, ctx.mdy)) return false;
    if (!(ctx.target > 0) || ctx.target === actor) return false;
    const fac = world.get(ctx.target, Faction);
    if (!fac) return false;
    return (fac.key === "shopkeeper" || fac.key === "neutral")
           && world.has(ctx.target, Interactable);
  },
  resolve(world, actor, ctx) {
    emitSafe(world, "bump:interact", { actor, target: ctx.target });
  },
};

/** Bump-interact: walk into a non-living interactable (door, chest, altar). Player only. */
const objectInteract = {
  name: "object-interact",
  test(world, actor, ctx) {
    if (!world.has(actor, Player)) return false;
    if (ctx.target > 0) return false; // living target handled above
    const interactId = ctx.tiles.interactableByCell.get(`${ctx.nx},${ctx.ny}`);
    return interactId > 0;
  },
  resolve(world, actor, ctx) {
    const interactId = ctx.tiles.interactableByCell.get(`${ctx.nx},${ctx.ny}`);
    emitSafe(world, "bump:interact", { actor, target: interactId });
  },
};

/** Push entity: player bumps a Pushable entity (e.g. statue) and shoves it one tile. */
const pushEntity = {
  name: "push-entity",
  test(world, actor, ctx) {
    if (!world.has(actor, Player)) return false;
    if (!isManhattan1(ctx.mdx, ctx.mdy)) return false;
    return _findPushable(world, ctx) > 0;
  },
  resolve(world, actor, ctx) {
    const targetId = _findPushable(world, ctx);
    if (targetId <= 0) return;

    const destX = ctx.nx + ctx.mdx;
    const destY = ctx.ny + ctx.mdy;
    const destKey = `${destX},${destY}`;

    if (!isWalkable(destX, destY) || ctx.tiles.blockedByCell.has(destKey)) {
      emitSafe(world, "entity:push-blocked", { actor, target: targetId });
      return;
    }

    const from = { x: ctx.nx, y: ctx.ny };
    const to = { x: destX, y: destY };
    world.set(targetId, Position, to);
    emitSafe(world, "entity:pushed", { actor, target: targetId, from, to });
    emitSafe(world, "moved", { id: targetId, from, to });
  },
};

/** Scan byCell for a Pushable entity at (nx, ny). */
function _findPushable(world, ctx) {
  const k = `${ctx.nx},${ctx.ny}`;
  const ids = ctx.tiles.byCell.get(k);
  if (!ids) return 0;
  for (let i = 0; i < ids.length; i++) {
    if (world.has(ids[i], Pushable)) return ids[i];
  }
  return 0;
}

/** Tile reaction: dig walls, chop trees, etc. Player only. Data-driven via tileReactions.js. */
const tileReaction = {
  name: "tile-reaction",
  test(world, actor, ctx) {
    if (!world.has(actor, Player)) return false;
    if (ctx.target > 0) return false;
    const tileType = getTile(ctx.nx, ctx.ny);
    const eq = world.get(actor, Equipment);
    const weaponId = eq?.weapon || 0;
    if (!weaponId) return false;
    const wInfo = world.get(weaponId, ItemInfo);
    if (!wInfo?.bonuses) return false;
    return findTileReaction(tileType, wInfo.bonuses) !== null;
  },
  resolve(world, actor, ctx) {
    const tileType = getTile(ctx.nx, ctx.ny);
    const eq = world.get(actor, Equipment);
    const weaponId = eq?.weapon || 0;
    const wInfo = world.get(weaponId, ItemInfo);
    const reaction = findTileReaction(tileType, wInfo.bonuses);
    if (!reaction) return;

    const stam = world.get(actor, Stamina);
    const cost = Number(wInfo[reaction.costField] ?? reaction.costDefault);
    if (!stam || Number(stam.stamina ?? 0) < cost) {
      emitSafe(world, "attack:insufficient-stamina", {
        attacker: actor,
        need: cost,
        have: Number(stam?.stamina ?? 0),
      });
      return;
    }

    world.set(actor, Stamina, {
      ...stam,
      stamina: stam.stamina - cost,
      regenCooldown: STAMINA_REGEN_COOLDOWN,
    });
    setTile(ctx.nx, ctx.ny, reaction.result);

    // Backfill void neighbors if specified
    if (reaction.backfill != null) {
      for (const [dx, dy] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        if (isLoaded(ctx.nx + dx, ctx.ny + dy) && getTile(ctx.nx + dx, ctx.ny + dy) === TILE_VOID) {
          setTile(ctx.nx + dx, ctx.ny + dy, reaction.backfill);
        }
      }
    }

    emitSafe(world, reaction.event, { actor, x: ctx.nx, y: ctx.ny });
  },
};

/** @type {BumpResolver[]} */
export const BUMP_RESOLVERS = [
  hostileMelee,
  petSwap,
  npcInteract,
  objectInteract,
  pushEntity,
  tileReaction,
];

/**
 * Run bump resolution: iterate resolvers in priority order, execute the first match.
 * @param {any} world
 * @param {number} actor
 * @param {BumpContext} ctx
 * @returns {boolean} true if a resolver handled the bump
 */
export function resolveBump(world, actor, ctx) {
  for (let i = 0; i < BUMP_RESOLVERS.length; i++) {
    const r = BUMP_RESOLVERS[i];
    if (r.test(world, actor, ctx)) {
      r.resolve(world, actor, ctx);
      return true;
    }
  }
  return false;
}
