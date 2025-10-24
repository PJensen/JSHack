// ShadowCastSystem: builds LightGrid from Lights and Emissives
import { Position } from '../../components/Position.js';
import { Tile } from '../../components/Tile.js';
import { Light } from '../../components/Light.js';
import { Emissive } from '../../components/Emissive.js';
import { RenderContext } from '../../components/RenderContext.js';
import { LightGrid, ensureLightGrid, clearLightGrid, addLight } from '../../singletons/LightGrid.js';

function toRGB(v){
  if (!v) return [1,1,1];
  if (Array.isArray(v)) return [v[0]||0, v[1]||0, v[2]||0];
  if (typeof v === 'string'){
    // hex #rrggbb
    const s = v.trim();
    if (s[0] === '#'){
      const n = parseInt(s.slice(1), 16);
      const r = ((n>>16)&255)/255, g=((n>>8)&255)/255, b=(n&255)/255;
      return [r,g,b];
    }
  }
  return [1,1,1];
}

function luminance(rgb){ return 0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2]; }

function buildOcclusionGrid(world, minX, minY, maxX, maxY){
  const W = maxX - minX + 1;
  const H = maxY - minY + 1;
  const op = new Float32Array(W*H);
  const idx = (x,y)=> (y-minY)*W + (x-minX);
  for (const [id, pos, tile] of world.query(Position, Tile)){
    const x = pos.x|0, y = pos.y|0;
    if (x<minX||x>maxX||y<minY||y>maxY) continue;
    const o = tile.blocksLight ? 1 : 0;
    op[idx(x,y)] = o;
  }
  return { op, W, H, idx, minX, minY };
}

function castLightRays(world, lg, rc, occ, light){
  const cols = rc.cols|0, rows = rc.rows|0;
  const camX = rc.camX|0, camY = rc.camY|0;
  // Map world tile space -> light grid space
  const scaleX = (lg.w / Math.max(1, cols));
  const scaleY = (lg.h / Math.max(1, rows));
  const originX = (light.x!=null?light.x:(world.getInstance(light.__id, Position)?.x||0));
  const originY = (light.y!=null?light.y:(world.getInstance(light.__id, Position)?.y||0));
  const Lrgb = toRGB(light.color);
  const radius = Math.max(0.1, light.radius || 6);
  const castsShadows = (light.castsShadows !== false);
  // choose ray count
  const N = light.rays || 48;
  const baseSeed = (world.seed ^ light.__id) >>> 0;
  const golden = Math.PI * (3 - Math.sqrt(5));
  let angle = (baseSeed % 628) / 100; // 0..6.28

  for (let i=0;i<N;i++){
    // uniform angle using golden angle dither
    angle += golden;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    // DDA setup in tile space
    let x = originX + 0.5, y = originY + 0.5;
    let T = 1.0; // transmittance
    // step to next gridlines
    const stepX = dx>0 ? 1 : -1;
    const stepY = dy>0 ? 1 : -1;
    let tMaxX = ((Math.floor(x) + (dx>0?1:0)) - x) / (dx||1e-6);
    let tMaxY = ((Math.floor(y) + (dy>0?1:0)) - y) / (dy||1e-6);
    const tDeltaX = Math.abs(1/(dx||1e-6));
    const tDeltaY = Math.abs(1/(dy||1e-6));

    let cx = Math.floor(x), cy = Math.floor(y);
    const r2max = radius*radius;
    for (let steps=0; steps<radius*4; steps++){
      // accumulate at cell center
      const wx = cx + 0.5, wy = cy + 0.5;
      const ddx = wx - originX, ddy = wy - originY;
      const d2 = ddx*ddx + ddy*ddy;
      if (d2 > r2max) break;
      const effI = (light.intensityEff!=null?light.intensityEff:(light.intensity||1));
      const kL = (light.falloff && light.falloff.kL) || 0;
      const kQ = (light.falloff && light.falloff.kQ) || 1;
      const atten = effI / (1 + kL*Math.sqrt(d2) + kQ*d2);
      const rgb = [Lrgb[0]*atten*T, Lrgb[1]*atten*T, Lrgb[2]*atten*T];
  // Map to light grid coords (align with how sampleLight is addressed in renderers)
  const gx = (wx - camX) * scaleX;
  const gy = (wy - camY) * scaleY;
  if (gx>=-1 && gy>=-1 && gx<lg.w+1 && gy<lg.h+1){ addLight(lg, gx, gy, rgb); }

      if (!castsShadows){ // if no shadows, just march a few steps and stop
        if (d2 > r2max*0.9) break;
      }

      // advance to next cell edge
      if (tMaxX < tMaxY){
        x += tMaxX*dx; y += tMaxX*dy; tMaxX = tDeltaX; cx += stepX;
      } else {
        x += tMaxY*dx; y += tMaxY*dy; tMaxY = tDeltaY; cy += stepY;
      }

      // apply occlusion if cell within occ region
      const ox = cx, oy = cy;
      const inside = (ox>=occ.minX && ox<occ.minX+occ.W && oy>=occ.minY && oy<occ.minY+occ.H);
      if (inside){
        const op = occ.op[occ.idx(ox,oy)];
        if (op > 0){
          const stepLen = 1; // tiles
          const thickness = 1; // could read Occluder.thickness
          T *= Math.exp(-op * stepLen * thickness);
          if (T < 0.01) break;
        }
      }
    }
  }
}

