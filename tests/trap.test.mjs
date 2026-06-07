import "./helpers/installContentMonsters.mjs";
import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Player } from '../src/rules/components/Player.js';
import { Trap } from '../src/rules/components/Trap.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { BaseStats } from '../src/rules/components/BaseStats.js';
import { Mana } from '../src/rules/components/Mana.js';
import { Stamina } from '../src/rules/components/Stamina.js';
import { Faction } from '../src/rules/components/Faction.js';
import { ActiveEffects } from '../src/rules/components/ActiveEffects.js';
import { trapSystem, trapStepListenerExtension } from '../src/rules/systems/trapSystem.js';
import { movementSystem } from '../src/rules/systems/movementSystem.js';
import { MoveIntent } from '../src/rules/components/Intents/MoveIntent.js';
import { clearAll, loadChunk } from '../src/rules/environment/dungeon/tileMap.js';
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL } from '../src/rules/environment/dungeon/constants.js';
import { setTile } from '../src/rules/environment/dungeon/tileMap.js';
// Side-effect import: registers trap_spike script
import '../src/rules/scripts/traps.js';

function stepOntoTrap(world, actor, x, y) {
  world.install(trapStepListenerExtension);
  world.emit("moved", { id: actor, from: { x, y: y + 1 }, to: { x, y } });
}

