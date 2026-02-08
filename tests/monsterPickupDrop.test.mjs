import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { configureWorld } from '../app/rules/scheduler.js';
import { createFrom } from '../src/lib/ecs-js/archetype.js';
import { Monster } from '../src/rules/archetypes/Creatures.js';
import { Position } from '../src/rules/components/Position.js';
import { MoveIntent } from '../src/rules/components/Intents/MoveIntent.js';
import { Inventory, ItemInfo, NamedIdentity } from '../src/rules/components/index.js';
import { GoldStack } from '../src/rules/archetypes/Items.js';
import { Vitality } from '../src/rules/components/Vitality.js';

Deno.test("monster picks up gold and drops it on death", () => {
  const world = new World({ seed: 999 });
  configureWorld(world);

  const mid = createFrom(world, Monster, { x: 0, y: 0, name: 'LootGoblin' });

  const gid = createFrom(world, GoldStack, {});
  world.add(gid, Position, { x: 1, y: 0 });

  world.add(mid, MoveIntent, { dx: 1, dy: 0 });
  world.tick(1);

  let mpos = world.get(mid, Position);
  assert(mpos.x === 1 && mpos.y === 0, 'monster did not move to (1,0)');
  const minv = world.get(mid, Inventory);
  assert(Array.isArray(minv.items) && minv.items.length === 1, 'monster did not pick up gold');
  const goldId = minv.items[0];
  const goldInfo = world.get(goldId, ItemInfo);
  assert(goldInfo && goldInfo.type === 'currency', 'picked item is not currency');

  const mvit = world.get(mid, Vitality);
  mvit.hp = 0;
  world.tick(1);

  assert(!world.isAlive(mid), 'monster still alive after hp=0');
  const groundPos = world.get(goldId, Position);
  assert(groundPos && groundPos.x === 1 && groundPos.y === 0, 'gold did not drop to monster position on death');
});
