import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { configureWorld } from '../src/main/scheduler.js';
import { createFrom } from '../src/lib/ecs-js/archetype.js';
import { createPlayer } from '../src/rules/archetypes/Player.js';
import { Monster } from '../src/rules/archetypes/Creatures.js';
import { Position } from '../src/rules/components/Position.js';
import { MoveIntent } from '../src/rules/components/Intents/MoveIntent.js';

Deno.test("player cannot move through a monster", () => {
  const world = new World({ seed: 42 });
  configureWorld(world);

  const pid = createPlayer(world, { x: 0, y: 0 });
  const mid = createFrom(world, Monster, { x: 1, y: 0, name: 'Gobbo' });

  let ppos = world.get(pid, Position);
  let mpos = world.get(mid, Position);
  assert(ppos.x === 0 && ppos.y === 0, 'player not at (0,0)');
  assert(mpos.x === 1 && mpos.y === 0, 'monster not at (1,0)');

  world.add(pid, MoveIntent, { dx: 1, dy: 0 });
  world.tick(1);

  ppos = world.get(pid, Position);
  assert(ppos.x === 0 && ppos.y === 0, 'player was able to move through a monster');
});