Deno.test("spike trap deals damage and disarms on trigger", () => {
  const world = new World({ seed: 1 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 3, y: 3 });
  world.add(player, Vitality, { maxHp: 100, hp: 100 });

  const trap = world.create();
  world.add(trap, Position, { x: 3, y: 3 });
  world.add(trap, Trap, { type: 'spike', armed: true, revealed: false, script: 'trap_spike', params: { percent: 0.25 } });

  stepOntoTrap(world, player, 3, 3);
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

  stepOntoTrap(world, player, 3, 3);
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

  stepOntoTrap(world, player, 3, 3);
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

// ── Monsters do NOT trigger traps ───────────────────────────────────

Deno.test("monster on spike trap does NOT trigger it", () => {
  const world = new World({ seed: 1 });

  const monster = world.create();
  world.add(monster, Position, { x: 5, y: 5 });
  world.add(monster, Vitality, { maxHp: 40, hp: 40 });

  const trap = world.create();
  world.add(trap, Position, { x: 5, y: 5 });
  world.add(trap, Trap, { type: 'spike', armed: true, revealed: false, script: 'trap_spike', params: { percent: 0.5 } });

  stepOntoTrap(world, monster, 5, 5);
  trapSystem(world);

  const vit = world.get(monster, Vitality);
  assert(vit.hp === 40, `monster should be unharmed, hp=${vit.hp}`);

  const t = world.get(trap, Trap);
  assert(t.armed === true, 'trap should remain armed when only a monster steps on it');
});

Deno.test("trap:triggered event is emitted with victim info", () => {
  const world = new World({ seed: 1 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 2, y: 2 });
  world.add(player, Vitality, { maxHp: 50, hp: 50 });

  const trap = world.create();
  world.add(trap, Position, { x: 2, y: 2 });
  world.add(trap, Trap, { type: 'spike', armed: true, revealed: false, script: 'trap_spike', params: { percent: 0.25 } });

  let emitted = null;
  world.on('trap:triggered', (evt) => { emitted = evt; });

  stepOntoTrap(world, player, 2, 2);
  trapSystem(world);

  assert(emitted !== null, 'trap:triggered event should be emitted');
  assert(emitted.trapId === trap, `trapId should be ${trap}, got ${emitted.trapId}`);
  assert(emitted.victimId === player, `victimId should be ${player}, got ${emitted.victimId}`);
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

  stepOntoTrap(world, player, 4, 4);
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

  stepOntoTrap(world, player, 3, 3);
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

  stepOntoTrap(world, player, 3, 3);
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

  stepOntoTrap(world, player, 3, 3);
  trapSystem(world);

  assert(emitted !== null, 'trap:avoided event should be emitted');
  assert(emitted.victimId === player, `victimId should be ${player}, got ${emitted.victimId}`);
  assert(emitted.trapId === trap, `trapId should be ${trap}, got ${emitted.trapId}`);
  assert(emitted.type === 'spike', `type should be spike, got ${emitted.type}`);
});

Deno.test("pit trap emits fall event and applies minor damage", () => {
  clearAll();
  try {
    loadChunk(0, 0, new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR));
    const world = new World({ seed: 3 });

    const player = world.create();
    world.add(player, Player);
    world.add(player, Position, { x: 10, y: 10 });
    world.add(player, Vitality, { maxHp: 100, hp: 100 });

    const trap = world.create();
    world.add(trap, Position, { x: 10, y: 10 });
    world.add(trap, Trap, {
      type: "pit",
      armed: true,
      revealed: false,
      script: "trap_pit",
      params: { percent: 0.08 },
      difficulty: 21,
    });

    let fallEvent = null;
    world.on('trap:pit:fall', (ev) => { fallEvent = ev; });

    stepOntoTrap(world, player, 10, 10);
    trapSystem(world);

    const vit = world.get(player, Vitality);
    assert(vit.hp <= 92, `pit trap should deal minor damage, hp=${vit.hp}`);
    assert(fallEvent !== null, "pit trap should emit trap:pit:fall");
    assert(fallEvent.x === 10 && fallEvent.y === 10, "fall event should carry trap coords");
    assert(fallEvent.targetId === player, "fall event should reference the player");
  } finally {
    clearAll();
  }
});

Deno.test("siphon trap drains hp and heals nearest hostile", () => {
  const world = new World({ seed: 4 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  world.add(player, Vitality, { maxHp: 100, hp: 100 });
  world.add(player, Faction, { key: "player" });

  const enemy = world.create();
  world.add(enemy, Position, { x: 6, y: 5 });
  world.add(enemy, Vitality, { maxHp: 40, hp: 20 });
  world.add(enemy, Faction, { key: "enemy" });

  const trap = world.create();
  world.add(trap, Position, { x: 5, y: 5 });
  world.add(trap, Trap, {
    type: "siphon",
    armed: true,
    revealed: false,
    script: "trap_siphon",
    params: { resource: "hp", percent: 0.15, healNearestEnemy: true },
    difficulty: 21,
  });

  stepOntoTrap(world, player, 5, 5);
  trapSystem(world);

  assert(world.get(player, Vitality).hp < 100, "siphon trap should drain target hp");
  assert(world.get(enemy, Vitality).hp > 20, "siphon trap should transfer drained hp to nearby hostile");
});

Deno.test("siphon trap can drain mana and stamina pools individually", () => {
  const world = new World({ seed: 5 });
  const actor = world.create();
  world.add(actor, Player);
  world.add(actor, Position, { x: 2, y: 2 });
  world.add(actor, Vitality, { maxHp: 30, hp: 30 });
  world.add(actor, Mana, { maxMana: 50, mana: 50, manaRegen: 0.1, regenCooldown: 0 });
  world.add(actor, Stamina, { maxStamina: 100, stamina: 100, staminaRegen: 3, regenCooldown: 0 });

  const manaTrap = world.create();
  world.add(manaTrap, Position, { x: 2, y: 2 });
  world.add(manaTrap, Trap, {
    type: "siphon",
    armed: true,
    revealed: false,
    script: "trap_siphon",
    params: { resource: "mana", percent: 0.2, healNearestEnemy: false },
    difficulty: 21,
  });
  stepOntoTrap(world, actor, 2, 2);
  trapSystem(world);
  assert(world.get(actor, Mana).mana < 50, "mana siphon should reduce mana");

  world.set(actor, Position, { x: 3, y: 3 });
  const stamTrap = world.create();
  world.add(stamTrap, Position, { x: 3, y: 3 });
  world.add(stamTrap, Trap, {
    type: "siphon",
    armed: true,
    revealed: false,
    script: "trap_siphon",
    params: { resource: "stamina", percent: 0.2, healNearestEnemy: false },
    difficulty: 21,
  });
  stepOntoTrap(world, actor, 3, 3);
  trapSystem(world);
  assert(world.get(actor, Stamina).stamina < 100, "stamina siphon should reduce stamina");
});

Deno.test("drain trap drains both mana and stamina simultaneously", () => {
  const world = new World({ seed: 8 });
  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 4, y: 4 });
  world.add(player, Vitality, { maxHp: 100, hp: 100 });
  world.add(player, Mana, { maxMana: 50, mana: 50, manaRegen: 0.1, regenCooldown: 0 });
  world.add(player, Stamina, { maxStamina: 100, stamina: 100, staminaRegen: 3, regenCooldown: 0 });

  const trap = world.create();
  world.add(trap, Position, { x: 4, y: 4 });
  world.add(trap, Trap, {
    type: "siphon",
    armed: true,
    revealed: false,
    script: "trap_siphon",
    params: { resource: "drain", percent: 0.15, healNearestEnemy: false },
    difficulty: 21,
  });

  stepOntoTrap(world, player, 4, 4);
  trapSystem(world);

  assert(world.get(player, Mana).mana < 50, "drain trap should reduce mana");
  assert(world.get(player, Stamina).stamina < 100, "drain trap should reduce stamina");
  assert(world.get(player, Vitality).hp === 100, "drain trap should NOT touch hp");
});

Deno.test("rust trap applies weakened anti-gear effect", () => {
  const world = new World({ seed: 6 });
  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 7, y: 7 });
  world.add(player, Vitality, { maxHp: 100, hp: 100 });

  const trap = world.create();
  world.add(trap, Position, { x: 7, y: 7 });
  world.add(trap, Trap, {
    type: "rust",
    armed: true,
    revealed: false,
    script: "trap_rust",
    params: { stat: "armor", amount: 2, duration: 20 },
    difficulty: 21,
  });

  stepOntoTrap(world, player, 7, 7);
  trapSystem(world);
  const ae = world.get(player, ActiveEffects);
  const weakened = Array.isArray(ae?.effects)
    ? ae.effects.find((e) => String(e?.key || "").toLowerCase() === "weakened")
    : null;
  assert(!!weakened, "rust trap should apply weakened effect");
  assert((weakened.turnsLeft | 0) === 20, `expected weakened duration 20, got ${weakened?.turnsLeft}`);
  assert((weakened.potency | 0) === 2, `expected weakened potency 2, got ${weakened?.potency}`);
});

