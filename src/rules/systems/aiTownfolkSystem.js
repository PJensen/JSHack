// src/rules/systems/aiTownfolkSystem.js
// Townfolk NPC AI: scheduled overworld routines plus legacy fallback behavior.

import { Position } from "../components/Position.js";
import { Faction } from "../components/Faction.js";
import { Speed } from "../components/Speed.js";
import { MoveIntent } from "../components/Intents/MoveIntent.js";
import { Player } from "../components/Player.js";
import { DungeonState } from "../components/DungeonState.js";
import { TownfolkJob, TOWNFOLK_STATES, TOWNFOLK_ROLES } from "../components/TownfolkJob.js";
import { DoorState } from "../components/DoorState.js";
import { Collider } from "../components/Collider.js";
import { forEachInRadius } from "../utils/spatialIndex.js";
import { invalidateTileQueryCache } from "../utils/tileQueryCache.js";
import { findNextCardinalStep } from "../utils/gridPathfind.js";
import { isWalkable, getTile, setTile } from "../environment/dungeon/tileMap.js";
import {
  getDestroyedTileLedger, getDestroyedTileRecord,
  destroyedTileKey, getDungeonStateRecord,
} from "../utils/destroyedTiles.js";
import {
  TILE_TREE, TILE_GRASS, TILE_STAIR_DOWN, TILE_STAIR_UP,
} from "../environment/dungeon/constants.js";

const TOWNFOLK_RADIUS = 40;
const MAX_STUCK_TURNS = 5;
const WORK_RANGE = 15;
const DAY_LENGTH = 96;
const TOWNFOLK_DOOR_INSTALLED = Symbol.for("jshack:townfolkDoors:installed");

const DIRS = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
];

function emitSafe(world, event, payload) {
  try { world.emit?.(event, payload); } catch {}
}

function getTownPhase(step) {
  const t = Math.max(0, step | 0) % DAY_LENGTH;
  if (t < 18) return "sleep";
  if (t < 26) return "breakfast";
  if (t < 62) return "work";
  if (t < 84) return "pub";
  return "home";
}

function atTarget(pos, x, y) {
  return pos.x === x && pos.y === y;
}

function nearPoint(pos, x, y, dist = 1) {
  return Math.abs(pos.x - x) <= dist && Math.abs(pos.y - y) <= dist;
}

function findDoorAt(world, x, y) {
  for (const [id, pos, state] of world.query(Position, DoorState)) {
    if (pos.x === x && pos.y === y) return { id, state };
  }
  return null;
}

function doorOccupied(world, x, y) {
  for (const [id, pos] of world.query(Position)) {
    if (pos.x !== x || pos.y !== y) continue;
    if (world.has(id, DoorState)) continue;
    return true;
  }
  return false;
}

function setDoorOpen(world, doorId, open, actor = 0) {
  const ds = world.get(doorId, DoorState);
  if (!ds || ds.open === open) return false;
  world.set(doorId, DoorState, { ...ds, open });
  const col = world.get(doorId, Collider);
  if (col) world.set(doorId, Collider, { ...col, solid: !open, blocksSight: !open });
  invalidateTileQueryCache(world);
  emitSafe(world, "interaction", {
    actor,
    targetId: doorId,
    action: "toggleDoor",
    result: open ? "opened" : "closed",
  });
  return true;
}

export function installTownfolkDoorListener(world) {
  if (!world || world[TOWNFOLK_DOOR_INSTALLED]) return;
  world[TOWNFOLK_DOOR_INSTALLED] = true;

  world.on("moved", ({ id, from }) => {
    const fac = world.get(id, Faction);
    if (fac?.key !== "townfolk") return;
    const door = findDoorAt(world, from?.x, from?.y);
    if (!door || !door.state?.open) return;
    if (doorOccupied(world, from.x, from.y)) return;
    setDoorOpen(world, door.id, false, id);
  });
}

function maybeOpenDoor(world, actorId, x, y) {
  const door = findDoorAt(world, x, y);
  if (!door || door.state?.open) return false;
  setDoorOpen(world, door.id, true, actorId);
  return true;
}

