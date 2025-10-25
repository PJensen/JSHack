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
  [Glyph,    (p)=> ({ char: p?.Glyph?.char ?? 'T', fg: p?.Glyph?.fg ?? '#cccccc', color: p?.Glyph?.color ?? (p?.Glyph?.fg ?? '#cccccc') })],
  [Health,   (p)=> ({ maxHp: p?.Health?.maxHp ?? 1000, hp: p?.Health?.hp ?? (p?.Health?.maxHp ?? 1000) })],
  // Keep passable by default so you can stand on the same tile to attack during early bring-up.
  // Set solid:true later if desired once entity collision with MapView tiles is unified.
  [Collider, (p)=> ({ solid: p?.Collider?.solid ?? false, blocksSight: p?.Collider?.blocksSight ?? false })],
  // Tag as Monster so future systems can filter/select combat targets, but leave AI null/absent.
  [Monster,  (p)=> ({ ai: p?.Monster?.ai ?? null })]
);
