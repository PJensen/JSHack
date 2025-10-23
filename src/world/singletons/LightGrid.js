import { defineComponent } from '../../lib/ecs/core.js';

// LightGrid: global irradiance buffer
export const LightGrid = defineComponent('LightGrid', {
  w: 0,
  h: 0,
  r: null, // Float32Array length w*h
  g: null,
  b: null,
  version: 0,
  ambient: [0.02, 0.02, 0.03],
  dirty: true,
  halfRes: true
});

export function ensureLightGrid(world, w, h){
  // singleton create-or-resize; caller chooses dims
  // simple approach: first entity with LightGrid
  let id = 0;
  for (const e of world.alive){ if (world.has(e, LightGrid)) { id = e; break; } }
  if (!id) { id = world.create(); world.add(id, LightGrid, {}); }
  const lg = world.get(id, LightGrid);
  if (lg.w !== w || lg.h !== h || !lg.r || lg.r.length !== w*h){
    world.set(id, LightGrid, {
      w, h,
      r: new Float32Array(w*h),
      g: new Float32Array(w*h),
      b: new Float32Array(w*h),
      dirty: true
    });
  }
  return id;
}

export function clearLightGrid(lg){
  const n = lg.w * lg.h;
  const [ar, ag, ab] = lg.ambient || [0,0,0];
  for (let i=0;i<n;i++){ lg.r[i] = ar; lg.g[i] = ag; lg.b[i] = ab; }
}

export function addLight(lg, x, y, rgb){
  // x,y in grid coords; bilinear distribute to 4 neighbors for smoother result
  const gx = Math.max(0, Math.min(lg.w-1, x));
  const gy = Math.max(0, Math.min(lg.h-1, y));
  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const tx = gx - x0, ty = gy - y0;
  const x1 = Math.min(lg.w-1, x0+1), y1 = Math.min(lg.h-1, y0+1);
  const w00 = (1-tx)*(1-ty), w10 = tx*(1-ty), w01 = (1-tx)*ty, w11 = tx*ty;
  const idx = (ix,iy)=> iy*lg.w + ix;
  const i00 = idx(x0,y0), i10 = idx(x1,y0), i01 = idx(x0,y1), i11 = idx(x1,y1);
  lg.r[i00]+=rgb[0]*w00; lg.g[i00]+=rgb[1]*w00; lg.b[i00]+=rgb[2]*w00;
  lg.r[i10]+=rgb[0]*w10; lg.g[i10]+=rgb[1]*w10; lg.b[i10]+=rgb[2]*w10;
  lg.r[i01]+=rgb[0]*w01; lg.g[i01]+=rgb[1]*w01; lg.b[i01]+=rgb[2]*w01;
  lg.r[i11]+=rgb[0]*w11; lg.g[i11]+=rgb[1]*w11; lg.b[i11]+=rgb[2]*w11;
}

export function sampleLight(lg, x, y){
  // bilinear sample; x,y in grid space
  const gx = Math.max(0, Math.min(lg.w-1, x));
  const gy = Math.max(0, Math.min(lg.h-1, y));
  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const tx = gx - x0, ty = gy - y0;
  const x1 = Math.min(lg.w-1, x0+1), y1 = Math.min(lg.h-1, y0+1);
  const idx = (ix,iy)=> iy*lg.w + ix;
  const lerp = (a,b,t)=> a+(b-a)*t;
  const r00 = lg.r[idx(x0,y0)], r10 = lg.r[idx(x1,y0)], r01 = lg.r[idx(x0,y1)], r11 = lg.r[idx(x1,y1)];
  const g00 = lg.g[idx(x0,y0)], g10 = lg.g[idx(x1,y0)], g01 = lg.g[idx(x0,y1)], g11 = lg.g[idx(x1,y1)];
  const b00 = lg.b[idx(x0,y0)], b10 = lg.b[idx(x1,y0)], b01 = lg.b[idx(x0,y1)], b11 = lg.b[idx(x1,y1)];
  return [
    lerp(lerp(r00,r10,tx), lerp(r01,r11,tx), ty),
    lerp(lerp(g00,g10,tx), lerp(g01,g11,tx), ty),
    lerp(lerp(b00,b10,tx), lerp(b01,b11,tx), ty)
  ];
}
