import { attach } from "../../lib/ecs-js/hierarchy.js";
import { createRng } from "../../lib/ecs-js/rng.js";
import { Collider } from "../components/Collider.js";
import { DeathApplied } from "../components/DeathApplied.js";
import { DeityAuthorshipState } from "../components/DeityAuthorshipState.js";
import { DeityChallengeMember } from "../components/DeityChallengeMember.js";
import { Devotion } from "../components/Devotion.js";
import { DungeonState } from "../components/DungeonState.js";
import { Faction } from "../components/Faction.js";
import { Lifespan } from "../components/Lifespan.js";
import { Player } from "../components/Player.js";
import { Position } from "../components/Position.js";
import { RoomMetadata } from "../components/RoomMetadata.js";
import { Vitality } from "../components/Vitality.js";
import { isExplored, isVisible } from "../environment/dungeon/exploredMap.js";
import { isWalkable } from "../environment/dungeon/tileMap.js";
import { pickMonster } from "../environment/dungeon/tables.js";
import { materializeDrop } from "../data/lootResolver.js";
import { spawnMonsterEntity } from "../utils/spawnMonsterEntity.js";

const STATE_KEY = Symbol.for("jshack:deity:challengeState");
const QUIET_TURNS_REQUIRED = 12;
const CHALLENGE_COOLDOWN_TURNS = 80;
const NEAR_HOSTILE_RADIUS = 7;
const MIN_PLAYER_ROOM_DISTANCE = 5;

function ensureState(world) {
  const rec = world[STATE_KEY];
  if (rec && typeof rec === "object") return rec;
  const created = { quietTurns: 0, lastChallengeStep: -999999 };
  world[STATE_KEY] = created;
  return created;
}

function currentDungeonState(world) {
  for (const [id, ds] of world.query(DungeonState)) return [id, ds];
  return [0, null];
}

function currentPlayer(world) {
  for (const [id, pos, dev] of world.query(Player, Position, Devotion)) {
    return [id, pos, dev];
  }
  return [0, null, null];
}

function inRoom(pos, room) {
  if (!pos || !room) return false;
  const x = pos.x | 0;
  const y = pos.y | 0;
  return x >= (room.x | 0)
    && y >= (room.y | 0)
    && x < ((room.x | 0) + (room.w | 0))
    && y < ((room.y | 0) + (room.h | 0));
}

function roomCenter(room) {
  return {
    x: (room.x | 0) + Math.floor((room.w | 0) / 2),
    y: (room.y | 0) + Math.floor((room.h | 0) / 2),
  };
}

function chebyshev(a, b) {
  return Math.max(Math.abs((a.x | 0) - (b.x | 0)), Math.abs((a.y | 0) - (b.y | 0)));
}

function isBlockedByEntity(world, x, y) {
  for (const [, pos, col] of world.query(Position, Collider)) {
    if ((pos.x | 0) !== x || (pos.y | 0) !== y) continue;
    if (col?.solid) return true;
  }
  return false;
}

function roomHasLivingCreature(world, room, playerId) {
  for (const [id, pos, vit] of world.query(Position, Vitality)) {
    if (id === playerId) continue;
    if (!inRoom(pos, room)) continue;
    if (Number(vit?.hp ?? 0) > 0) return true;
  }
  return false;
}

function hasNearbyHostile(world, playerId, playerPos) {
  for (const [id, pos, vit, faction] of world.query(Position, Vitality, Faction)) {
    if (id === playerId) continue;
    if (Number(vit?.hp ?? 0) <= 0) continue;
    if (String(faction?.key || "") !== "enemy") continue;
    if (chebyshev(playerPos, pos) <= NEAR_HOSTILE_RADIUS) return true;
  }
  return false;
}

function hasActiveChallenge(world, playerId) {
  for (const [, challenge] of world.query(DeityAuthorshipState)) {
    if (Number(challenge.playerId || 0) !== playerId) continue;
    if (String(challenge.state || "") === "active" && Number(challenge.remaining || 0) > 0) return true;
  }
  return false;
}

