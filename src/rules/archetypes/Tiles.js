import { defineArchetype } from '../../lib/ecs-js/archetype.js';
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

export const TrapTile = defineArchetype('TrapTile',
  [Position,  p => ({ x: p.x, y: p.y })],
  [Terrain,   { walkable: true, opaque: false }]
);

export const WaterTile = defineArchetype('WaterTile',
  [Position,  p => ({ x: p.x, y: p.y })],
  [Terrain,   { walkable: false, opaque: false }]
);

export const LavaTile = defineArchetype('LavaTile',
  [Position,  p => ({ x: p.x, y: p.y })],
  [Terrain,   { walkable: true, opaque: false }]
);


