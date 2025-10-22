import { Position } from '../components/Position.js';
import { Projectile } from '../components/Projectile.js';

// Advances projectiles based on velocity; supports optional 'speed' scalar
export function projectileSystem(world, dt) {
  for (const [id, pos, proj] of world.query(Position, Projectile)) {
    let vx = proj.vx || 0;
    let vy = proj.vy || 0;
    if (proj.speed && (vx !== 0 || vy !== 0)) {
      const mag = Math.hypot(vx, vy) || 1;
      const s = proj.speed;
      vx = (vx / mag) * s;
      vy = (vy / mag) * s;
    }
    pos.x += vx * dt;
    pos.y += vy * dt;
  }
}
