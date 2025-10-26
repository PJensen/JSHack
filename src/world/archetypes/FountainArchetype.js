import { defineArchetype } from '../../lib/ecs/archetype.js';
import { Position } from '../components/Position.js';
import { Glyph } from '../components/Glyph.js';
import { Collider } from '../components/Collider.js';
import { Emissive } from '../components/Emissive.js';
import { Emitter } from '../components/Emitter.js';

// FountainArchetype: a solid fountain with a cool blue water emitter
// Note: We do NOT add a Tile component here; the MapView already owns the tile glyph/state.
export const FountainArchetype = defineArchetype('Fountain',
  [Position, (p)=> ({ x: p?.Position?.x ?? 0, y: p?.Position?.y ?? 0 })],
  [Glyph,    (p)=> ({ char: p?.Glyph?.char ?? '⛲', fg: p?.Glyph?.fg ?? '#66ccff', color: p?.Glyph?.color ?? (p?.Glyph?.fg ?? '#66ccff') })],
  // Fountain blocks movement but not sight (shallow structure)
  [Collider, (p)=> ({ solid: p?.Collider?.solid ?? true, blocksSight: p?.Collider?.blocksSight ?? false })],
  // Subtle blue emissive to give a hint of glow in emissive pass
  [Emissive, (p)=> ({ color: p?.Emissive?.color ?? [0.4, 0.7, 1.0], strength: p?.Emissive?.strength ?? 0.35, radius: p?.Emissive?.radius ?? 1 })],
  // Upward water jet with a gentle spread; cool blue color
  [Emitter,  (p)=> ({
    enabled: p?.Emitter?.enabled ?? true,
    continuous: p?.Emitter?.continuous ?? true,
    rate: p?.Emitter?.rate ?? 18,            // particles/sec
    burstCount: p?.Emitter?.burstCount ?? 0,

    angle: p?.Emitter?.angle ?? (-Math.PI / 2),
    // Wider fan for fountain spray
    spread: p?.Emitter?.spread ?? (Math.PI / 6),
    speed: p?.Emitter?.speed ?? 1.15,
    speedJitter: p?.Emitter?.speedJitter ?? 0.3,
    vx: p?.Emitter?.vx ?? 0,
    vy: p?.Emitter?.vy ?? 0,
    ax: p?.Emitter?.ax ?? 0,
    // Gravity: positive is downward in our coord system; combine with upward initial velocity for an arc
    ay: p?.Emitter?.ay ?? 1.5,

    life: p?.Emitter?.life ?? 0.9,
    lifeJitter: p?.Emitter?.lifeJitter ?? 0.3,
    size: p?.Emitter?.size ?? 0.6,
    sizeEnd: p?.Emitter?.sizeEnd ?? 0.2,
    color: p?.Emitter?.color ?? '#66ccffff',  // cool blue with alpha

    offsetX: p?.Emitter?.offsetX ?? 0,
    offsetY: p?.Emitter?.offsetY ?? -0.6,     // start near the bowl center
  })],
);
