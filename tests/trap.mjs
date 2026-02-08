import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Player } from '../src/rules/components/Player.js';
import { Trap } from '../src/rules/components/Trap.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { trapSystem } from '../src/rules/systems/trapSystem.js';
// Side-effect import: registers trap_spike script
import '../src/rules/scripts/traps.js';

function assert(c, m) { if (!c) throw new Error('Assertion failed: ' + m); }

async function run() {
  const world = new World({ seed: 1 });

  // Create player at (3,3) with 100 HP
  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 3, y: 3 });
  world.add(player, Vitality, { maxHp: 100, hp: 100 });

  // Create spike trap at same tile, armed
  const trap = world.create();
  world.add(trap, Position, { x: 3, y: 3 });
  world.add(trap, Trap, { type: 'spike', armed: true, revealed: false, script: 'trap_spike', params: { percent: 0.25 } });

  // Run trap system — player stands on armed trap
  trapSystem(world);

  const vit = world.get(player, Vitality);
  // spike trap deals floor(maxHp * 0.25) = 25 damage
  assert(vit.hp === 75, `player should take 25 damage, hp=${vit.hp}`);

  // Trap should be disarmed and revealed
  const t = world.get(trap, Trap);
  assert(t.armed === false, 'trap should be disarmed after triggering');
  assert(t.revealed === true, 'trap should be revealed after triggering');

  // Running again should not deal more damage (trap disarmed)
  trapSystem(world);
  const vit2 = world.get(player, Vitality);
  assert(vit2.hp === 75, `disarmed trap should not deal damage, hp=${vit2.hp}`);

  // Trap on different tile should not trigger
  const farTrap = world.create();
  world.add(farTrap, Position, { x: 10, y: 10 });
  world.add(farTrap, Trap, { type: 'spike', armed: true, revealed: false, script: 'trap_spike', params: { percent: 0.5 } });

  trapSystem(world);
  const vit3 = world.get(player, Vitality);
  assert(vit3.hp === 75, `far trap should not trigger, hp=${vit3.hp}`);

  // No player — system should be a no-op
  const world2 = new World({ seed: 2 });
  const trap2 = world2.create();
  world2.add(trap2, Position, { x: 0, y: 0 });
  world2.add(trap2, Trap, { type: 'spike', armed: true, revealed: false, script: 'trap_spike', params: {} });
  trapSystem(world2); // should not throw

  console.log('Trap tests PASS');
}

run().catch(e => { console.error(e); process.exitCode = 1; });
