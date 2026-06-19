// src/rules/systems/aiFarmAnimalSystem.js
// Simple wandering AI for passive farm animals on the overworld (depth 0).
// Animals randomly scurry with a high rest chance, staying near their spawn.

import { Faction } from "../components/Faction.js";
import { CreatureType, CREATURE_TYPES } from "../components/CreatureType.js";
import { MoveIntent } from "../components/Intents/MoveIntent.js";
import { DungeonState } from "../components/DungeonState.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Vitality } from "../components/Vitality.js";
import { canActThisTurn } from "../utils/speedGate.js";
import { CARDINAL_DIRS } from "../utils/directions.js";
import { isWalkable } from "../environment/dungeon/tileMap.js";
import { playerEntity } from "../utils/queries.js";
import { forEachInRadius } from "../utils/spatialIndex.js";
import { resolveSleepProfile, resolveSleepScheduleNow } from "../data/sleepProfiles.js";
import { isAsleep, putActorToSleep, tryWakeActor } from "../utils/sleep.js";

const ACTIVE_RADIUS = 8;
const VOCALIZATION_COOLDOWN = 200; // turns between vocalizations per chicken
const CHICKEN_IDENTITIES = new Set(["chicken_hen", "chicken_rooster", "chick"]);
const CHICKEN_SLEEP_PROFILE = "diurnal";

/** Track vocalization cooldown per entity (Map<id, turnsLeft>) */
const _vocalizationCooldowns = new Map();

function syncChickenSleepSchedule(world) {
  const sleepProfile = resolveSleepProfile(CHICKEN_SLEEP_PROFILE);
  const shouldSleep = resolveSleepScheduleNow(CHICKEN_SLEEP_PROFILE, world.step || 0) === true;
  if (!sleepProfile) return;
  for (const [id, identity, faction, creatureType, vitality] of world.query(
    NamedIdentity,
    Faction,
    CreatureType,
    Vitality,
  )) {
    if (vitality.hp <= 0 || faction.key !== "neutral") continue;
    if (creatureType.type !== CREATURE_TYPES.beast) continue;
    if (!CHICKEN_IDENTITIES.has(String(identity.identity || ""))) continue;

    if (shouldSleep) {
      if (!isAsleep(world, id)) {
        putActorToSleep(world, id, {
          reason: "scheduled_rest",
          wakeDifficulty: sleepProfile.wakeDifficulty,
          wakeRadius: sleepProfile.wakeRadius,
          wakeOnDamage: sleepProfile.wakeOnDamage,
        });
      }
    } else if (isAsleep(world, id)) {
      tryWakeActor(world, id, { reason: "scheduled_wake", intensity: 999 });
    }
  }
}

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function aiFarmAnimalSystem(world) {
  // Only run on the overworld.
  let depth = -1;
  for (const [, ds] of world.query(DungeonState)) {
    depth = ds.currentDepth ?? -1;
    break;
  }
  if (depth !== 0) return;

  syncChickenSleepSchedule(world);

  const player = playerEntity(world);
  if (!player) return;
  const pp = player.pos;

  forEachInRadius(world, pp.x, pp.y, ACTIVE_RADIUS, (id, pos) => {
    const fac = world.get(id, Faction);
    if (!fac || fac.key !== "neutral") return;

    const ct = world.get(id, CreatureType);
    if (!ct || ct.type !== CREATURE_TYPES.beast) return;

    const identity = String(world.get(id, NamedIdentity)?.identity || "");
    if (!CHICKEN_IDENTITIES.has(identity)) return;
    if (isAsleep(world, id)) return;

    if (!canActThisTurn(world, id)) return;
    if (world.has(id, MoveIntent)) return;

    // Decrement vocalization cooldown
    const cooldown = _vocalizationCooldowns.get(id) ?? 0;
    if (cooldown > 0) {
      _vocalizationCooldowns.set(id, cooldown - 1);
    }

    // 5% chance to vocalize (if not on cooldown) — chickens cluck/cheep occasionally
    if (cooldown === 0 && world.rand() < 0.05) {
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
