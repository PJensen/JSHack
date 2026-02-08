import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Player } from '../src/rules/components/Player.js';
import { Trap } from '../src/rules/components/Trap.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { trapSystem } from '../src/rules/systems/trapSystem.js';
// Side-effect import: registers trap_spike script
import '../src/rules/scripts/traps.js';

Deno.test("spike trap deals damage and disarms on trigger", () => {
  const world = new World({ seed: 1 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 3, y: 3 });
  world.add(player, Vitality, { maxHp: 100, hp: 100 });

  const trap = world.create();
  world.add(trap, Position, { x: 3, y: 3 });
  world.add(trap, Trap, { type: 'spike', armed: true, revealed: false, script: 'trap_spike', params: { percent: 0.25 } });

  trapSystem(world);

  const vit = world.get(player, Vitality);
  assert(vit.hp === 75, `player should take 25 damage, hp=${vit.hp}`);

  const t = world.get(trap, Trap);
  assert(t.armed === false, 'trap should be disarmed after triggering');
  assert(t.revealed === true, 'trap should be revealed after triggering');
});

Deno.test("disarmed trap does not deal damage", () => {
  const world = new World({ seed: 1 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 3, y: 3 });
  world.add(player, Vitality, { maxHp: 100, hp: 75 });

  const trap = world.create();
  world.add(trap, Position, { x: 3, y: 3 });
  world.add(trap, Trap, { type: 'spike', armed: false, revealed: true, script: 'trap_spike', params: { percent: 0.25 } });

  trapSystem(world);
  const vit = world.get(player, Vitality);
  assert(vit.hp === 75, `disarmed trap should not deal damage, hp=${vit.hp}`);
});

Deno.test("trap on different tile does not trigger", () => {
  const world = new World({ seed: 1 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 3, y: 3 });
  world.add(player, Vitality, { maxHp: 100, hp: 75 });

  const farTrap = world.create();
  world.add(farTrap, Position, { x: 10, y: 10 });
  world.add(farTrap, Trap, { type: 'spike', armed: true, revealed: false, script: 'trap_spike', params: { percent: 0.5 } });

  trapSystem(world);
  const vit = world.get(player, Vitality);
  assert(vit.hp === 75, `far trap should not trigger, hp=${vit.hp}`);
});

Deno.test("trap system is no-op with no player", () => {
  const world = new World({ seed: 2 });
  const trap = world.create();
  world.add(trap, Position, { x: 0, y: 0 });
  world.add(trap, Trap, { type: 'spike', armed: true, revealed: false, script: 'trap_spike', params: {} });
  trapSystem(world); // should not throw
});
