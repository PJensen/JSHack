import { defineArchetype } from '../../lib/ecs/archetype.js';
import { Position } from '../components/Position.js';
import { Glyph } from '../components/Glyph.js';
import { Monster } from '../components/Monster.js';
import { Health } from '../components/Health.js';
import { CombatStats } from '../components/CombatStats.js';
import { Collider } from '../components/Collider.js';
import { AI } from '../components/AI.js';

// MonsterArchetype: generic hostile creature
// Params shape (optional):
// {
//   Position: { x, y },
//   Glyph: { char, fg, bg },
//   Monster: { ai: 'basic', visionRange, nextActAt },
//   Health: { maxHp, hp },
//   CombatStats: { atkMin, atkMax, defense, critChance, critMult }
// }
export const MonsterArchetype = defineArchetype('Monster',
  [Position, (p) => ({ x: p?.Position?.x ?? 0, y: p?.Position?.y ?? 0 })],
  [Glyph,    (p) => ({
    char: p?.Glyph?.char ?? 'm',
    fg:   p?.Glyph?.fg   ?? '#f55',
    bg:   p?.Glyph?.bg   ?? null,
    color:p?.Glyph?.color?? (p?.Glyph?.fg ?? '#f55')
  })],
  [Monster,  (p) => ({ ai: p?.Monster?.ai ?? 'basic', visionRange: p?.Monster?.visionRange ?? 12, nextActAt: p?.Monster?.nextActAt ?? 0 })],
  [AI,       (p) => ({ type: p?.AI?.type ?? 'basic' })],
  [Health,   (p) => ({ maxHp: p?.Health?.maxHp ?? 6, hp: p?.Health?.hp ?? (p?.Health?.maxHp ?? 6) })],
  [CombatStats, (p) => ({
    atkMin: p?.CombatStats?.atkMin ?? 2,
    atkMax: p?.CombatStats?.atkMax ?? 3,
    defense:p?.CombatStats?.defense ?? 0,
    critChance: p?.CombatStats?.critChance ?? 0.05,
    critMult:   p?.CombatStats?.critMult   ?? 1.5
  })],
  [Collider, (p) => ({ solid: p?.Collider?.solid ?? true, blocksSight: p?.Collider?.blocksSight ?? false })]
);

export default MonsterArchetype;
