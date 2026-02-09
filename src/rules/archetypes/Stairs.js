import { defineArchetype } from '../../lib/ecs-js/archetype.js';
import { Position } from '../components/Position.js';
import { Terrain } from '../components/Terrain.js';
import { Interactable } from '../components/Interactable.js';
import { NamedIdentity } from '../components/NamedIdentity.js';

export const StairDown = defineArchetype('StairDown',
  [Position, p => ({ x: p.x, y: p.y })],
  [Terrain, { walkable: true, opaque: false }],
  [Interactable, { action: 'descendStair' }],
  [NamedIdentity, { name: 'Staircase Down', identity: 'stair_down' }],
);

export const StairUp = defineArchetype('StairUp',
  [Position, p => ({ x: p.x, y: p.y })],
  [Terrain, { walkable: true, opaque: false }],
  [Interactable, { action: 'ascendStair' }],
  [NamedIdentity, { name: 'Staircase Up', identity: 'stair_up' }],
);
