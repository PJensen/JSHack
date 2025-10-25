// dungeonSpawnSystem.js
// After a dungeon level is generated, place the player at the spawn location once.
// Uses in-place mutations to avoid deferred commands and re-entry loops.

import { DungeonLevel } from '../../components/DungeonLevel.js';
import { Player } from '../../components/Player.js';
import { Position } from '../../components/Position.js';
import { RenderContext } from '../../components/RenderContext.js';
import { Camera } from '../../components/Camera.js';

export function dungeonSpawnSystem(world){
  // Find any generated level with a spawn point that hasn't been applied yet
  for (const [lid, lvl] of world.query(DungeonLevel)){
    if (!lvl || !lvl.generated) continue;
    if (!lvl.spawn || typeof lvl.spawn.x !== 'number' || typeof lvl.spawn.y !== 'number') continue;
    if (lvl._spawnApplied) continue;

    // Move first player to spawn
    let applied = false;
    for (const [pid, pos] of world.query(Position, Player)){
      pos.x = lvl.spawn.x | 0;
      pos.y = lvl.spawn.y | 0;
      applied = true;
      break;
    }

    if (applied){
      // Mark gate in-place to avoid repeated placement across frames
      lvl._spawnApplied = true;

      // Nudge camera immediately this frame so the first visible frame is correct
      try{
        // Update Camera entity if present
        for (const [cid, cam] of world.query(Camera)){
          // Prefer RenderContext cols/rows if present
          let cols = cam.cols|0, rows = cam.rows|0;
          const rcId = world.renderContextId;
          if (rcId){
            const rc = world.getInstance(rcId, RenderContext) || world.get(rcId, RenderContext);
            if (rc){
              if (typeof rc.cols === 'number') cols = rc.cols|0;
              if (typeof rc.rows === 'number') rows = rc.rows|0;
            }
          }
          cam.x = Math.floor(pos.x - cols/2);
          cam.y = Math.floor(pos.y - rows/2);
          // Mirror to RC for renderers this same frame
          if (rcId){
            const rc = world.getInstance(rcId, RenderContext) || world.get(rcId, RenderContext);
            if (rc){ rc.camX = cam.x; rc.camY = cam.y; world.markChanged(rcId, RenderContext); }
          }
          break;
        }
      }catch(e){ /* ignore camera nudge errors */ }
    }
  }
}
