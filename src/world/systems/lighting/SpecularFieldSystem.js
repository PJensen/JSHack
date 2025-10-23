// SpecularFieldSystem: compute gradient of LightGrid luminance for specular dir
import { LightGrid } from '../../singletons/LightGrid.js';

export function SpecularFieldSystem(world){
  // find singleton
  let id = 0; for (const e of world.alive){ if (world.has(e, LightGrid)) { id = e; break; } }
  if (!id) return;
  const lg = world.get(id, LightGrid); if (!lg || !lg.r) return;
  const { w, h, r, g, b } = lg;
  const gx = new Float32Array(w*h);
  const gy = new Float32Array(w*h);
  const idx = (x,y)=> y*w + x;
  const L = (x,y)=>{
    const xx = Math.max(0, Math.min(w-1, x));
    const yy = Math.max(0, Math.min(h-1, y));
    const i = idx(xx,yy);
    return 0.2126*r[i] + 0.7152*g[i] + 0.0722*b[i];
  };
  for (let y=0;y<h;y++){
    for (let x=0;x<w;x++){
      const gxv = L(x+1,y) - L(x-1,y);
      const gyv = L(x,y+1) - L(x,y-1);
      const i = idx(x,y);
      gx[i] = gxv; gy[i] = gyv;
    }
  }
  // store as transient fields on lg via mutate
  world.mutate(id, LightGrid, (rec)=>{ rec.gx = gx; rec.gy = gy; });
}
