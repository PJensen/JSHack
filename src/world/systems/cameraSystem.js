import { Position } from '../components/Position.js';
import { Player } from '../components/Player.js';
import { Camera } from '../components/Camera.js';
import { RenderContext } from '../components/RenderContext.js';

// Simple camera system: centers camera on the first Player it finds with a Position
export function cameraSystem(world, dt){
  // find player with Position
  for (const [id, pos] of world.query(Position, Player)){
    // ensure there's a Camera singleton (we'll look for any entity with Camera)
    for (const [cid, cam] of world.query(Camera)){
      // center cam at player (cam.x,y represent top-left in tiles)
      cam.x = Math.floor(pos.x - cam.cols / 2);
      cam.y = Math.floor(pos.y - cam.rows / 2);
      // Mirror camera position into the shared RenderContext so renderers don't need
      // to separately locate Camera entities. This keeps render path read-only and
      // avoids systems reaching into world globals.
      // Update the live RenderContext record directly to avoid deferral during tick.
      try{
        const rcId = world.renderContextId;
        if (rcId && world.has(rcId, RenderContext)){
          const rec = world.getInstance(rcId, RenderContext) || world.get(rcId, RenderContext);
          if (rec){ rec.camX = cam.x; rec.camY = cam.y; world.markChanged(rcId, RenderContext); }
        }
      }catch(e){ /* ignore if not present or during startup */ }
      return;
    }
  }
}
