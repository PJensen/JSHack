// monsterAISystem.js
// Basic AI: if player in line of sight and within visionRange, step toward the player.

import { Position } from '../components/Position.js';
import { Player } from '../components/Player.js';
import { Monster } from '../components/Monster.js';
import { InputIntent } from '../components/InputIntent.js';
import { MapView } from '../components/MapView.js';
import { bresenhamLine } from '../../util/bresenham.js';
import { TurnState } from '../components/TurnState.js';

function getPrimaryMapView(world){
  let mv = null; const mvId = world.mapViewId | 0;
  try { if (mvId) mv = world.get(mvId, MapView); } catch(_) {}
  if (!mv){ for (const [id,_mv] of world.query(MapView)){ mv = _mv; break; } }
  return mv;
}

function canSee(world, mv, x0, y0, x1, y1){
  // Chebyshev distance cap (fast reject)
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const dist = Math.max(dx, dy);
  if (dist <= 0) return true;

  const opaqueAt = mv?.opaqueAt; const tileAt = mv?.tileAt;
  // Iterate along line excluding the start; allow end tile
  for (const [x,y] of bresenhamLine(x0, y0, x1, y1)){
    if (x === x1 && y === y1) return true;
    // Out-of-bounds is opaque
    if (typeof opaqueAt === 'function'){
      if (opaqueAt(x,y)) return false;
    } else if (typeof tileAt === 'function'){
      const t = tileAt(x,y); if (!t) return false; if (t.blocksLight) return false;
    } else {
      // No map info: optimistic
      continue;
    }
  }
  return true;
}

export function monsterAISystem(world){
  // Gate monster actions to TurnState: only act during the 'monsters' phase.
  try{
    const tid = world.turnStateId | 0;
    const ts = tid ? world.get(tid, TurnState) : null;
    if (!ts || ts.phase !== 'monsters') return;
  }catch(_){ /* if no turn state yet, don't move */ return; }

  // Legacy gate (fallback): if TurnState is missing, tie to player edge intent
  let playerId = 0, playerPos = null, playerIntent = null;
  for (const [id, p] of world.query(Position, Player)){ playerId = id; playerPos = p; break; }
  if (!playerId || !playerPos) return;
  try { playerIntent = world.get(playerId, InputIntent); } catch(_) { playerIntent = null; }
  const didPlayerAct = !!(playerIntent && ((playerIntent.dx|0)!==0 || (playerIntent.dy|0)!==0));
  // If we somehow got here with phase=monsters and no player act marker, still proceed

  const mv = getPrimaryMapView(world);

  for (const [mid, mpos, mdata] of world.query(Position, Monster)){
    // Only act for monsters that have an AI type; e.g., Target Dummies have ai=null and should not move
    if (!mdata || !mdata.ai) continue;
    const vision = Math.max(1, (mdata?.visionRange ?? 12) | 0);
    const dx = playerPos.x - mpos.x;
    const dy = playerPos.y - mpos.y;
    const cdist = Math.max(Math.abs(dx), Math.abs(dy));
    if (cdist > vision) continue;

    // Confirm line of sight using map
    if (mv && !canSee(world, mv, mpos.x|0, mpos.y|0, playerPos.x|0, playerPos.y|0)){
      continue;
    }

    // Step greedily toward player (normalize to -1..1)
    const stepX = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
    const stepY = dy === 0 ? 0 : (dy > 0 ? 1 : -1);

    if (stepX !== 0 || stepY !== 0){
      try {
        if (!world.has(mid, InputIntent)) world.add(mid, InputIntent, { dx: 0, dy: 0 });
        world.set(mid, InputIntent, { dx: stepX, dy: stepY });
      } catch(_) { /* ignore */ }
    }
  }
}

export default monsterAISystem;
