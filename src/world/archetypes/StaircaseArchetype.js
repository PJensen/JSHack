// StaircaseArchetype.js - Archetype for staircase entities
// Usage: create staircase entities using the project's archetype API
import { defineArchetype } from '../../lib/ecs/archetype.js';
import { Position } from '../components/Position.js';
import { DungeonLevelLink } from '../components/DungeonLevelLink.js';

export const StaircaseArchetype = defineArchetype('Staircase',
    [Position, (p)=>({ x: p?.Position?.x ?? 0, y: p?.Position?.y ?? 0 })],
    [DungeonLevelLink, (p)=>({ sourceLevelId: p?.DungeonLevelLink?.sourceLevelId ?? null, destinationLevelId: p?.DungeonLevelLink?.destinationLevelId ?? null, destinationPosition: p?.DungeonLevelLink?.destinationPosition ?? null, oneWay: p?.DungeonLevelLink?.oneWay ?? false, autoActivate: p?.DungeonLevelLink?.autoActivate ?? true, traversed: p?.DungeonLevelLink?.traversed ?? 0, tags: p?.DungeonLevelLink?.tags ?? ['stairs'] })]
);
