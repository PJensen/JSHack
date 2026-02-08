import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { configureWorld } from '../app/rules/scheduler.js';
import { createFrom } from '../src/lib/ecs-js/archetype.js';
import { createPlayer } from '../src/rules/archetypes/Player.js';
import { Position } from '../src/rules/components/Position.js';
import { Inventory, ItemInfo } from '../src/rules/components/index.js';
import { GoldStack } from '../src/rules/archetypes/Items.js';
import { MoveIntent } from '../src/rules/components/Intents/MoveIntent.js';

Deno.test("player auto-picks up gold when moving onto its tile", () => {
  const world = new World({ seed: 1234 });
  configureWorld(world);

  const pid = createPlayer(world, { x: 0, y: 0 });

  const gid = createFrom(world, GoldStack, {});
  world.add(gid, Position, { x: 1, y: 0 });

  const inv0 = world.get(pid, Inventory);
  assert(inv0 && Array.isArray(inv0.items) && inv0.items.length === 0, 'expected empty inventory at start');

  world.add(pid, MoveIntent, { dx: 1, dy: 0 });
  world.tick(1);

  const pos = world.get(pid, Position);
  assert(pos.x === 1 && pos.y === 0, 'player did not move to (1,0)');

  const inv = world.get(pid, Inventory);
  assert(inv.items.length === 1, 'gold was not picked up automatically');
  const picked = inv.items[0];
  const info = world.get(picked, ItemInfo);
  assert(info && info.type === 'currency', 'picked item is not currency');
});