Deno.test("swarm trap spawns multiple creatures around the trigger", () => {
  clearAll();
  try {
    loadChunk(0, 0, new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR));
    const world = new World({ seed: 7 });
    const player = world.create();
    world.add(player, Player);
    world.add(player, Position, { x: 12, y: 12 });
    world.add(player, Vitality, { maxHp: 100, hp: 100 });

    const trap = world.create();
    world.add(trap, Position, { x: 12, y: 12 });
    world.add(trap, Trap, {
      type: "swarm",
      armed: true,
      revealed: false,
      script: "trap_swarm",
      params: { monsterId: "spider", count: 6 },
      difficulty: 21,
    });

    stepOntoTrap(world, player, 12, 12);
    trapSystem(world);
    let spiders = 0;
    for (const [id, pos, vit] of world.query(Position, Vitality)) {
      if (id === player) continue;
      if (!pos || !vit || (vit.hp | 0) <= 0) continue;
      spiders++;
    }
    assert(spiders >= 3, `swarm trap should spawn several monsters, got ${spiders}`);
  } finally {
    clearAll();
  }
});

Deno.test("arrow trap fires from nearest wall and resets after player trigger", () => {
  clearAll();
  try {
    loadChunk(0, 0, new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR));
    setTile(10, 9, TILE_WALL);
    const world = new World({ seed: 9 });
    const player = world.create();
    world.add(player, Player);
    world.add(player, Position, { x: 10, y: 10 });
    world.add(player, Vitality, { maxHp: 100, hp: 100 });

    const trap = world.create();
    world.add(trap, Position, { x: 10, y: 10 });
    world.add(trap, Trap, {
      type: "arrow",
      armed: true,
      revealed: false,
      script: "trap_arrow",
      params: { damage: 8, resetsEvery: 1, maxWallDistance: 8 },
      difficulty: 21,
    });

    const shots = [];
    const damaged = [];
    world.on("ranged:shot", (ev) => shots.push(ev));
    world.on("damaged", (ev) => damaged.push(ev));

    stepOntoTrap(world, player, 10, 10);
    trapSystem(world);
    world.step = 1;
    stepOntoTrap(world, player, 10, 10);
    trapSystem(world);

    assert(world.get(player, Vitality).hp === 84, `arrow trap should fire twice, hp=${world.get(player, Vitality).hp}`);
    const t = world.get(trap, Trap);
    assert(t.armed === false, "arrow trap should schedule its next reset after triggering");
    assert(t.params.resetAtStep === 2, `arrow trap should reset one turn later, resetAtStep=${t.params.resetAtStep}`);
    assert(t.revealed === true, "arrow trap should be revealed after triggering");
    assert(shots.length === 2, `arrow trap should emit projectile shots, got ${shots.length}`);
    assert(shots[0].from.x === 10 && shots[0].from.y === 9, `expected shot from wall at (10,9), got (${shots[0].from.x},${shots[0].from.y})`);
    assert(damaged.every((ev) => ev.projectileKind === "arrow"), "arrow trap damage should carry arrow projectile metadata");
  } finally {
    clearAll();
  }
});

