import { World } from '../src/lib/ecs-js/index.js';
import { configureWorld } from '../app/rules/scheduler.js';
import { createFrom } from '../src/lib/ecs-js/archetype.js';
import { createPlayer } from '../src/rules/archetypes/Player.js';
import { Monster } from '../src/rules/archetypes/Creatures.js';
import { Position } from '../src/rules/components/Position.js';
import { MoveIntent } from '../src/rules/components/Intents/MoveIntent.js';

function assert(cond, msg) { if (!cond) throw new Error(msg); }

// Setup world
const world = new World({ seed: 42 });
configureWorld(world);

// Create player at (0,0)
const pid = createPlayer(world, { x: 0, y: 0 });

// Create a monster at (1,0)
const mid = createFrom(world, Monster, { x: 1, y: 0, name: 'Gobbo' });

// Sanity: positions
let ppos = world.get(pid, Position);
let mpos = world.get(mid, Position);
assert(ppos.x === 0 && ppos.y === 0, 'player not at (0,0)');
assert(mpos.x === 1 && mpos.y === 0, 'monster not at (1,0)');

// Try to move player into the monster's tile
world.add(pid, MoveIntent, { dx: 1, dy: 0 });
world.tick(1);

// Player should NOT have moved into the monster tile
ppos = world.get(pid, Position);
assert(ppos.x === 0 && ppos.y === 0, 'player was able to move through a monster');

console.log('Block monsters test PASS');
