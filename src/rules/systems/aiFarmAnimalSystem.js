// src/rules/systems/aiFarmAnimalSystem.js
// Simple wandering AI for passive farm animals on the overworld (depth 0).
// Animals randomly scurry with a high rest chance, staying near their spawn.

import { Faction } from "../components/Faction.js";
import { CreatureType, CREATURE_TYPES } from "../components/CreatureType.js";
import { MoveIntent } from "../components/Intents/MoveIntent.js";
import { DungeonState } from "../components/DungeonState.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { canActThisTurn } from "../utils/speedGate.js";
import { CARDINAL_DIRS } from "../utils/directions.js";
import { isWalkable } from "../environment/dungeon/tileMap.js";
import { playerEntity } from "../utils/queries.js";
import { forEachInRadius } from "../utils/spatialIndex.js";

const ACTIVE_RADIUS = 8;
const VOCALIZATION_COOLDOWN = 200; // turns between vocalizations per chicken

/** Track vocalization cooldown per entity (Map<id, turnsLeft>) */
const _vocalizationCooldowns = new Map();

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function aiFarmAnimalSystem(world) {
  // Only run on the overworld.
  let depth = -1;
  for (const [, ds] of world.query(DungeonState)) {
    depth = ds.currentDepth ?? -1;
    break;
  }
  if (depth !== 0) return;

  const player = playerEntity(world);
  if (!player) return;
  const pp = player.pos;

  forEachInRadius(world, pp.x, pp.y, ACTIVE_RADIUS, (id, pos) => {
    const fac = world.get(id, Faction);
    if (!fac || fac.key !== "neutral") return;

    const ct = world.get(id, CreatureType);
    if (!ct || ct.type !== CREATURE_TYPES.beast) return;

    if (!canActThisTurn(world, id)) return;
    if (world.has(id, MoveIntent)) return;

    // Decrement vocalization cooldown
    const cooldown = _vocalizationCooldowns.get(id) ?? 0;
    if (cooldown > 0) {
      _vocalizationCooldowns.set(id, cooldown - 1);
    }

    // 5% chance to vocalize (if not on cooldown) — chickens cluck/cheep occasionally
    if (cooldown === 0 && world.rand() < 0.05) {
      const identity = world.get(id, NamedIdentity)?.identity;
      if (identity) {
        world.emit?.('creature:vocalize', {
          id,
          identity,
          at: { x: pos.x | 0, y: pos.y | 0 },
        });
        _vocalizationCooldowns.set(id, VOCALIZATION_COOLDOWN);
      }
    }

    // 70% chance to rest — chickens mostly peck in place.
    if (world.rand() < 0.7) return;

    const dir = CARDINAL_DIRS[Math.floor(world.rand() * CARDINAL_DIRS.length)];
    const nx = (pos.x | 0) + dir.dx;
    const ny = (pos.y | 0) + dir.dy;
    if (!isWalkable(nx, ny)) return;

    try { world.add(id, MoveIntent, { dx: dir.dx, dy: dir.dy }); } catch {}
  });
}
