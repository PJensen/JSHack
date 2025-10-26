import { defineArchetype } from '../../lib/ecs/archetype.js';
import { Position } from '../components/Position.js';
import { Glyph } from '../components/Glyph.js';
import { Collider } from '../components/Collider.js';
import { Interactable } from '../components/Interactable.js';
import { Door } from '../components/Door.js';

// DoorArchetype: ECS entity for a door. Defaults to a closed wooden door '+'.
export const DoorArchetype = defineArchetype('Door',
  [Position, (p)=>({ x: p?.Position?.x ?? 0, y: p?.Position?.y ?? 0 })],
  [Glyph, (p)=>({
    char: p?.Glyph?.char ?? '+',
    fg:   p?.Glyph?.fg   ?? '#8b4513',
    bg:   p?.Glyph?.bg   ?? null,
    color:p?.Glyph?.color?? (p?.Glyph?.fg ?? '#8b4513')
  })],
  [Collider, (p)=>({ solid: p?.Collider?.solid ?? true, blocksSight: p?.Collider?.blocksSight ?? true })],
  [Interactable, (p)=>({ type: 'door', enabled: p?.Interactable?.enabled ?? true, prompt: p?.Interactable?.prompt ?? null })],
  [Door, (p)=>({ state: p?.Door?.state ?? 'closed', locked: p?.Door?.locked ?? false, orientation: p?.Door?.orientation ?? null })]
);
