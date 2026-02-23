import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Player } from '../src/rules/components/Player.js';
import { Trap } from '../src/rules/components/Trap.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { DisarmIntent } from '../src/rules/components/Intents/DisarmIntent.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { disarmTrapSystem } from '../src/rules/systems/disarmTrapSystem.js';
// Side-effect import: registers trap scripts
import '../src/rules/scripts/traps.js';

function makeWorld(seed = 1) {
  return new World({ seed });
}

function makePlayer(world, x, y, hp = 100) {
  const id = world.create();
  world.add(id, Player);
  world.add(id, Position, { x, y });
  world.add(id, Vitality, { maxHp: hp, hp });
  return id;
}

function makeTrap(world, x, y, opts = {}) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Trap, {
    type: opts.type ?? 'spike',
    armed: opts.armed ?? true,
    revealed: opts.revealed ?? false,
    script: opts.script ?? 'trap_spike',
    params: opts.params ?? { percent: 0.25 },
    difficulty: opts.difficulty ?? 10,
  });
  return id;
}

Deno.test("disarm consumes DisarmIntent", () => {
  const world = makeWorld();
  const player = makePlayer(world, 3, 3);
  makeTrap(world, 3, 3, { difficulty: 1 }); // DC 1 = always succeeds

  world.add(player, DisarmIntent, {});
  disarmTrapSystem(world);

  assert(!world.has(player, DisarmIntent), "DisarmIntent should be consumed");
});

Deno.test("successful disarm does not deal damage", () => {
  // Use a seed + step combo that produces a high roll.
  // DC 1 guarantees success (any d20 roll >= 1).
  const world = makeWorld(42);
  const player = makePlayer(world, 5, 5, 100);
  const trap = makeTrap(world, 5, 5, { difficulty: 1 });

  world.add(player, DisarmIntent, {});
  disarmTrapSystem(world);

  const vit = world.get(player, Vitality);
  assert(vit.hp === 100, `player should take no damage on success, hp=${vit.hp}`);

  const t = world.get(trap, Trap);
  assert(t.armed === false, "trap should be disarmed");
  assert(t.revealed === true, "trap should be revealed");
});

Deno.test("failed disarm triggers the trap", () => {
  // DC 21 guarantees failure (d20 max is 20).
  const world = makeWorld(99);
  const player = makePlayer(world, 5, 5, 100);
  const trap = makeTrap(world, 5, 5, { difficulty: 21 });

  world.add(player, DisarmIntent, {});
  disarmTrapSystem(world);

  const vit = world.get(player, Vitality);
  assert(vit.hp < 100, `player should take damage on failure, hp=${vit.hp}`);

  const t = world.get(trap, Trap);
  assert(t.armed === false, "trap should be consumed after triggering");
  assert(t.revealed === true, "trap should be revealed after triggering");
});

Deno.test("disarm reveals hidden traps", () => {
  const world = makeWorld();
  const player = makePlayer(world, 5, 5);
  const trap = makeTrap(world, 5, 5, { revealed: false, difficulty: 1 });

  world.add(player, DisarmIntent, {});
  disarmTrapSystem(world);

  const t = world.get(trap, Trap);
  assert(t.revealed === true, "hidden trap should be revealed during disarm");
});

Deno.test("disarm finds adjacent trap (not just same tile)", () => {
  const world = makeWorld();
  const player = makePlayer(world, 5, 5);
  // Trap one tile to the east
  const trap = makeTrap(world, 6, 5, { difficulty: 1 });

  world.add(player, DisarmIntent, {});
  disarmTrapSystem(world);

  const t = world.get(trap, Trap);
  assert(t.armed === false, "adjacent trap should be disarmed");
});

Deno.test("disarm ignores traps more than 1 tile away", () => {
  const world = makeWorld();
  const player = makePlayer(world, 5, 5);
  const trap = makeTrap(world, 8, 8, { difficulty: 1 });

  let noTrapEmitted = false;
  world.on?.('trap:disarm:no-trap', () => { noTrapEmitted = true; });

  world.add(player, DisarmIntent, {});
  disarmTrapSystem(world);

  const t = world.get(trap, Trap);
  assert(t.armed === true, "far trap should remain armed");
});

Deno.test("disarm skips already-disarmed traps", () => {
  const world = makeWorld();
  const player = makePlayer(world, 5, 5);
  makeTrap(world, 5, 5, { armed: false, revealed: true, difficulty: 1 });

  world.add(player, DisarmIntent, {});
  disarmTrapSystem(world);

  // No crash, no damage — just a no-op
  const vit = world.get(player, Vitality);
  assert(vit.hp === 100, "no damage from disarmed trap");
});

Deno.test("disarm targets specific trapId when provided", () => {
  const world = makeWorld();
  const player = makePlayer(world, 5, 5);
  const trap1 = makeTrap(world, 5, 5, { type: 'spike', difficulty: 21 }); // will fail
  const trap2 = makeTrap(world, 5, 5, { type: 'shock', difficulty: 1 });  // will succeed

  // Target trap2 specifically
  world.add(player, DisarmIntent, { trapId: trap2 });
  disarmTrapSystem(world);

  const t1 = world.get(trap1, Trap);
  const t2 = world.get(trap2, Trap);
  assert(t1.armed === true, "untargeted trap should remain armed");
  assert(t2.armed === false, "targeted trap should be disarmed");
});

Deno.test("disarm emits trap:disarmed on success", () => {
  const world = makeWorld();
  const player = makePlayer(world, 5, 5);
  makeTrap(world, 5, 5, { difficulty: 1 });

  let emitted = null;
  world.on?.('trap:disarmed', (e) => { emitted = e; });

  world.add(player, DisarmIntent, {});
  disarmTrapSystem(world);

  assert(emitted !== null, "trap:disarmed event should be emitted");
  assert(emitted.actor === player, "event should reference the actor");
  assert(emitted.trapType === 'spike', "event should include trap type");
});

Deno.test("disarm emits trap:disarm:failed on failure", () => {
  const world = makeWorld();
  const player = makePlayer(world, 5, 5, 100);
  makeTrap(world, 5, 5, { difficulty: 21 });

  let emitted = null;
  world.on?.('trap:disarm:failed', (e) => { emitted = e; });

  world.add(player, DisarmIntent, {});
  disarmTrapSystem(world);

  assert(emitted !== null, "trap:disarm:failed event should be emitted");
  assert(emitted.roll < emitted.dc, `roll (${emitted.roll}) should be less than dc (${emitted.dc})`);
});
