// FieldOfViewSystem: computes a visibility mask (FOV) for the current camera/player
// and stores it on the RenderContext so renderers can gate what is visible.
// This is distinct from lighting: LightGrid accumulates irradiance regardless of FOV.
import { RenderContext } from '../../components/RenderContext.js';
import { Position } from '../../components/Position.js';
import { Player } from '../../components/Player.js';
import { Tile } from '../../components/Tile.js';
import { Occluder } from '../../components/Occluder.js';
import { MapView } from '../../components/MapView.js';
import { CONFIG } from '../../../config.js';

function buildOcclusionGrid(world, minX, minY, maxX, maxY){
  const W = maxX - minX + 1;
  const H = maxY - minY + 1;
  const op = new Float32Array(W*H);
  const idx = (x,y)=> (y-minY)*W + (x-minX);
  
  // First pass: consult the designated MapView for opaque cells
  let mv = null;
  try {
    const mvId = world.mapViewId;
    if (mvId) mv = world.get(mvId, MapView);
    if (!mv) { for (const [_id, _mv] of world.query(MapView)) { mv = _mv; break; } }
  } catch(_) { /* ignore */ }
  if (mv){
    const opaqueAt = mv.opaqueAt;
    if (typeof opaqueAt === 'function'){
      for (let y=minY; y<=maxY; y++){
        for (let x=minX; x<=maxX; x++){
          if (opaqueAt(x,y)) op[idx(x,y)] = 1.0;
        }
      }
    } else if (typeof mv.tileAt === 'function'){
      const tileAt = mv.tileAt;
      for (let y=minY; y<=maxY; y++){
        for (let x=minX; x<=maxX; x++){
          const t = tileAt(x,y);
          if (t && t.blocksLight) op[idx(x,y)] = 1.0;
        }
      }
    } else {
      const glyphAt = mv.glyphAt;
      if (typeof glyphAt === 'function'){
        for (let y=minY; y<=maxY; y++){
          for (let x=minX; x<=maxX; x++){
            const g = glyphAt(x,y) || '';
            // Walls and solid features block sight
            if (g === '█' || g === '≈' || g === '⛲' || g === '🕳' || g === '⎈' || g === '♛' || g === '†') {
              op[idx(x,y)] = 1.0;
            }
          }
        }
      }
    }
  }
  
  // Second pass: Position+Tile entities (manually placed walls)
  // Prefer Occluder.opacity if present; fallback to Tile.blocksLight
  for (const [id, pos, tile] of world.query(Position, Tile)){
    const x = pos.x|0, y = pos.y|0;
    if (x<minX||x>maxX||y<minY||y>maxY) continue;
    const o = tile.blocksLight ? 1 : 0;
    op[idx(x,y)] = Math.max(op[idx(x,y)], o);
  }
  
  // Third pass: Position+Occluder entities (override with explicit occlusion)
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
  let visW = rc.visibleWeight;
  if (!(visW instanceof Float32Array) || visW.length !== cols*rows){ visW = new Float32Array(cols*rows); }
  visW.fill(0);
  
  // Simple ray-cast FOV from eye; correct DDA stepping to avoid 
  // plus-shaped artifacts and keep the eye centered.
  // Number of FOV rays: prefer RenderContext or CONFIG override; default 720 for softer edges
  const rays = Math.max(8, (rc.fovRays ?? CONFIG.fovRays ?? 720) | 0);
  const twoPi = Math.PI * 2;
  // Always reveal the eye tile itself
  if (eyeX>=camX && eyeY>=camY && eyeX<camX+cols && eyeY<camY+rows){
    vis[(eyeY-camY)*cols + (eyeX-camX)] = 1;
  }
  // Distance falloff near boundary (soften edge)
  const edgeStart = 0.75; // start fading at 75% of radius
  const edgeWidth = 1.0 - edgeStart; // fade to 0 at 100%
  const smoothstep = (e0, e1, x)=>{
    const t = Math.max(0, Math.min(1, (x - e0) / Math.max(1e-6, e1 - e0)));
    return t*t*(3 - 2*t);
  };

  for (let i=0;i<rays;i++){
    const a = (i / rays) * twoPi;
    const dx = Math.cos(a), dy = Math.sin(a);
    // Handle degenerate directions by clamping inverse
    const invDx = dx !== 0 ? 1/dx : 1e9;
    const invDy = dy !== 0 ? 1/dy : 1e9;
    let T = 1.0; // transmittance along ray
    // Start in the cell containing the eye
    let cx = Math.floor(eyeX);
    let cy = Math.floor(eyeY);
    const ox = eyeX + 0.5;
    const oy = eyeY + 0.5;
    const stepX = dx>0 ? 1 : -1;
    const stepY = dy>0 ? 1 : -1;
    // Distance to first vertical/horizontal boundary
    let tMaxX = ((dx>0 ? (cx+1) : cx) - ox) * invDx;
    let tMaxY = ((dy>0 ? (cy+1) : cy) - oy) * invDy;
    const tDeltaX = Math.abs(invDx);
    const tDeltaY = Math.abs(invDy);

    // March until max radius or fully occluded
    for(;;){
      // Current cell center and range check
      const wx = cx + 0.5, wy = cy + 0.5;
      const ddx = wx - eyeX, ddy = wy - eyeY;
      const d2 = ddx*ddx + ddy*ddy; if (d2 > R*R) break;

      // Read opacity for current cell (treat >0.5 as hard wall)
      let opCurr = 0;
      const insideCurr = (cx>=occ.minX && cx<occ.minX+occ.W && cy>=occ.minY && cy<occ.minY+occ.H);
      if (insideCurr) opCurr = occ.op[occ.idx(cx,cy)] || 0;

      // Accumulate visibility at current cell within viewport
      const vx = cx - camX, vy = cy - camY;
      if (vx>=0 && vy>=0 && vx<cols && vy<rows){
        const d = Math.sqrt(d2) / R; // 0 at eye, 1 at max radius
        const fade = 1 - smoothstep(edgeStart, 1.0, d); // 1 in center -> 0 at edge
        const w = Math.max(0, Math.min(1, T * fade));
        const idx = vy*cols + vx;
        if (w > visW[idx]) visW[idx] = w; // keep strongest contribution
        if (!vis[idx] && w > 0.02) vis[idx] = 1; // binary mask for fast gate
      }

      // If this cell is opaque, stop casting past it (wall remains visible)
      if (opCurr > 0.5) break;

      // Otherwise apply partial attenuation (for semi-opaque effects)
      if (opCurr > 0){
        const stepLen = 1; const thickness = 1;
        T *= Math.exp(-opCurr * stepLen * thickness);
        if (T < 0.05) break;
      }

      // Step to next cell boundary (Amanatides & Woo)
      if (tMaxX < tMaxY){
        tMaxX += tDeltaX; cx += stepX;
      } else {
        tMaxY += tDeltaY; cy += stepY;
      }
    }
  }

  // Persist to RenderContext so renderers can use it; also stash fov center/radius
  world.set(rcId, RenderContext, { visibleMask: vis, visibleWeight: visW, fovCenter:[eyeX, eyeY], fovRadius: R });

  // Also update MapView.seenMask so fog-of-war renderers can draw "remembered" tiles
  try {
    let mvId = world.mapViewId || 0; let mv = null;
    if (mvId) mv = world.get(mvId, MapView);
    if (!mv){ for (const [id, _mv] of world.query(MapView)){ mvId = id; mv = _mv; break; } }
    if (mv && (mv.w|0) > 0 && (mv.h|0) > 0){
      const w = mv.w|0, h = mv.h|0;
      let seen = mv.seenMask;
      if (!(seen instanceof Uint8Array) || seen.length !== w*h){
        seen = new Uint8Array(w*h);
      }
      // Mark tiles currently visible as seen, mapping viewport coords back to map coords
      for (let vy=0; vy<rows; vy++){
        for (let vx=0; vx<cols; vx++){
          const idx = vy*cols + vx;
          if (!vis[idx]) continue;
          const mx = camX + vx; const my = camY + vy;
          if (mx>=0 && my>=0 && mx<w && my<h){ seen[my*w + mx] = 1; }
        }
      }
      world.set(mvId, MapView, { seenMask: seen });
    }
  } catch(_) { /* non-fatal if MapView absent */ }
}
