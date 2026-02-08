import { World } from '../src/lib/ecs-js/index.js';
import { MonsterSpawner } from '../src/rules/components/MonsterSpawner.js';
import { Position } from '../src/rules/components/Position.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { Owner } from '../src/rules/components/Owner.js';
import { monsterSpawnerSystem } from '../src/rules/systems/monsterSpawnerSystem.js';

function assert(c, m) { if (!c) throw new Error('Assertion failed: ' + m); }

async function run() {
  const world = new World({ seed: 42 });

  // Create a spawner: max 2 concurrent, cooldown 3, total 4
  const spawner = world.create();
  world.add(spawner, Position, { x: 10, y: 10 });
  world.add(spawner, MonsterSpawner, {
    maxConcurrent: 2,
    cooldownTicks: 3,
    totalToSpawn: 4,
    spawnedSoFar: 0,
    lastSpawnStep: -Infinity,
    activeChildren: [],
    spawnParams: { name: 'Spawn', maxHp: 5, hp: 5 },
    spawnRadius: 0,
    isActive: true
  });

  // Step 0: first spawn
  monsterSpawnerSystem(world);
  let sp = world.get(spawner, MonsterSpawner);
  assert(sp.spawnedSoFar === 1, `should spawn 1, got ${sp.spawnedSoFar}`);
  assert(sp.activeChildren.length === 1, `1 active child, got ${sp.activeChildren.length}`);

  const child1 = sp.activeChildren[0];
  assert(world.isAlive(child1), 'child1 should be alive');
  assert(world.has(child1, Owner), 'child should have Owner component');

  // Step 1: cooldown not met (need 3 ticks)
  world.step = 1;
  monsterSpawnerSystem(world);
  sp = world.get(spawner, MonsterSpawner);
  assert(sp.spawnedSoFar === 1, 'cooldown: should still be 1');

  // Step 3: cooldown met, spawn second
  world.step = 3;
  monsterSpawnerSystem(world);
  sp = world.get(spawner, MonsterSpawner);
  assert(sp.spawnedSoFar === 2, `step 3: should be 2, got ${sp.spawnedSoFar}`);
  assert(sp.activeChildren.length === 2, `2 active children, got ${sp.activeChildren.length}`);

  // Step 6: cooldown met but maxConcurrent reached (2/2 alive)
  world.step = 6;
  monsterSpawnerSystem(world);
  sp = world.get(spawner, MonsterSpawner);
  assert(sp.spawnedSoFar === 2, `max concurrent: still 2, got ${sp.spawnedSoFar}`);

  // Kill first child, then tick again — should spawn replacement
  world.destroy(child1);
  world.step = 9;
  monsterSpawnerSystem(world);
  sp = world.get(spawner, MonsterSpawner);
  assert(sp.spawnedSoFar === 3, `after kill: should be 3, got ${sp.spawnedSoFar}`);
  // Dead children should be culled; all remaining should be alive
  assert(sp.activeChildren.every(cid => world.isAlive(cid)), 'all active children should be alive');
  assert(sp.activeChildren.length === 2, `should have 2 active children after cull+spawn, got ${sp.activeChildren.length}`);

  // Inactive spawner should do nothing
  const world2 = new World({ seed: 2 });
  const s2 = world2.create();
  world2.add(s2, Position, { x: 0, y: 0 });
  world2.add(s2, MonsterSpawner, {
    maxConcurrent: 5, cooldownTicks: 1, totalToSpawn: 10,
    spawnedSoFar: 0, lastSpawnStep: -Infinity, activeChildren: [],
    spawnParams: {}, spawnRadius: 0, isActive: false
  });
  monsterSpawnerSystem(world2);
  const sp2 = world2.get(s2, MonsterSpawner);
  assert(sp2.spawnedSoFar === 0, 'inactive spawner should not spawn');

  console.log('Spawner tests PASS');
}

run().catch(e => { console.error(e); process.exitCode = 1; });
