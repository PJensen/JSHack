import { assertEquals, assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { configureWorld } from '../src/main/scheduler.js';
import { createFrom } from '../src/lib/ecs-js/archetype.js';
import { createPlayer } from '../src/rules/archetypes/Player.js';
import { Monster } from '../src/rules/archetypes/Creatures.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { WaitIntent } from '../src/rules/components/Intents/WaitIntent.js';

/**
 * Scenario: player surrounded on 3 cardinal sides by fast monsters.
 *
 *       M         (5,4)
 *     M P .       (4,5) (5,5)
 *       M         (5,6)
 *
 * All 3 monsters have speed 3 (actEvery=1, the fastest tier).
 * The player just waits each turn.
 * Every single tick, all 3 adjacent monsters should attempt a melee attack.
 */

function setup() {
  const world = new World({ seed: 42 });
  configureWorld(world);

  const pid = createPlayer(world, { x: 5, y: 5, maxHp: 999, hp: 999 });

  // speed 3 → actEvery = max(1, 4-3) = 1  (act every tick)
  const m1 = createFrom(world, Monster, {
    x: 4, y: 5, name: 'Goblin A', identity: 'goblin', speed: 3, maxHp: 50,
  });
  const m2 = createFrom(world, Monster, {
    x: 6, y: 5, name: 'Goblin B', identity: 'goblin', speed: 3, maxHp: 50,
  });
  const m3 = createFrom(world, Monster, {
    x: 5, y: 4, name: 'Goblin C', identity: 'goblin', speed: 3, maxHp: 50,
  });

  return { world, pid, monsters: [m1, m2, m3] };
}

Deno.test("surrounded: 3 adjacent speed-3 monsters should all attack every tick", () => {
  const { world, pid } = setup();

  let totalAttacks = 0;
  const attacksPerTick = [];

  world.on('bump:attack', () => { totalAttacks++; });

  const TICKS = 10;
  for (let t = 0; t < TICKS; t++) {
    const before = totalAttacks;
    // Player waits (added outside tick = immediate, like real game input)
    world.add(pid, WaitIntent);
    world.tick(1);
    attacksPerTick.push(totalAttacks - before);
  }

  // 3 adjacent monsters × actEvery 1 × 10 ticks = 30 expected attack attempts
  assertEquals(
    totalAttacks, TICKS * 3,
    `Expected ${TICKS * 3} attack attempts over ${TICKS} ticks from 3 adjacent ` +
    `actEvery=1 monsters, got ${totalAttacks}. Per-tick: [${attacksPerTick.join(', ')}]`
  );
});

Deno.test("surrounded: no tick should have 0 attacks when 3 monsters are adjacent", () => {
  const { world, pid } = setup();

  const attacksPerTick = [];

  let tickAttacks = 0;
  world.on('bump:attack', () => { tickAttacks++; });

  const TICKS = 10;
  for (let t = 0; t < TICKS; t++) {
    tickAttacks = 0;
    world.add(pid, WaitIntent);
    world.tick(1);
    attacksPerTick.push(tickAttacks);
  }

  const zeroTicks = attacksPerTick.filter(n => n === 0).length;
  assertEquals(
    zeroTicks, 0,
    `${zeroTicks} out of ${TICKS} ticks had ZERO attacks while surrounded ` +
    `by 3 adjacent monsters. Per-tick: [${attacksPerTick.join(', ')}]`
  );
});

Deno.test("surrounded: cumulative damage confirms multiple attackers per turn", () => {
  const { world, pid } = setup();

  const startHp = world.get(pid, Vitality).hp;

  // Run enough ticks for statistically clear results
  const TICKS = 20;
  for (let t = 0; t < TICKS; t++) {
    world.add(pid, WaitIntent);
    world.tick(1);
  }

  const endHp = world.get(pid, Vitality).hp;
  const totalDmg = startHp - endHp;

  // With 3 monsters attacking, even accounting for misses (d20 vs low AC),
  // total damage over 20 ticks should be substantial. A single attacker doing
  // ~4 avg damage per hit with ~60% hit rate would do ~48 over 20 ticks.
  // 3 attackers should do roughly 3× that. If only 1 effectively attacks,
  // damage will be clustered around the single-attacker range.
  //
  // This is a sanity check — the per-tick event counts above are the real proof.
  assert(
    totalDmg > 0,
    `Player took 0 damage over ${TICKS} ticks while surrounded by 3 monsters ` +
    `(started ${startHp} hp, ended ${endHp} hp)`
  );
});
