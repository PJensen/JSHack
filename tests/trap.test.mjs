import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Player } from '../src/rules/components/Player.js';
import { Trap } from '../src/rules/components/Trap.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { BaseStats } from '../src/rules/components/BaseStats.js';
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

Deno.test("trap is no-op when no entity stands on it", () => {
  const world = new World({ seed: 2 });
  const trap = world.create();
  world.add(trap, Position, { x: 0, y: 0 });
  world.add(trap, Trap, { type: 'spike', armed: true, revealed: false, script: 'trap_spike', params: {} });
  trapSystem(world); // should not throw
  assert(world.get(trap, Trap).armed === true, 'trap should remain armed');
});

// ── Monster trap triggering ──────────────────────────────────────────

Deno.test("monster on spike trap takes damage and trap disarms", () => {
  const world = new World({ seed: 1 });

  const monster = world.create();
  world.add(monster, Position, { x: 5, y: 5 });
  world.add(monster, Vitality, { maxHp: 40, hp: 40 });

  const trap = world.create();
  world.add(trap, Position, { x: 5, y: 5 });
  world.add(trap, Trap, { type: 'spike', armed: true, revealed: false, script: 'trap_spike', params: { percent: 0.5 } });

  trapSystem(world);

  const vit = world.get(monster, Vitality);
  assert(vit.hp === 20, `monster should take 20 damage (50% of 40), hp=${vit.hp}`);

  const t = world.get(trap, Trap);
  assert(t.armed === false, 'trap should be disarmed after monster triggers it');
  assert(t.revealed === true, 'trap should be revealed after monster triggers it');
});

Deno.test("monster on different tile does not trigger trap", () => {
  const world = new World({ seed: 1 });

  const monster = world.create();
  world.add(monster, Position, { x: 1, y: 1 });
  world.add(monster, Vitality, { maxHp: 40, hp: 40 });

  const trap = world.create();
  world.add(trap, Position, { x: 8, y: 8 });
  world.add(trap, Trap, { type: 'spike', armed: true, revealed: false, script: 'trap_spike', params: { percent: 0.5 } });

  trapSystem(world);

  const vit = world.get(monster, Vitality);
  assert(vit.hp === 40, `monster should be unharmed, hp=${vit.hp}`);
  assert(world.get(trap, Trap).armed === true, 'trap should remain armed');
});

Deno.test("trap:triggered event is emitted with victim info", () => {
  const world = new World({ seed: 1 });

  const monster = world.create();
  world.add(monster, Position, { x: 2, y: 2 });
  world.add(monster, Vitality, { maxHp: 50, hp: 50 });

  const trap = world.create();
  world.add(trap, Position, { x: 2, y: 2 });
  world.add(trap, Trap, { type: 'spike', armed: true, revealed: false, script: 'trap_spike', params: { percent: 0.25 } });

  let emitted = null;
  world.on('trap:triggered', (evt) => { emitted = evt; });

  trapSystem(world);

  assert(emitted !== null, 'trap:triggered event should be emitted');
  assert(emitted.trapId === trap, `trapId should be ${trap}, got ${emitted.trapId}`);
  assert(emitted.victimId === monster, `victimId should be ${monster}, got ${emitted.victimId}`);
  assert(emitted.type === 'spike', `type should be spike, got ${emitted.type}`);
});

Deno.test("trap only triggers once even with multiple entities nearby", () => {
  const world = new World({ seed: 1 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 4, y: 4 });
  world.add(player, Vitality, { maxHp: 100, hp: 100 });

  // Monster on a different tile — not on the trap
  const monster = world.create();
  world.add(monster, Position, { x: 7, y: 7 });
  world.add(monster, Vitality, { maxHp: 40, hp: 40 });

  // High difficulty (DC 16) so avoidance DC = 21, impossible for zero-dex victim
  const trap = world.create();
  world.add(trap, Position, { x: 4, y: 4 });
  world.add(trap, Trap, { type: 'spike', armed: true, revealed: false, script: 'trap_spike', params: { percent: 0.25 }, difficulty: 16 });

  trapSystem(world);

  // Player triggers the trap, monster is untouched
  assert(world.get(player, Vitality).hp === 75, 'player should take damage');
  assert(world.get(monster, Vitality).hp === 40, 'monster should be unharmed');
  assert(world.get(trap, Trap).armed === false, 'trap disarms after one trigger');
});

// ── Dex-based trap avoidance ────────────────────────────────────────

Deno.test("high dex victim avoids trap (no damage, trap stays armed)", () => {
  // Avoidance check: d20 + evade >= DC + 5
  // Use very high dex to guarantee avoidance: dex 50 → evade +20, DC 1 → avoidance DC 6
  // Any d20 roll (min 1) + 20 = 21 >= 6 → always avoids.
  const world = new World({ seed: 1 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 3, y: 3 });
  world.add(player, Vitality, { maxHp: 100, hp: 100 });
  world.add(player, BaseStats, { dexterity: 50 }); // evade = +20

  const trap = world.create();
  world.add(trap, Position, { x: 3, y: 3 });
  world.add(trap, Trap, { type: 'spike', armed: true, revealed: false, script: 'trap_spike', params: { percent: 0.25 }, difficulty: 1 });

  trapSystem(world);

  const vit = world.get(player, Vitality);
  assert(vit.hp === 100, `high-dex player should avoid trap, hp=${vit.hp}`);

  const t = world.get(trap, Trap);
  assert(t.armed === true, 'avoided trap should stay armed');
  assert(t.revealed === true, 'avoided trap should be revealed');
});

Deno.test("zero dex victim does NOT avoid high-DC trap", () => {
  // DC 21 → avoidance DC = 26. d20 max = 20 + evade 0 = 20 < 26. Always triggers.
  const world = new World({ seed: 1 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 3, y: 3 });
  world.add(player, Vitality, { maxHp: 100, hp: 100 });

  const trap = world.create();
  world.add(trap, Position, { x: 3, y: 3 });
  world.add(trap, Trap, { type: 'spike', armed: true, revealed: false, script: 'trap_spike', params: { percent: 0.25 }, difficulty: 21 });

  trapSystem(world);

  const vit = world.get(player, Vitality);
  assert(vit.hp < 100, `zero-dex player should NOT avoid DC 21 trap, hp=${vit.hp}`);

  const t = world.get(trap, Trap);
  assert(t.armed === false, 'triggered trap should be disarmed');
});

Deno.test("trap:avoided event emitted on avoidance", () => {
  const world = new World({ seed: 1 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 3, y: 3 });
  world.add(player, Vitality, { maxHp: 100, hp: 100 });
  world.add(player, BaseStats, { dexterity: 50 }); // guarantee avoidance

  const trap = world.create();
  world.add(trap, Position, { x: 3, y: 3 });
  world.add(trap, Trap, { type: 'spike', armed: true, revealed: false, script: 'trap_spike', params: { percent: 0.25 }, difficulty: 1 });

  let emitted = null;
  world.on('trap:avoided', (evt) => { emitted = evt; });

  trapSystem(world);

  assert(emitted !== null, 'trap:avoided event should be emitted');
  assert(emitted.victimId === player, `victimId should be ${player}, got ${emitted.victimId}`);
  assert(emitted.trapId === trap, `trapId should be ${trap}, got ${emitted.trapId}`);
  assert(emitted.type === 'spike', `type should be spike, got ${emitted.type}`);
});
