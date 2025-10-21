import { Position } from '../components/Position.js';
import { Player } from '../components/Player.js';
import { Camera } from '../components/Camera.js';

// Simple camera system: centers camera on the first Player it finds with a Position
export function cameraSystem(world, dt){
  // find player with Position
  for (const [id, pos] of world.query(Position, Player)){
    // ensure there's a Camera singleton (we'll look for any entity with Camera)
    for (const [cid, cam] of world.query(Camera)){
      // center cam at player (cam.x,y represent top-left in tiles)
      cam.x = Math.floor(pos.x - cam.cols / 2);
      cam.y = Math.floor(pos.y - cam.rows / 2);
      return;
    }
  }
}
