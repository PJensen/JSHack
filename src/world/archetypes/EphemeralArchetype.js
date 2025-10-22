import { defineArchetype } from '../../lib/ecs/archetype.js';
import Glyph from '../components/Glyph.js';
import { Position } from '../components/Position.js';
import { Lifetime } from '../components/Lifetime.js';
import { Projectile } from '../components/Projectile.js';
import { Light } from '../components/Light.js';

// Ephemeral: projectiles, explosions, particles, buffs. Transient by design.
export const EphemeralArchetype = defineArchetype('Ephemeral',
  [Glyph, (p)=>({
    char: p?.Glyph?.char ?? '*',
    fg:   p?.Glyph?.fg   ?? '#ff0',
    bg:   p?.Glyph?.bg   ?? null,
    color:p?.Glyph?.color?? (p?.Glyph?.fg ?? '#ff0')
  })],
  [Position, (p)=>({ x: p?.Position?.x ?? 0, y: p?.Position?.y ?? 0 })],
  [Lifetime, (p)=>({ ttl: p?.Lifetime?.ttl ?? 0.5 })],
  // Optional add-ons
  (world, id, p)=>{
    if (p?.Projectile) {
      const pr = p.Projectile;
      world.add(id, Projectile, { vx: pr.vx ?? 0, vy: pr.vy ?? 0, speed: pr.speed ?? 0 });
    }
    if (p?.Light) {
      const lt = p.Light;
      world.add(id, Light, { radius: lt.radius ?? 0, color: lt.color ?? '#ffffaa' });
    }
  }
);