function candidateTiles(world, room, playerPos) {
  const out = [];
  const x0 = room.x | 0;
  const y0 = room.y | 0;
  const w = room.w | 0;
  const h = room.h | 0;

  for (let y = y0 + 1; y < y0 + h - 1; y++) {
    for (let x = x0 + 1; x < x0 + w - 1; x++) {
      if (!isWalkable(x, y)) continue;
      if (!isExplored(x, y)) continue;
      if (isVisible(x, y)) continue;
      if (isBlockedByEntity(world, x, y)) continue;
      out.push({ x, y, dist: chebyshev(playerPos, { x, y }) });
    }
  }

  out.sort((a, b) => {
    if (b.dist !== a.dist) return b.dist - a.dist;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
  return out;
}

function chooseRoom(world, playerId, playerPos) {
  let best = null;
  let bestDist = -1;

  for (const [, room] of world.query(RoomMetadata)) {
    const type = String(room.roomType || "generic");
    if (type === "shop") continue;
    if (inRoom(playerPos, room)) continue;
    const center = roomCenter(room);
    const dist = chebyshev(playerPos, center);
    if (dist < MIN_PLAYER_ROOM_DISTANCE) continue;
    if (roomHasLivingCreature(world, room, playerId)) continue;
    const tiles = candidateTiles(world, room, playerPos);
    if (!tiles.length) continue;
    if (dist > bestDist) {
      bestDist = dist;
      best = { room, center, tiles };
    }
  }

  return best;
}

function trackFloorEntity(world, id) {
  if (!(id > 0)) return;
  const [dungeonId, ds] = currentDungeonState(world);
  if (!(dungeonId > 0) || !ds) return;
  world.mutate(dungeonId, DungeonState, (rec) => {
    if (!Array.isArray(rec.floorEntityIds)) rec.floorEntityIds = [];
    if (!rec.floorEntityIds.includes(id)) rec.floorEntityIds.push(id);
  });
}

function challengeSeed(world, playerId, room) {
  return (
    (world.seed >>> 0)
    ^ (((world.step | 0) * 0x9e3779b9) >>> 0)
    ^ (((playerId | 0) * 0x45d9f3b) >>> 0)
    ^ ((((room.x | 0) * 0x119de1f3) >>> 0))
    ^ ((((room.y | 0) * 0x3449a3d) >>> 0))
  ) >>> 0;
}

function spawnChallenge(world, playerId, playerPos, devotion, ds, picked) {
  const room = picked.room;
  const depth = Math.max(1, Number(ds?.currentDepth || 1) | 0);
  const deityId = String(devotion?.deityId || "unknown");
  const seed = challengeSeed(world, playerId, room);
  const rng = createRng(seed);
  const spawnCount = Math.min(picked.tiles.length, depth >= 3 ? 2 : 1);
  if (!(spawnCount > 0)) return 0;

  const challengeId = world.create();
  world.add(challengeId, DeityAuthorshipState, {
    deityId,
    playerId,
    kind: "challenge",
    reason: "cleared_room",
    state: "active",
    x: room.x | 0,
    y: room.y | 0,
    w: room.w | 0,
    h: room.h | 0,
    depth,
    spawned: spawnCount,
    remaining: spawnCount,
    rewardSpawned: false,
    createdStep: world.step | 0,
  });
  trackFloorEntity(world, challengeId);

  const spawnedIds = [];
  for (let i = 0; i < spawnCount; i++) {
    const spot = picked.tiles[i];
    const params = pickMonster(rng, depth);
    if (!params) continue;
    const monsterId = spawnMonsterEntity(world, {
      ...params,
      x: spot.x,
      y: spot.y,
      sleep: false,
    });
    if (!(monsterId > 0)) continue;
    world.add(monsterId, DeityChallengeMember, { challengeId, deityId, playerId });
    attach(world, monsterId, challengeId);
    trackFloorEntity(world, monsterId);
    spawnedIds.push(monsterId);
  }

  if (!spawnedIds.length) {
    world.destroy(challengeId);
    return 0;
  }
  if (spawnedIds.length !== spawnCount) {
    world.mutate(challengeId, DeityAuthorshipState, (rec) => {
      rec.spawned = spawnedIds.length;
      rec.remaining = spawnedIds.length;
    });
  }

  world.emit?.("deity:challenge", {
    deityId,
    playerId,
    challengeId,
    kind: "monster_ambush",
    reason: "cleared_room",
    room: { x: room.x | 0, y: room.y | 0, w: room.w | 0, h: room.h | 0 },
    spawnedIds: spawnedIds.slice(),
  });
  world.emit?.("deity:intervention", {
    deityId,
    playerId,
    kind: "challenge",
    challengeId,
    reason: "cleared_room",
  });
  return challengeId;
}

function rewardChallenge(world, challengeId, challenge, at) {
  if (challenge.rewardSpawned === true) return;
  const depth = Math.max(1, Number(challenge.depth || 1) | 0);
  const rewardPos = at || {
    x: (challenge.x | 0) + Math.floor((challenge.w | 0) / 2),
    y: (challenge.y | 0) + Math.floor((challenge.h | 0) / 2),
  };
  const amount = Math.max(15, 20 + depth * 12 + Math.max(0, Number(challenge.spawned || 0) | 0) * 8);
  const rewardId = materializeDrop(world, { kind: "gold", params: { count: amount } }, rewardPos);
  if (rewardId > 0) trackFloorEntity(world, rewardId);

  world.mutate(challengeId, DeityAuthorshipState, (rec) => {
    rec.state = "completed";
    rec.remaining = 0;
    rec.rewardSpawned = true;
    rec.completedStep = world.step | 0;
  });
  try {
    world.add(challengeId, Lifespan, { turnsLeft: 2, onExpiry: "remove", expiryEvent: "" });
  } catch {}

  world.emit?.("deity:challenge:completed", {
    deityId: String(challenge.deityId || ""),
    playerId: Number(challenge.playerId || 0) | 0,
    challengeId,
    rewardId: rewardId || 0,
    rewardKind: "gold",
    amount,
    at: { x: rewardPos.x | 0, y: rewardPos.y | 0 },
  });
  world.emit?.("deity:intervention", {
    deityId: String(challenge.deityId || ""),
    playerId: Number(challenge.playerId || 0) | 0,
    kind: "challenge_reward",
    challengeId,
    rewardId: rewardId || 0,
  });
}

function completeDefeatedChallenges(world) {
  for (const [, death] of world.query(DeathApplied)) {
    const deadId = Number(death.target || 0) | 0;
    if (!(deadId > 0)) continue;
    const member = world.get(deadId, DeityChallengeMember);
    if (!member) continue;
    const challengeId = Number(member.challengeId || 0) | 0;
    const challenge = world.get(challengeId, DeityAuthorshipState);
    if (!challenge || String(challenge.state || "") !== "active") continue;

    let remaining = 0;
    world.mutate(challengeId, DeityAuthorshipState, (rec) => {
      rec.remaining = Math.max(0, (Number(rec.remaining || 0) | 0) - 1);
      remaining = Number(rec.remaining || 0) | 0;
    });
    if (remaining > 0) continue;

    const latest = world.get(challengeId, DeityAuthorshipState) || challenge;
    rewardChallenge(world, challengeId, latest, death.at || null);
  }
}

/**
 * Deity-authored challenge system.
 *
 * First slice: when the dungeon has gone quiet and the player has left an
 * explored, cleared room behind, the deity may repopulate it with a small
 * monster challenge. Clearing that challenge creates a deterministic gold
 * reward through the canonical loot materializer.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function deityChallengeSystem(world) {
  completeDefeatedChallenges(world);

  const [playerId, playerPos, devotion] = currentPlayer(world);
  if (!(playerId > 0) || !playerPos || !devotion) return;

  const [, ds] = currentDungeonState(world);
  const depth = Number(ds?.currentDepth || 0) | 0;
  if (!(depth > 0)) return;
  if (hasActiveChallenge(world, playerId)) return;

  const state = ensureState(world);
  if (hasNearbyHostile(world, playerId, playerPos)) {
    state.quietTurns = 0;
    return;
  }
  state.quietTurns = Math.min(QUIET_TURNS_REQUIRED, (Number(state.quietTurns || 0) | 0) + 1);
  if (state.quietTurns < QUIET_TURNS_REQUIRED) return;
  if (((world.step | 0) - (Number(state.lastChallengeStep || 0) | 0)) < CHALLENGE_COOLDOWN_TURNS) return;

  const picked = chooseRoom(world, playerId, playerPos);
  if (!picked) return;

  const challengeId = spawnChallenge(world, playerId, playerPos, devotion, ds, picked);
  if (challengeId > 0) {
    state.lastChallengeStep = world.step | 0;
    state.quietTurns = 0;
  }
}
