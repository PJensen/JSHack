import { defineArchetype } from '../../lib/ecs/archetype.js';
import { Position } from '../components/Position.js';
import { Glyph } from '../components/Glyph.js';
import { Tile } from '../components/Tile.js';
import { Collider } from '../components/Collider.js';
import { Light } from '../components/Light.js';
import { Emissive } from '../components/Emissive.js';

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
    radius: p?.Light?.radius ?? 6,
    intensity: p?.Light?.intensity ?? 0.07,
    castsShadows: p?.Light?.castsShadows ?? true,
    flickerSeed: p?.Light?.flickerSeed ?? 1337,
    pulse: p?.Light?.pulse ?? { periodMs: 480, min: 0.65, max: 1.35 }
  })],
  // Small emissive core for glow pass
  [Emissive, (p)=> ({ color: p?.Emissive?.color ?? [1.0, 0.45, 0.15], strength: p?.Emissive?.strength ?? 1.2, radius: p?.Emissive?.radius ?? 1 })],

  // Upward spark emitter
  // Something like: pool.spawnContinuous('Spark', { rate: 5, velocity: { x: [ -0.1, 0.1 ], y: [ -0.5, -1.0 ] }, lifetime: [ 800, 1200 ], color: '#ffa500' })
);