function findAdjacentWalkable(x, y) {
  for (const d of DIRS) {
    const nx = x + d.dx;
    const ny = y + d.dy;
    if (!isWalkable(nx, ny)) continue;
    const t = getTile(nx, ny);
    if (t !== TILE_STAIR_DOWN && t !== TILE_STAIR_UP) return { x: nx, y: ny };
  }
  return null;
}

function stepToward(world, id, pos, tx, ty) {
  const next = findNextCardinalStep(world, pos.x, pos.y, tx, ty, id, { goalRadius: 0, maxNodes: 256 });
  const dx = next?.dx ?? 0;
  const dy = next?.dy ?? 0;
  if (dx === 0 && dy === 0) return false;

  const nx = pos.x + dx;
  const ny = pos.y + dy;
  if (!isWalkable(nx, ny)) return false;
  const t = getTile(nx, ny);
  if (t === TILE_STAIR_DOWN || t === TILE_STAIR_UP) return false;
  if (maybeOpenDoor(world, id, nx, ny)) return true;
  try { world.add(id, MoveIntent, { dx, dy }); } catch { return false; }
  return true;
}

function setIdle(job, world) {
  job.state = TOWNFOLK_STATES.idle;
  job.idleTurns = 3 + Math.floor(world.rand() * 6);
  job.stuckTurns = 0;
  job.workSiteKind = "";
}

function setReturning(job) {
  job.state = TOWNFOLK_STATES.returning;
  job.targetX = job.homeX;
  job.targetY = job.homeY;
  job.stuckTurns = 0;
}

function handleIdle(world, id, pos, job) {
  if (job.idleTurns > 0) {
    job.idleTurns--;
    return;
  }

  switch (job.role) {
    case TOWNFOLK_ROLES.farmer: {
      const ox = Math.floor(world.rand() * 5) - 2;
      const oy = 1 + Math.floor(world.rand() * 5);
      job.targetX = job.homeX + ox;
      job.targetY = job.homeY + oy;
      job.workSiteKind = "tend";
      break;
    }
    case TOWNFOLK_ROLES.woodcutter: {
      let best = null;
      let bestDist = Infinity;
      for (let r = 1; r <= WORK_RANGE; r++) {
        for (let ddx = -r; ddx <= r; ddx++) {
          for (let ddy = -r; ddy <= r; ddy++) {
            if (Math.abs(ddx) !== r && Math.abs(ddy) !== r) continue;
            const tx = job.homeX + ddx;
            const ty = job.homeY + ddy;
            if (getTile(tx, ty) !== TILE_TREE) continue;
            const d = Math.abs(ddx) + Math.abs(ddy);
            if (d < bestDist) {
              bestDist = d;
              best = { x: tx, y: ty };
            }
          }
        }
        if (best) break;
      }
      if (!best) {
        job.idleTurns = 8;
        return;
      }
      const adj = findAdjacentWalkable(best.x, best.y);
      if (!adj) {
        job.idleTurns = 5;
        return;
      }
      job.targetX = adj.x;
      job.targetY = adj.y;
      job.workSiteKind = "chop";
      break;
    }
    case TOWNFOLK_ROLES.miner: {
      const ox = 10 + Math.floor(world.rand() * 10);
      const oy = -(5 + Math.floor(world.rand() * 10));
      job.targetX = job.homeX + ox;
      job.targetY = job.homeY + oy;
      job.workSiteKind = "mine";
      break;
    }
    case TOWNFOLK_ROLES.smith: {
      const ox = Math.floor(world.rand() * 5) - 2;
      const oy = Math.floor(world.rand() * 5) - 2;
      job.targetX = job.homeX + ox;
      job.targetY = job.homeY + oy;
      job.workSiteKind = "smith";
      break;
    }
    case TOWNFOLK_ROLES.priest: {
      const ox = Math.floor(world.rand() * 3) - 1;
      const oy = Math.floor(world.rand() * 3) - 1;
      job.targetX = job.homeX + ox;
      job.targetY = job.homeY + oy;
      job.workSiteKind = "pray";
      break;
    }
    case TOWNFOLK_ROLES.barkeep: {
      const ox = Math.floor(world.rand() * 5) - 2;
      const oy = Math.floor(world.rand() * 3) - 1;
      job.targetX = job.homeX + ox;
      job.targetY = job.homeY + oy;
      job.workSiteKind = "serve";
      break;
    }
    case TOWNFOLK_ROLES.mason: {
      const ledger = getDestroyedTileLedger(world);
      const entries = Object.values(ledger);
      if (entries.length === 0) {
        job.idleTurns = 8;
        return;
      }
      let best = null;
      let bestDist = Infinity;
      for (const rec of entries) {
        const d = Math.abs(rec.x - pos.x) + Math.abs(rec.y - pos.y);
        if (d < bestDist) {
          bestDist = d;
          best = rec;
        }
      }
      if (!best || bestDist > 40) {
        job.idleTurns = 8;
        return;
      }
      job.targetX = best.x;
      job.targetY = best.y;
      job.workSiteKind = "repair";
      break;
    }
    default: {
      const ox = Math.floor(world.rand() * 17) - 8;
      const oy = Math.floor(world.rand() * 17) - 8;
      job.targetX = job.homeX + ox;
      job.targetY = job.homeY + oy;
      job.workSiteKind = "wander";
      break;
    }
  }

  job.state = TOWNFOLK_STATES.walking;
  job.stuckTurns = 0;
}