Deno.test("arrow trap can be triggered by lured monsters and remains reusable", () => {
  clearAll();
  try {
    loadChunk(0, 0, new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR));
    setTile(8, 7, TILE_WALL);
    const world = new World({ seed: 10 });
    const player = world.create();
    world.add(player, Player);
    world.add(player, Position, { x: 10, y: 10 });
    world.add(player, Vitality, { maxHp: 100, hp: 100 });

    const monster = world.create();
    world.add(monster, Position, { x: 8, y: 8 });
    world.add(monster, Vitality, { maxHp: 30, hp: 30 });

    const trap = world.create();
    world.add(trap, Position, { x: 8, y: 8 });
    world.add(trap, Trap, {
      type: "arrow",
      armed: true,
      revealed: false,
      script: "trap_arrow",
      params: { damage: 6, resetsEvery: 1, maxWallDistance: 8 },
      difficulty: 14,
    });

    stepOntoTrap(world, monster, 8, 8);
    trapSystem(world);
    world.step = 1;
    stepOntoTrap(world, monster, 8, 8);
    trapSystem(world);

    assert(world.get(monster, Vitality).hp === 18, `monster should take repeat arrow trap damage, hp=${world.get(monster, Vitality).hp}`);
    assert(world.get(player, Vitality).hp === 100, "nearby player should not be hit when monster is on the plate");
    assert(world.get(trap, Trap).params.resetAtStep === 2, "arrow trap should keep scheduling future lure plays");
  } finally {
    clearAll();
  }
});

Deno.test("arrow trap rearming does not fire when actor walks off the plate", () => {
  clearAll();
  try {
    loadChunk(0, 0, new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR));
    setTile(10, 9, TILE_WALL);
    const world = new World({ seed: 11 });
    world.install(trapStepListenerExtension);
    world.setScheduler((w) => {
      movementSystem(w);
      trapSystem(w);
    });

    const player = world.create();
    world.add(player, Player);
    world.add(player, Position, { x: 10, y: 11 });
    world.add(player, Vitality, { maxHp: 100, hp: 100 });

    const trap = world.create();
    world.add(trap, Position, { x: 10, y: 10 });
    world.add(trap, Trap, {
      type: "arrow",
      armed: true,
      revealed: false,
      script: "trap_arrow",
      params: { damage: 7, resetsEvery: 1, maxWallDistance: 8 },
      difficulty: 21,
    });

    const shots = [];
    world.on("ranged:shot", (ev) => shots.push(ev));

    world.add(player, MoveIntent, { dx: 0, dy: -1 });
    world.tick(1);
    assert(world.get(player, Vitality).hp === 93, "arrow trap should fire when stepping onto the plate");
    assert(shots.length === 1, `expected first shot only, got ${shots.length}`);

    world.add(player, MoveIntent, { dx: 1, dy: 0 });
    world.tick(1);
    assert(world.get(player, Vitality).hp === 93, "arrow trap must not fire after actor walks off the plate");
    assert(shots.length === 1, `walking off should not create a second shot, got ${shots.length}`);

    const t = world.get(trap, Trap);
    assert(t.armed === true, "trap should be rearmed for a later actor after the departure tick");
  } finally {
    clearAll();
  }
});
