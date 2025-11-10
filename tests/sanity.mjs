import { World } from '../src/lib/ecs-js/index.js';
import { createFrom } from '../src/lib/ecs-js/archetype.js';
import { Creature, Human, Monster, HumanoidBase } from '../src/rules/archetypes/Creatures.js';
import { Door } from '../src/rules/archetypes/Door.js';
import { FloorTile, WallTile } from '../src/rules/archetypes/Tiles.js';
import { createPlayer } from '../src/rules/archetypes/Player.js';
import { Anatomy } from '../src/rules/components/Anatomy.js';
import { Faction } from '../src/rules/components/Faction.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { GeometryKernel } from '../src/rules/environment/GeometryKernel.js';

function assert(c,m){ if(!c) throw new Error('Assertion failed: '+m); }

async function run(){
  const world = new World({ seed: 1 });

  // Tiles/door
  const f = createFrom(world, FloorTile, { x: 0, y: 0 });
  const w = createFrom(world, WallTile, { x: 1, y: 0 });
  const d = createFrom(world, Door, { x: 0, y: 1 });
  assert(world.isAlive(f) && world.isAlive(w) && world.isAlive(d), 'tiles/door alive');

  // Player
  const player = createPlayer(world, { x: 0, y: 0, name: 'Hero' });
  assert(world.isAlive(player), 'player alive');

  // Creature (humanoid)
  const c = createFrom(world, Creature, { x: 2, y: 2, humanoid: true, name: 'Person' });
  assert(world.isAlive(c), 'creature alive');
  const ca = world.get(c, Anatomy);
  assert(Array.isArray(ca.parts) && ca.parts.length > 0, 'humanoid anatomy built');

  // Human (humanoid by default)
  const h = createFrom(world, Human, { x: -2, y: 2 });
  assert(world.isAlive(h), 'human alive');
  const ha = world.get(h, Anatomy);
  assert(Array.isArray(ha.parts) && ha.parts.length > 0, 'human anatomy built');

  // Monster (empty or provided anatomy ok)
  const m = createFrom(world, Monster, { x: 3, y: -1, name: 'Goblin' });
  assert(world.isAlive(m), 'monster alive');
  const mf = world.get(m, Faction);
  assert(mf && mf.key === 'enemy', 'monster faction enemy');

  // NamedIdentity sanity
  const ni = world.get(m, NamedIdentity);
  assert(ni && typeof ni.name === 'string' && ni.name.length>0, 'monster has a name');

  const kernel = new GeometryKernel();
  kernel.carveCapsule(0, 0, 5, 0, 2);
  const capsule = kernel.primitives[kernel.primitives.length - 1];
  assert(Math.abs(capsule.bx - 7) < 1e-6, 'capsule tool-path reaches full length');
  kernel.carveRectSlot(0, 0, 0, 3, 1);
  const rectslot = kernel.primitives[kernel.primitives.length - 1];
  assert(Math.abs(rectslot.by - 4) < 1e-6, 'rectslot tool-path reaches full length');

  console.log('Sanity tests PASS');
}
run().catch(e=>{ console.error(e); process.exitCode = 1; });
