import { defineArchetype } from '../../lib/ecs/archetype.js';
import { Position } from '../components/Position.js';
import { DungeonLevelLink } from '../components/DungeonLevelLink.js';
import { Glyph } from '../components/Glyph.js';
import { Interactable } from '../components/Interactable.js';

export const Teleportation = defineArchetype('Teleportation',
  [Glyph, (p)=>({ char: p?.Glyph?.char ?? 'O', fg: p?.Glyph?.fg ?? '#0ff', bg: p?.Glyph?.bg ?? null })],
  [Position, (p)=>({ x: p?.Position?.x ?? 0, y: p?.Position?.y ?? 0 })],
  [DungeonLevelLink, (p)=>({
    sourceLevelId: p?.DungeonLevelLink?.sourceLevelId ?? null,
    destinationLevelId: p?.DungeonLevelLink?.destinationLevelId ?? null,
    destinationPosition: p?.DungeonLevelLink?.destinationPosition ?? null,
    oneWay: p?.DungeonLevelLink?.oneWay ?? false,
    autoActivate: p?.DungeonLevelLink?.autoActivate ?? true,
    tags: p?.DungeonLevelLink?.tags ?? ['teleport']
  })],
  [Interactable, (p)=>({ type: 'teleport', enabled: p?.Interactable?.enabled ?? true })]
);
