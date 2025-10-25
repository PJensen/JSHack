import { MapView } from '../components/MapView.js';
import { DevState } from '../components/DevState.js';

// Fog of War System
// - Clears MapView.seenMask when DevState.fogReset is set true
// - Optionally could support timed/area clears later
export function fogOfWarSystem(world){
  let shouldReset = false;
  for (const [id, dev] of world.query(DevState)){
    if (dev.fogReset){ shouldReset = true; dev.fogReset = false; world.markChanged(id, DevState); }
    break;
  }
  if (!shouldReset) return;

  // Clear seenMask on the active MapView (or the first one present)
  try{
    let mvId = world.mapViewId || 0; let mv = null;
    if (mvId) mv = world.get(mvId, MapView);
    if (!mv){ for (const [id, _mv] of world.query(MapView)){ mvId = id; mv = _mv; break; } }
    if (mv && (mv.w|0)>0 && (mv.h|0)>0){
      const w = mv.w|0, h = mv.h|0;
      const seen = new Uint8Array(w*h); // all zeros (unseen)
      world.set(mvId, MapView, { seenMask: seen });
    }
  }catch(_){ /* ignore */ }
}
