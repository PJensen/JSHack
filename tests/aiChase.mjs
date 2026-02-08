import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Player } from '../src/rules/components/Player.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { MoveIntent } from '../src/rules/components/Intents/MoveIntent.js';
import { aiChaseSystem } from '../src/rules/systems/aiChaseSystem.js';

function assert(c, m) { if (!c) throw new Error('Assertion failed: ' + m); }

async function run() {
  const world = new World({ seed: 1 });

  // Player at (5, 5)
  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  world.add(player, NamedIdentity, { name: 'Hero', identity: 'player' });

  // Monster to the east at (8, 5) — should step west (dx=-1)
  const m1 = world.create();
  world.add(m1, Position, { x: 8, y: 5 });
  world.add(m1, NamedIdentity, { name: 'Goblin', identity: 'monster' });

  aiChaseSystem(world);

  let intent = world.get(m1, MoveIntent);
  assert(intent, 'monster should have MoveIntent');
  assert(intent.dx === -1 && intent.dy === 0, `m1 should move west, got dx=${intent.dx} dy=${intent.dy}`);

  // Clear intent for next test
  world.remove(m1, MoveIntent);

  // Monster to the north at (5, 2) — should step south (dy=+1)
  const m2 = world.create();
  world.add(m2, Position, { x: 5, y: 2 });
  world.add(m2, NamedIdentity, { name: 'Orc', identity: 'monster' });

  aiChaseSystem(world);

  const i2 = world.get(m2, MoveIntent);
  assert(i2, 'm2 should have MoveIntent');
  assert(i2.dx === 0 && i2.dy === 1, `m2 should move south, got dx=${i2.dx} dy=${i2.dy}`);

  // Diagonal: monster at (8, 2) — further on x-axis (3) vs y-axis (3), equal so x preferred
  world.remove(m1, MoveIntent);
  world.remove(m2, MoveIntent);
  const m3 = world.create();
  world.add(m3, Position, { x: 8, y: 2 });
  world.add(m3, NamedIdentity, { name: 'Troll', identity: 'monster' });

  aiChaseSystem(world);

  const i3 = world.get(m3, MoveIntent);
  assert(i3, 'm3 should have MoveIntent');
  // ax=3, ay=3 → ax >= ay → prefers x-axis: dx=-1
  assert(i3.dx === -1 && i3.dy === 0, `m3 should move along x-axis, got dx=${i3.dx} dy=${i3.dy}`);

  // Monster already has MoveIntent — should not be overwritten
  world.remove(m1, MoveIntent);
  world.remove(m2, MoveIntent);
  world.remove(m3, MoveIntent);

  const m4 = world.create();
  world.add(m4, Position, { x: 3, y: 5 });
  world.add(m4, NamedIdentity, { name: 'Imp', identity: 'monster' });
  world.add(m4, MoveIntent, { dx: 0, dy: -1 }); // pre-existing intent

  aiChaseSystem(world);

  const i4 = world.get(m4, MoveIntent);
  assert(i4.dx === 0 && i4.dy === -1, 'pre-existing MoveIntent should not be overwritten');

  // Monster on same tile as player — should not move (dx=0, dy=0)
  const m5 = world.create();
  world.add(m5, Position, { x: 5, y: 5 });
  world.add(m5, NamedIdentity, { name: 'Shade', identity: 'monster' });

  aiChaseSystem(world);

  assert(!world.has(m5, MoveIntent), 'monster on player tile should not get MoveIntent');

  // Non-monster entity should be ignored
  const npc = world.create();
  world.add(npc, Position, { x: 0, y: 0 });
  world.add(npc, NamedIdentity, { name: 'Villager', identity: 'npc' });

  aiChaseSystem(world);

  assert(!world.has(npc, MoveIntent), 'non-monster should not get MoveIntent');

  // No player — system should be a no-op
  const world2 = new World({ seed: 2 });
  const lonely = world2.create();
  world2.add(lonely, Position, { x: 0, y: 0 });
  world2.add(lonely, NamedIdentity, { name: 'Bat', identity: 'monster' });
  aiChaseSystem(world2);
  assert(!world2.has(lonely, MoveIntent), 'no player means no chase');

  console.log('AI chase tests PASS');
}

run().catch(e => { console.error(e); process.exitCode = 1; });
