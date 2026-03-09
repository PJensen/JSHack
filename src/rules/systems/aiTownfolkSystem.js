// src/rules/systems/aiTownfolkSystem.js
// Townfolk NPC AI: simple state-machine routines for overworld villagers.
// Each NPC cycles idle → walking → working → returning → idle.
// Runs only on depth 0; uses forEachInRadius for bounded iteration.

import { Position }       from "../components/Position.js";
import { Faction }        from "../components/Faction.js";
import { Speed }          from "../components/Speed.js";
import { MoveIntent }     from "../components/Intents/MoveIntent.js";
import { Player }         from "../components/Player.js";
import { DungeonState }   from "../components/DungeonState.js";
import { TownfolkJob, TOWNFOLK_STATES, TOWNFOLK_ROLES } from "../components/TownfolkJob.js";
import { forEachInRadius } from "../utils/spatialIndex.js";
import { isWalkable, getTile, setTile } from "../environment/dungeon/tileMap.js";
import {
  getDestroyedTileLedger, getDestroyedTileRecord,
  destroyedTileKey, getDungeonStateRecord,
} from "../utils/destroyedTiles.js";
import {
  TILE_TREE, TILE_GRASS, TILE_STAIR_DOWN, TILE_STAIR_UP,
} from "../environment/dungeon/constants.js";

const TOWNFOLK_RADIUS  = 40;
const MAX_STUCK_TURNS  = 5;
const WORK_RANGE       = 15;

// Cardinals for random wander.
const DIRS = [
  { dx:  0, dy: -1 },
  { dx:  0, dy:  1 },
  { dx:  1, dy:  0 },
  { dx: -1, dy:  0 },
];

// ── helpers ────────────────────────────────────────────────────────

function stepToward(world, id, pos, tx, ty) {
  const dx = tx - pos.x;
  const dy = ty - pos.y;
  if (dx === 0 && dy === 0) return false;

  // Try dominant axis first, then the other.
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const attempts = ax >= ay
    ? [{ dx: Math.sign(dx), dy: 0 }, { dx: 0, dy: Math.sign(dy) }]
    : [{ dx: 0, dy: Math.sign(dy) }, { dx: Math.sign(dx), dy: 0 }];

  for (const dir of attempts) {
    if (dir.dx === 0 && dir.dy === 0) continue;
    const nx = pos.x + dir.dx;
    const ny = pos.y + dir.dy;
    if (!isWalkable(nx, ny)) continue;
    const t = getTile(nx, ny);
    if (t === TILE_STAIR_DOWN || t === TILE_STAIR_UP) continue;
    try { world.add(id, MoveIntent, { dx: dir.dx, dy: dir.dy }); } catch { return false; }
    return true;
  }
  return false;
}

function atTarget(pos, job) {
  return pos.x === job.targetX && pos.y === job.targetY;
}

function nearTarget(pos, job, dist) {
  return Math.abs(pos.x - job.targetX) <= dist && Math.abs(pos.y - job.targetY) <= dist;
}

function nearHome(pos, job, dist) {
  return Math.abs(pos.x - job.homeX) <= dist && Math.abs(pos.y - job.homeY) <= dist;
}

function setIdle(job, world) {
  job.state       = TOWNFOLK_STATES.idle;
  job.idleTurns   = 3 + Math.floor(world.rand() * 6);
  job.stuckTurns  = 0;
  job.workSiteKind = "";
}

function setReturning(job) {
  job.state    = TOWNFOLK_STATES.returning;
  job.targetX  = job.homeX;
  job.targetY  = job.homeY;
  job.stuckTurns = 0;
}

// ── idle: pick next work target ────────────────────────────────────

