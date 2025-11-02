import { World } from '../src/lib/ecs-js/index.js';
import { configureWorld } from '../app/rules/scheduler.js';
import { createFrom } from '../src/lib/ecs-js/archetype.js';
import { createPlayer } from '../src/rules/archetypes/Player.js';
import { Position } from '../src/rules/components/Position.js';
import { Inventory, ItemInfo } from '../src/rules/components/index.js';
import { GoldStack } from '../src/rules/archetypes/Items.js';
import { MoveIntent } from '../src/rules/components/Intents/MoveIntent.js';

function assert(cond, msg) { if (!cond) throw new Error(msg); }

const world = new World({ seed: 1234 });
configureWorld(world);

// Create player at (0,0)
const pid = createPlayer(world, { x: 0, y: 0 });

// Place gold at (1,0)
const gid = createFrom(world, GoldStack, {});
world.add(gid, Position, { x: 1, y: 0 });

// Ensure starting inventory empty
const inv0 = world.get(pid, Inventory);
assert(inv0 && Array.isArray(inv0.items) && inv0.items.length === 0, 'expected empty inventory at start');

// Move right onto gold
world.add(pid, MoveIntent, { dx: 1, dy: 0 });
world.tick(1);

// After tick, player should be at (1,0) and have the gold (or stacked)
const pos = world.get(pid, Position);
assert(pos.x === 1 && pos.y === 0, 'player did not move to (1,0)');

const inv = world.get(pid, Inventory);
const goldPos = world.get(gid, Position);
console.log('DEBUG inv.items:', inv.items);
console.log('DEBUG gold still on ground?', !!goldPos);
assert(inv.items.length === 1, 'gold was not picked up automatically');
const picked = inv.items[0];
const info = world.get(picked, ItemInfo);
assert(info && info.type === 'currency', 'picked item is not currency');

console.log('Auto-pickup test PASS');