function handleWalking(world, id, pos, job) {
  if (atTarget(pos, job.targetX, job.targetY) || nearPoint(pos, job.targetX, job.targetY, 1)) {
    job.state = TOWNFOLK_STATES.working;
    job.workTurns = 2 + Math.floor(world.rand() * 3);
    job.stuckTurns = 0;
    return;
  }

  const moved = stepToward(world, id, pos, job.targetX, job.targetY);
  if (!moved) {
    job.stuckTurns++;
    if (job.stuckTurns >= MAX_STUCK_TURNS) setIdle(job, world);
    return;
  }
  job.stuckTurns = 0;
}

function handleWorking(world, id, pos, job) {
  if (job.workTurns > 0) {
    job.workTurns--;
    return;
  }

  switch (job.workSiteKind) {
    case "chop": {
      for (const d of DIRS) {
        const tx = pos.x + d.dx;
        const ty = pos.y + d.dy;
        if (getTile(tx, ty) !== TILE_TREE) continue;
        setTile(tx, ty, TILE_GRASS);
        emitSafe(world, "townfolk:chopped", { actor: id, x: tx, y: ty });
        job.carrying = "wood";
        emitSafe(world, "townfolk:carrying", { actor: id, resource: "wood" });
        setReturning(job);
        return;
      }
      setReturning(job);
      return;
    }
    case "mine":
      emitSafe(world, "townfolk:mined", { actor: id, x: pos.x, y: pos.y });
      job.carrying = "ore";
      emitSafe(world, "townfolk:carrying", { actor: id, resource: "ore" });
      setReturning(job);
      return;
    case "repair": {
      const rec = getDestroyedTileRecord(world, job.targetX, job.targetY);
      if (rec && rec.originalTile != null) {
        setTile(job.targetX, job.targetY, rec.originalTile);
        const ds = getDungeonStateRecord(world);
        if (ds && ds.destroyedTiles) {
          delete ds.destroyedTiles[destroyedTileKey(job.targetX, job.targetY)];
        }
        emitSafe(world, "townfolk:repaired", { actor: id, x: job.targetX, y: job.targetY });
      }
      setReturning(job);
      return;
    }
    default:
      setReturning(job);
      return;
  }
}

function handleReturning(world, id, pos, job) {
  if (nearPoint(pos, job.homeX, job.homeY, 2)) {
    setIdle(job, world);
    if (job.carrying) emitSafe(world, "townfolk:delivered", { actor: id, resource: job.carrying });
    job.carrying = "";
    return;
  }

  const moved = stepToward(world, id, pos, job.targetX, job.targetY);
  if (!moved) {
    job.stuckTurns++;
    if (job.stuckTurns >= MAX_STUCK_TURNS) setIdle(job, world);
    return;
  }
  job.stuckTurns = 0;
}