function handleIdle(world, id, pos, job) {
  if (job.idleTurns > 0) {
    job.idleTurns--;
    return;
  }

  switch (job.role) {
    case TOWNFOLK_ROLES.farmer: {
      // Walk to a crop-area offset from home
      const ox = Math.floor(world.rand() * 5) - 2;
      const oy = 1 + Math.floor(world.rand() * 5);
      job.targetX = job.homeX + ox;
      job.targetY = job.homeY + oy;
      job.workSiteKind = "tend";
      break;
    }
    case TOWNFOLK_ROLES.woodcutter: {
      // Scan for nearest tree within WORK_RANGE of home
      let best = null;
      let bestDist = Infinity;
      for (let r = 1; r <= WORK_RANGE; r++) {
        for (let ddx = -r; ddx <= r; ddx++) {
          for (let ddy = -r; ddy <= r; ddy++) {
            if (Math.abs(ddx) !== r && Math.abs(ddy) !== r) continue;
            const tx = job.homeX + ddx;
            const ty = job.homeY + ddy;
            if (getTile(tx, ty) === TILE_TREE) {
              const d = Math.abs(ddx) + Math.abs(ddy);
              if (d < bestDist) { bestDist = d; best = { x: tx, y: ty }; }
            }
          }
        }
        if (best) break;
      }
      if (!best) { job.idleTurns = 8; return; }
      // Target an adjacent walkable tile (can't stand on the tree itself)
      const adj = findAdjacentWalkable(best.x, best.y);
      if (!adj) { job.idleTurns = 5; return; }
      job.targetX = adj.x;
      job.targetY = adj.y;
      job.workSiteKind = "chop";
      break;
    }
    case TOWNFOLK_ROLES.miner: {
      // Walk toward mountain area (fixed offset from home toward ore)
      const ox = 10 + Math.floor(world.rand() * 10);
      const oy = -(5 + Math.floor(world.rand() * 10));
      job.targetX = job.homeX + ox;
      job.targetY = job.homeY + oy;
      job.workSiteKind = "mine";
      break;
    }
    case TOWNFOLK_ROLES.smith: {
      // Wander near home (the furnace area)
      const ox = Math.floor(world.rand() * 5) - 2;
      const oy = Math.floor(world.rand() * 5) - 2;
      job.targetX = job.homeX + ox;
      job.targetY = job.homeY + oy;
      job.workSiteKind = "smith";
      break;
    }
    case TOWNFOLK_ROLES.priest: {
      // Wander inside church (small area around home)
      const ox = Math.floor(world.rand() * 3) - 1;
      const oy = Math.floor(world.rand() * 3) - 1;
      job.targetX = job.homeX + ox;
      job.targetY = job.homeY + oy;
      job.workSiteKind = "pray";
      break;
    }
    case TOWNFOLK_ROLES.barkeep: {
      // Wander inside tavern
      const ox = Math.floor(world.rand() * 5) - 2;
      const oy = Math.floor(world.rand() * 3) - 1;
      job.targetX = job.homeX + ox;
      job.targetY = job.homeY + oy;
      job.workSiteKind = "serve";
      break;
    }
    case TOWNFOLK_ROLES.mason: {
      // Find nearest destroyed tile
      const ledger = getDestroyedTileLedger(world);
      const entries = Object.values(ledger);
      if (entries.length === 0) { job.idleTurns = 8; return; }
      let best = null;
      let bestDist = Infinity;
      for (const rec of entries) {
        const d = Math.abs(rec.x - pos.x) + Math.abs(rec.y - pos.y);
        if (d < bestDist) { bestDist = d; best = rec; }
      }
      if (!best || bestDist > 40) { job.idleTurns = 8; return; }
      job.targetX = best.x;
      job.targetY = best.y;
      job.workSiteKind = "repair";
      break;
    }
    case TOWNFOLK_ROLES.villager:
    default: {
      // Random walkable tile within 8 tiles
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

function findAdjacentWalkable(x, y) {
  for (const d of DIRS) {
    const nx = x + d.dx;
    const ny = y + d.dy;
    if (isWalkable(nx, ny)) {
      const t = getTile(nx, ny);
      if (t !== TILE_STAIR_DOWN && t !== TILE_STAIR_UP) return { x: nx, y: ny };
    }
  }
  return null;
}

// ── walking: move toward target ────────────────────────────────────

function handleWalking(world, id, pos, job) {
  if (atTarget(pos, job) || nearTarget(pos, job, 1)) {
    job.state = TOWNFOLK_STATES.working;
    job.workTurns = 2 + Math.floor(world.rand() * 3);
    job.stuckTurns = 0;
    return;
  }

  const moved = stepToward(world, id, pos, job.targetX, job.targetY);
  if (!moved) {
    job.stuckTurns++;
    if (job.stuckTurns >= MAX_STUCK_TURNS) {
      setIdle(job, world);
    }
  } else {
    job.stuckTurns = 0;
  }
}

// ── working: perform role action ───────────────────────────────────

function handleWorking(world, id, pos, job) {
  if (job.workTurns > 0) {
    job.workTurns--;
    return;
  }

  switch (job.workSiteKind) {
    case "chop": {
      // Find adjacent tree tile and chop it
      for (const d of DIRS) {
        const tx = pos.x + d.dx;
        const ty = pos.y + d.dy;
        if (getTile(tx, ty) === TILE_TREE) {
          setTile(tx, ty, TILE_GRASS);
          try { world.emit("townfolk:chopped", { actor: id, x: tx, y: ty }); } catch {}
          // Set returning state — carry wood back to town
          job.state = TOWNFOLK_STATES.returning;
          job.targetX = job.homeX;
          job.targetY = job.homeY;
          job.stuckTurns = 0;
          try { world.emit("townfolk:carrying", { actor: id, resource: "wood" }); } catch {}
          return;
        }
      }
      // No tree found, just go home
      setReturning(job);
      break;
    }
    case "mine": {
      // Cosmetic mining — then carry ore back
      job.state = TOWNFOLK_STATES.returning;
      job.targetX = job.homeX;
      job.targetY = job.homeY;
      job.stuckTurns = 0;
      try { world.emit("townfolk:mined", { actor: id, x: pos.x, y: pos.y }); } catch {}
      try { world.emit("townfolk:carrying", { actor: id, resource: "ore" }); } catch {}
      return;
    }
    case "repair": {
      const rec = getDestroyedTileRecord(world, job.targetX, job.targetY);
      if (rec && rec.originalTile != null) {
        setTile(job.targetX, job.targetY, rec.originalTile);
        const ds = getDungeonStateRecord(world);
        if (ds && ds.destroyedTiles) {
          const key = destroyedTileKey(job.targetX, job.targetY);
          delete ds.destroyedTiles[key];
        }
        try { world.emit("townfolk:repaired", { actor: id, x: job.targetX, y: job.targetY }); } catch {}
      }
      setReturning(job);
      break;
    }
    default:
      // Cosmetic work (farming, smithing, praying, serving, wandering)
      setReturning(job);
      break;
  }
}

// ── returning: walk home ───────────────────────────────────────────

function handleReturning(world, id, pos, job) {
  if (nearHome(pos, job, 2)) {
    setIdle(job, world);
    // Emit delivery event if carrying resources
    try { world.emit("townfolk:delivered", { actor: id }); } catch {}
    return;
  }

  const moved = stepToward(world, id, pos, job.targetX, job.targetY);
  if (!moved) {
    job.stuckTurns++;
    if (job.stuckTurns >= MAX_STUCK_TURNS) {
      setIdle(job, world);
    }
  } else {
    job.stuckTurns = 0;
  }
}

// ── main system ────────────────────────────────────────────────────

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function aiTownfolkSystem(world) {
  // Only operate on overworld (depth 0).
  let depth = -1;
  for (const [, ds] of world.query(DungeonState)) { depth = ds.currentDepth ?? -1; break; }
  if (depth !== 0) return;

  // Find player for radius anchor.
  let playerPos = null;
  for (const [, , pos] of world.query(Player, Position)) {
    playerPos = { x: pos.x, y: pos.y };
    break;
  }
  if (!playerPos) return;

  forEachInRadius(world, playerPos.x, playerPos.y, TOWNFOLK_RADIUS, (id, pos) => {
    const fac = world.get(id, Faction);
    if (!fac || fac.key !== "townfolk") return;

    const job = world.get(id, TownfolkJob);
    if (!job) return;

    // Speed gate (same pattern as aiScurrySystem).
    const spd = world.get(id, Speed);
    const actEvery = (spd && spd.actEvery > 1) ? spd.actEvery : 1;
    if (actEvery > 1 && ((world.step + id) % actEvery) !== 0) return;

    // Skip if another system already queued a move this tick.
    if (world.has(id, MoveIntent)) return;

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
    }
  });
}
