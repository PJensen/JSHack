// FieldOfViewSystem: computes a visibility mask (FOV) for the current camera/player
// and stores it on the RenderContext so renderers can gate what is visible.
// This is distinct from lighting: LightGrid accumulates irradiance regardless of FOV.
import { RenderContext } from '../../components/RenderContext.js';
import { Position } from '../../components/Position.js';
import { Player } from '../../components/Player.js';
import { Tile } from '../../components/Tile.js';
import { Occluder } from '../../components/Occluder.js';
import { CONFIG } from '../../../config.js';

function buildOcclusionGrid(world, minX, minY, maxX, maxY){
  const W = maxX - minX + 1;
  const H = maxY - minY + 1;
  const op = new Float32Array(W*H);
  const idx = (x,y)=> (y-minY)*W + (x-minX);
  // Prefer Occluder.opacity if present; fallback to Tile.blocksLight
  // We walk tiles; entities with Occluder component are also considered via Position.
  for (const [id, pos, tile] of world.query(Position, Tile)){
    const x = pos.x|0, y = pos.y|0;
    if (x<minX||x>maxX||y<minY||y>maxY) continue;
    const o = tile.blocksLight ? 1 : 0;
    op[idx(x,y)] = Math.max(op[idx(x,y)], o);
  }
  for (const [id, pos, occ] of world.query(Position, Occluder)){
    const x = pos.x|0, y = pos.y|0;
    if (x<minX||x>maxX||y<minY||y>maxY) continue;
    const o = Math.max(0, Math.min(1, occ.opacity ?? 1));
    op[idx(x,y)] = Math.max(op[idx(x,y)], o);
  }
  return { op, W, H, idx, minX, minY };
}

export function FieldOfViewSystem(world){
  const rcId = world.renderContextId; if (!rcId) return;
  const rc = world.get(rcId, RenderContext); if (!rc) return;
  const cols = Math.max(1, rc.cols|0), rows = Math.max(1, rc.rows|0);
  const camX = rc.camX|0, camY = rc.camY|0;

  // Determine eye position (use Player with Position; fallback to center of viewport)
  let eyeX = (camX + (cols>>1))|0, eyeY = (camY + (rows>>1))|0;
  for (const [id, pos] of world.query(Position, Player)){
    eyeX = pos.x|0; eyeY = pos.y|0; break;
  }

  const R = Math.max(1, (rc.fovRadius ?? CONFIG.fovRadius) | 0);

  // Occlusion grid covers viewport plus radius margin
  const minX = camX - (R+1), minY = camY - (R+1);
  const maxX = camX + cols + (R+1);
  const maxY = camY + rows + (R+1);
  const occ = buildOcclusionGrid(world, minX, minY, maxX, maxY);

  // Allocate/resize visible mask for current viewport
  let vis = rc.visibleMask;
  if (!vis || vis.length !== cols*rows){ vis = new Uint8Array(cols*rows); }
  vis.fill(0);
  
  // Simple ray-cast FOV from eye; mark visible until opacity accumulates beyond threshold
  const rays = 256; // enough for smooth-ish edges
  const twoPi = Math.PI * 2;
  for (let i=0;i<rays;i++){
    const a = (i / rays) * twoPi;
    const dx = Math.cos(a), dy = Math.sin(a);
    let x = eyeX + 0.5, y = eyeY + 0.5;
    let T = 1.0; // transmittance along ray
    // DDA across tile grid
    const stepX = dx>0 ? 1 : -1; const stepY = dy>0 ? 1 : -1;
    let tMaxX = ((Math.floor(x) + (dx>0?1:0)) - x) / (dx||1e-6);
    let tMaxY = ((Math.floor(y) + (dy>0?1:0)) - y) / (dy||1e-6);
    const tDeltaX = Math.abs(1/(dx||1e-6)); const tDeltaY = Math.abs(1/(dy||1e-6));
    let cx = Math.floor(x), cy = Math.floor(y);
    for (let steps=0; steps < R*4; steps++){
      const wx = cx + 0.5, wy = cy + 0.5;
      const ddx = wx - eyeX, ddy = wy - eyeY;
      const d2 = ddx*ddx + ddy*ddy; if (d2 > R*R) break;
      // Map to viewport coords
      const vx = cx - camX, vy = cy - camY;
      if (vx>=0 && vy>=0 && vx<cols && vy<rows){ vis[vy*cols + vx] = 1; }

      // advance
      if (tMaxX < tMaxY){ x += tMaxX*dx; y += tMaxX*dy; tMaxX = tDeltaX; cx += stepX; }
      else { x += tMaxY*dx; y += tMaxY*dy; tMaxY = tDeltaY; cy += stepY; }

      // apply occlusion
      const ox = cx, oy = cy;
      const inside = (ox>=occ.minX && ox<occ.minX+occ.W && oy>=occ.minY && oy<occ.minY+occ.H);
      if (inside){
        const op = occ.op[occ.idx(ox,oy)];
        if (op > 0){
          const stepLen = 1; const thickness = 1;
          T *= Math.exp(-op * stepLen * thickness);
          if (T < 0.05) break; // essentially fully blocked
        }
      }
    }
  }

  // Persist to RenderContext so renderers can use it; also stash fov center/radius
  world.set(rcId, RenderContext, { visibleMask: vis, fovCenter:[eyeX, eyeY], fovRadius: R });
}