function getRoleWorkTarget(world, job) {
  const workBeat = Math.floor((Math.max(0, world.step | 0) % 24) / 6);
  switch (job.role) {
    case TOWNFOLK_ROLES.farmer:
      if ((workBeat % 2) === 0) {
        return { x: job.workX, y: job.workY, kind: "tend", state: TOWNFOLK_STATES.working, radius: 1 };
      }
      return { x: job.workAuxX, y: job.workAuxY, kind: "mill", state: TOWNFOLK_STATES.working, radius: 0 };
    case TOWNFOLK_ROLES.woodcutter:
      return { x: job.workX, y: job.workY, kind: "chop", state: TOWNFOLK_STATES.working, radius: 1 };
    case TOWNFOLK_ROLES.miner:
      return { x: job.workX, y: job.workY, kind: "mine", state: TOWNFOLK_STATES.working, radius: 1 };
    case TOWNFOLK_ROLES.smith:
      return { x: job.workX, y: job.workY, kind: "smith", state: TOWNFOLK_STATES.working, radius: 1 };
    case TOWNFOLK_ROLES.priest:
      if ((workBeat % 2) === 0) {
        return { x: job.workX, y: job.workY, kind: "minister", state: TOWNFOLK_STATES.working, radius: 1 };
      }
      return { x: job.workAuxX, y: job.workAuxY, kind: "pray", state: TOWNFOLK_STATES.working, radius: 0 };
    case TOWNFOLK_ROLES.barkeep:
      if ((workBeat % 2) === 0) {
        return { x: job.workX, y: job.workY, kind: "serve", state: TOWNFOLK_STATES.working, radius: 0 };
      }
      return { x: job.workAuxX, y: job.workAuxY, kind: "pour", state: TOWNFOLK_STATES.working, radius: 0 };
    case TOWNFOLK_ROLES.mason: {
      const ledger = Object.values(getDestroyedTileLedger(world));
      let best = null;
      let bestDist = Infinity;
      for (const rec of ledger) {
        const d = Math.abs(rec.x - job.homeX) + Math.abs(rec.y - job.homeY);
        if (d < bestDist) {
          bestDist = d;
          best = rec;
        }
      }
      if (best && bestDist <= 40) {
        return { x: best.x, y: best.y, kind: "repair", state: TOWNFOLK_STATES.working, radius: 0 };
      }
      return { x: job.workX, y: job.workY, kind: "inspect", state: TOWNFOLK_STATES.working, radius: 1 };
    }
    case TOWNFOLK_ROLES.villager:
    default:
      if ((workBeat % 2) === 0) {
        return { x: job.workX, y: job.workY, kind: "garden", state: TOWNFOLK_STATES.working, radius: 1 };
      }
      return { x: job.workAuxX, y: job.workAuxY, kind: "haul", state: TOWNFOLK_STATES.working, radius: 1 };
  }
}

function getScheduleTarget(world, job) {
  const phase = getTownPhase(world.step);
  if (phase === "sleep") {
    return { phase, x: job.bedX || job.homeX, y: job.bedY || job.homeY, kind: "sleep", state: TOWNFOLK_STATES.sleeping, radius: 0 };
  }
  if (phase === "breakfast") {
    return { phase, x: job.homeX, y: job.homeY, kind: "home", state: TOWNFOLK_STATES.idle, radius: 1 };
  }
  if (phase === "pub") {
    return { phase, x: job.pubX || job.homeX, y: job.pubY || job.homeY, kind: "pub", state: TOWNFOLK_STATES.socializing, radius: 1 };
  }
  if (phase === "home") {
    return { phase, x: job.homeX, y: job.homeY, kind: "home", state: TOWNFOLK_STATES.returning, radius: 1 };
  }
  return { phase, ...getRoleWorkTarget(world, job) };
}

