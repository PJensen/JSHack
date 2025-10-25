import { defineArchetype } from '../../lib/ecs/archetype.js';
import { Position } from '../components/Position.js';
import { Glyph } from '../components/Glyph.js';
import { Health } from '../components/Health.js';
import { Collider } from '../components/Collider.js';
import { Monster } from '../components/Monster.js';

// TargetDummyArchetype: immobile, high-health dummy for testing combat
// Minimal components so existing renderers can draw it and future combat can target it.
export const TargetDummyArchetype = defineArchetype('TargetDummy',
  [Position, (p)=> ({ x: p?.Position?.x ?? 0, y: p?.Position?.y ?? 0 })],
  // Default to a unicode zombie; overrideable. Use a readable green if not using emoji fonts.
  [Glyph,    (p)=> ({ char: p?.Glyph?.char ?? '🧟', fg: p?.Glyph?.fg ?? '#9cff57', color: p?.Glyph?.color ?? (p?.Glyph?.fg ?? '#9cff57') })],
  [Health,   (p)=> ({ maxHp: p?.Health?.maxHp ?? 1000, hp: p?.Health?.hp ?? (p?.Health?.maxHp ?? 1000) })],
  // Make it solid by default; movementSystem will respect entity colliders even on walkable tiles.
  [Collider, (p)=> ({ solid: p?.Collider?.solid ?? true, blocksSight: p?.Collider?.blocksSight ?? false })],
  // Tag as Monster so future systems can filter/select combat targets, but leave AI null/absent.
  [Monster,  (p)=> ({ ai: p?.Monster?.ai ?? null })]
);
