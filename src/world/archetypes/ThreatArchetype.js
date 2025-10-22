import { defineArchetype } from '../../lib/ecs/archetype.js';
import Glyph from '../components/Glyph.js';
import { Position } from '../components/Position.js';
import { Health } from '../components/Health.js';
import Alignment from '../components/Alignment.js';
import { AI } from '../components/AI.js';
import { Collider } from '../components/Collider.js';

// Threat: an entity that pressures the player (melee, ranged, environmental)
export const ThreatArchetype = defineArchetype('Threat',
  [Glyph, (p)=>({
    char: p?.Glyph?.char ?? 'm',
    fg:   p?.Glyph?.fg   ?? '#f55',
    bg:   p?.Glyph?.bg   ?? null,
    color:p?.Glyph?.color?? (p?.Glyph?.fg ?? '#f55')
  })],
  [Position, (p)=>({ x: p?.Position?.x ?? 0, y: p?.Position?.y ?? 0 })],
  [Health, (p)=>({ maxHp: p?.Health?.maxHp ?? 5, hp: p?.Health?.hp ?? 5 })],
  [Alignment, (p)=>({
    lawChaos: p?.Alignment?.lawChaos ?? 'neutral',
    goodEvil: p?.Alignment?.goodEvil ?? 'evil'
  })],
  [AI, (p)=>({ type: p?.AI?.type ?? 'basic' })],
  [Collider, (p)=>({ solid: p?.Collider?.solid ?? true, blocksSight: p?.Collider?.blocksSight ?? false })]
);