export function ShadowCastSystem(world){
  // get render context for viewport
  const rcId = world.renderContextId; if (!rcId) return;
  const rc = world.get(rcId, RenderContext); if (!rc) return;
  const cols = Math.max(1, rc.cols|0), rows = Math.max(1, rc.rows|0);
  // ensure lightgrid dims (half-res optional)
  const half = true; // default half res
  const gw = half ? Math.max(1, (cols/2)|0) : cols;
  const gh = half ? Math.max(1, (rows/2)|0) : rows;
  const lgId = ensureLightGrid(world, gw, gh);
  const lg = world.get(lgId, LightGrid);
  lg.halfRes = half;
  clearLightGrid(lg);

  // build occlusion grid around viewport; margin by max radius
  let maxR = 8;
  for (const [id, lt] of world.query(Light)){
    const r = lt.radius || 6; if (r>maxR) maxR = r|0;
    // stash id for seed use
    lt.__id = id;
  }
  const minX = (rc.camX|0) - (maxR+2), minY = (rc.camY|0) - (maxR+2);
  const maxX = (rc.camX|0) + cols + (maxR+2);
  const maxY = (rc.camY|0) + rows + (maxR+2);
  const occ = buildOcclusionGrid(world, minX, minY, maxX, maxY);

  // accumulate lights
  for (const [id, lt] of world.query(Light)){
    lt.__id = id;
    castLightRays(world, lg, rc, occ, lt);
  }

  // add emissives (no shadows)
  for (const [id, pos, em] of world.query(Position, Emissive)){
    const rgb = toRGB(em.color);
    // Map tile center to light grid coords using the same scale as sampling
    const scaleX = lg.w / Math.max(1, cols);
    const scaleY = lg.h / Math.max(1, rows);
    const gx = ((pos.x - rc.camX) + 0.5) * scaleX;
    const gy = ((pos.y - rc.camY) + 0.5) * scaleY;
    addLight(lg, gx, gy, [rgb[0]*em.strength, rgb[1]*em.strength, rgb[2]*em.strength]);
    // tiny kernel if radius>0
    if (em.radius>0){
      for (let dy=-em.radius; dy<=em.radius; dy++){
        for (let dx=-em.radius; dx<=em.radius; dx++){
          if (dx===0 && dy===0) continue;
          // Spread kernel in light-grid space
          addLight(lg, gx + dx*scaleX, gy + dy*scaleY, [rgb[0]*em.strength*0.5, rgb[1]*em.strength*0.5, rgb[2]*em.strength*0.5]);
        }
      }
    }
  }

  world.set(lgId, LightGrid, { dirty: false, version: (lg.version|0)+1 });
}
