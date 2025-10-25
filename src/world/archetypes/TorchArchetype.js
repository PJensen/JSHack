import { defineArchetype } from '../../lib/ecs/archetype.js';
import { Position } from '../components/Position.js';
import { Glyph } from '../components/Glyph.js';
import { Tile } from '../components/Tile.js';
import { Collider } from '../components/Collider.js';
import { Light } from '../components/Light.js';
import { Emissive } from '../components/Emissive.js';
import { Emitter } from '../components/Emitter.js';

// TorchArchetype: a passable torch with warm light, high flicker, and upward spark emitter
export const TorchArchetype = defineArchetype('Torch',
  [Position, (p)=> ({ x: p?.Position?.x ?? 0, y: p?.Position?.y ?? 0 })],
  [Glyph,    (p)=> ({ char: p?.Glyph?.char ?? '🕯️', fg: p?.Glyph?.fg ?? '#ffb300', color: p?.Glyph?.color ?? '#ffb300' })],
  // Passable helper tile + collider
  [Tile,     (p)=> ({ glyph: p?.Tile?.glyph ?? ' ', walkable: true, blocksLight: false })],
  [Collider, (_)=> ({ solid: false, blocksSight: false })],
  // Warm point light with strong variation via pulse + flicker
  [Light,    (p)=> ({
    kind: 'point',
    color: p?.Light?.color ?? [1.0, 0.55, 0.18],
    radius: p?.Light?.radius ?? 3,
    intensity: p?.Light?.intensity ?? 0.07,
    castsShadows: p?.Light?.castsShadows ?? true,
    flickerSeed: p?.Light?.flickerSeed ?? 1337,
    pulse: p?.Light?.pulse ?? { periodMs: 480, min: 0.65, max: 2.35 }
  })],
  // Small emissive core for glow pass
  [Emissive, (p)=> ({ color: p?.Emissive?.color ?? [1.0, 0.45, 0.15], strength: p?.Emissive?.strength ?? 1.2, radius: p?.Emissive?.radius ?? 1 })],
  // Upward spark emitter (warm, flickery)
  [Emitter, (p)=> ({
    enabled: p?.Emitter?.enabled ?? true,
    continuous: p?.Emitter?.continuous ?? true,
    rate: p?.Emitter?.rate ?? 10,            // particles/sec
    burstCount: p?.Emitter?.burstCount ?? 0, // optional one-shot burst on spawn

    // Directional cone upwards
    angle: p?.Emitter?.angle ?? (-Math.PI / 2),
    spread: p?.Emitter?.spread ?? (Math.PI / 10),
    speed: p?.Emitter?.speed ?? 1.1,
    speedJitter: p?.Emitter?.speedJitter ?? 0.45,
    vx: p?.Emitter?.vx ?? 0,
    vy: p?.Emitter?.vy ?? 0,
    ax: p?.Emitter?.ax ?? 0,
    ay: p?.Emitter?.ay ?? -0.8, // gentle rise

    // Lifetime/visuals
    life: p?.Emitter?.life ?? 0.8,          // seconds
    lifeJitter: p?.Emitter?.lifeJitter ?? 0.35,
    size: p?.Emitter?.size ?? 0.7,
    sizeEnd: p?.Emitter?.sizeEnd ?? 0.1,
    color: p?.Emitter?.color ?? (p?.Glyph?.fg || p?.Glyph?.color || '#ffa500'),

    // Slight offset above the glyph origin
    offsetX: p?.Emitter?.offsetX ?? 0,
    offsetY: p?.Emitter?.offsetY ?? -0.2,
  })],
);