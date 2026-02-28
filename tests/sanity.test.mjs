import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { createFrom } from '../src/lib/ecs-js/archetype.js';
import { Creature, Human, Monster, HumanoidBase } from '../src/rules/archetypes/Creatures.js';
import { Door } from '../src/rules/archetypes/Door.js';
import { FloorTile, WallTile } from '../src/rules/archetypes/Tiles.js';
import { createPlayer } from '../src/rules/archetypes/Player.js';
import { Anatomy } from '../src/rules/components/Anatomy.js';
import { Faction } from '../src/rules/components/Faction.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';

Deno.test("archetypes create valid entities with correct components", () => {
  const world = new World({ seed: 1 });

  const f = createFrom(world, FloorTile, { x: 0, y: 0 });
  const w = createFrom(world, WallTile, { x: 1, y: 0 });
  const d = createFrom(world, Door, { x: 0, y: 1 });
  assert(world.isAlive(f) && world.isAlive(w) && world.isAlive(d), 'tiles/door alive');

  const player = createPlayer(world, { x: 0, y: 0, name: 'Hero' });
  assert(world.isAlive(player), 'player alive');

  const c = createFrom(world, Creature, { x: 2, y: 2, humanoid: true, name: 'Person' });
  assert(world.isAlive(c), 'creature alive');
  const ca = world.get(c, Anatomy);
  assert(Array.isArray(ca.parts) && ca.parts.length > 0, 'humanoid anatomy built');
  assert(typeof ca.hearing === 'string' && ca.hearing.length > 0, 'humanoid anatomy includes hearing tier');

  const h = createFrom(world, Human, { x: -2, y: 2 });
  assert(world.isAlive(h), 'human alive');
  const ha = world.get(h, Anatomy);
  assert(Array.isArray(ha.parts) && ha.parts.length > 0, 'human anatomy built');
  assert(typeof ha.hearing === 'string' && ha.hearing.length > 0, 'human anatomy includes hearing tier');

  const m = createFrom(world, Monster, { x: 3, y: -1, name: 'Goblin' });
  assert(world.isAlive(m), 'monster alive');
  const mf = world.get(m, Faction);
  assert(mf && mf.key === 'enemy', 'monster faction enemy');

  const ni = world.get(m, NamedIdentity);
  assert(ni && typeof ni.name === 'string' && ni.name.length > 0, 'monster has a name');
});