function emitRoleWork(world, id, pos, job, target) {
  switch (target.kind) {
    case "tend":
      emitSafe(world, "townfolk:tended", { actor: id, x: pos.x, y: pos.y });
      break;
    case "mill":
      emitSafe(world, "townfolk:milled", { actor: id, x: pos.x, y: pos.y });
      break;
    case "smith":
      emitSafe(world, "townfolk:forged", { actor: id, x: pos.x, y: pos.y });
      break;
    case "minister":
    case "pray":
      emitSafe(world, "townfolk:blessed", { actor: id, x: pos.x, y: pos.y });
      break;
    case "serve":
    case "pour":
      emitSafe(world, "townfolk:poured", { actor: id, x: pos.x, y: pos.y });
      break;
    case "haul":
    case "garden":
      emitSafe(world, "townfolk:worked", { actor: id, x: pos.x, y: pos.y, kind: target.kind });
      break;
    case "inspect":
      emitSafe(world, "townfolk:inspected", { actor: id, x: pos.x, y: pos.y });
      break;
    case "pub":
      emitSafe(world, "townfolk:unwound", { actor: id, x: pos.x, y: pos.y });
      break;
    case "sleep":
      emitSafe(world, "townfolk:slept", { actor: id, x: pos.x, y: pos.y });
      break;
    default:
      break;
  }

  if (target.kind === "chop" || target.kind === "mine" || target.kind === "repair") {
    job.workSiteKind = target.kind;
    job.workTurns = 0;
    handleWorking(world, id, pos, job);
    return;
  }

  job.workTurns = 2 + Math.floor(world.rand() * 3);
}

function handleScheduledTownfolk(world, id, pos, job) {
  const target = getScheduleTarget(world, job);
  const phaseChanged = target.phase !== job.lastPhase;
  if (phaseChanged) {
    job.lastPhase = target.phase;
    job.workTurns = 0;
    job.stuckTurns = 0;
    job.routineKind = target.kind;
    emitSafe(world, "townfolk:routine", { actor: id, phase: target.phase, kind: target.kind });
  }

  job.targetX = target.x;
  job.targetY = target.y;
  job.workSiteKind = target.kind;
  job.routineKind = target.kind;

  if (!nearPoint(pos, target.x, target.y, target.radius)) {
    job.state = TOWNFOLK_STATES.walking;
    const moved = stepToward(world, id, pos, target.x, target.y);
    if (!moved) {
      job.stuckTurns++;
      if (job.stuckTurns >= MAX_STUCK_TURNS) {
        job.stuckTurns = 0;
        job.state = target.state;
      }
      return;
    }
    job.stuckTurns = 0;
    return;
  }

  job.state = target.state;
  job.stuckTurns = 0;
  if (target.kind === "sleep" || target.kind === "home") return;
  if (job.workTurns > 0) {
    job.workTurns--;
    return;
  }
  emitRoleWork(world, id, pos, job, target);
}

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function aiTownfolkSystem(world) {
  let depth = -1;
  for (const [, ds] of world.query(DungeonState)) {
    depth = ds.currentDepth ?? -1;
    break;
  }
  if (depth !== 0) return;

  let playerPos = null;
  for (const [, , pos] of world.query(Player, Position)) {
    playerPos = { x: pos.x, y: pos.y };
    break;
  }
  if (!playerPos) return;

  forEachInRadius(world, playerPos.x, playerPos.y, TOWNFOLK_RADIUS, (id, pos) => {
    const fac = world.get(id, Faction);
    if (fac?.key !== "townfolk") return;

    const job = world.get(id, TownfolkJob);
    if (!job) return;

    const spd = world.get(id, Speed);
    const actEvery = spd?.actEvery > 1 ? spd.actEvery : 1;
    if (actEvery > 1 && ((world.step + id) % actEvery) !== 0) return;
    if (world.has(id, MoveIntent)) return;

    if (job.scheduleEnabled) {
      handleScheduledTownfolk(world, id, pos, job);
      return;
    }

    switch (job.state) {
      case TOWNFOLK_STATES.idle:
        handleIdle(world, id, pos, job);
        break;
      case TOWNFOLK_STATES.walking:
        handleWalking(world, id, pos, job);
        break;
      case TOWNFOLK_STATES.working:
        handleWorking(world, id, pos, job);
        break;
      case TOWNFOLK_STATES.returning:
        handleReturning(world, id, pos, job);
        break;
      default:
        break;
    }
  });
}
