import { defineArchetype } from '../Archetype.js';
import { Position } from '../components/Position.js';
import { Terrain } from '../components/Terrain.js';

export const FloorTile = defineArchetype('FloorTile',
  [Position,  p => ({ x: p.x, y: p.y })],
  [Terrain,   { walkable: true, opaque: false }]
);

export const WallTile = defineArchetype('WallTile',
  [Position,  p => ({ x: p.x, y: p.y })],
  [Terrain,   { walkable: false, opaque: true }]
);
