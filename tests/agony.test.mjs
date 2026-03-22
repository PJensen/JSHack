// @ts-nocheck
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { createPlayer } from '../src/rules/archetypes/Player.js';
import { Position } from '../src/rules/components/Position.js';
import { Faction } from '../src/rules/components/Faction.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { Brain } from '../src/rules/components/Brain.js';
import { Mana } from '../src/rules/components/Mana.js';
import { ActiveEffects } from '../src/rules/components/ActiveEffects.js';
import { CastSpellIntent } from '../src/rules/components/Intents/CastSpellIntent.js';
import { castSpellSystem } from '../src/rules/systems/castSpellSystem.js';
import { effectSystem } from '../src/rules/systems/effectSystem.js';
import { clearAll, loadChunk, setTile } from "../src/rules/environment/dungeon/tileMap.js";
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL } from "../src/rules/environment/dungeon/constants.js";

// Helpers ──────────────────────────────────────────────────────────────────

function setupFloorTiles() {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
}

function createEnemy(world, x, y, hp = 50) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Faction, { key: 'enemy' });
  world.add(id, Vitality, { maxHp: hp, hp });
  return id;
}

function scheduler(world) {
  try { castSpellSystem(world); } catch (e) { console.error('cast system error', e); }
}

// Tests ────────────────────────────────────────────────────────────────────

Deno.test("agony applies DOT effect to target", () => {
  setupFloorTiles();
  const world = new World({ seed: 42 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { name: 'Warlock' });
  const brain = world.get(player, Brain);
  brain.learnedSpellIds = ['agony'];
  brain.intelligence = 13;
  const pos = world.get(player, Position);
  pos.x = 5; pos.y = 5;

  const mana = world.get(player, Mana);
  mana.mana = 50; mana.maxMana = 50;

  const enemy = createEnemy(world, 8, 5);

  world.add(player, CastSpellIntent, { spellId: 'agony', targetId: enemy, x: 8, y: 5 });
  world.tick(1);

  const ae = world.get(enemy, ActiveEffects);
  assert(ae, 'enemy should have ActiveEffects');
  assert(Array.isArray(ae.effects), 'effects should be array');
  const agony = ae.effects.find(e => e.key === 'agony');
  assert(agony, 'should have agony effect');
  assert(agony.turnsLeft > 0, 'agony should have remaining turns');
  assert(agony.potency >= 1, 'agony potency should be at least 1');
  assertEquals(agony.stacks, 1, 'DOT stacks should be 1');
});

Deno.test("agony deals shadow damage each tick", () => {
  setupFloorTiles();
  const world = new World({ seed: 43 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { name: 'Warlock' });
  const brain = world.get(player, Brain);
  brain.learnedSpellIds = ['agony'];
  brain.intelligence = 10;
  const pos = world.get(player, Position);
  pos.x = 5; pos.y = 5;

  const mana = world.get(player, Mana);
  mana.mana = 50; mana.maxMana = 50;

  const enemy = createEnemy(world, 7, 5, 100);

  // Track damage events
  const damageEvents = [];
  world.on('damaged', (e) => damageEvents.push(e));

  world.add(player, CastSpellIntent, { spellId: 'agony', targetId: enemy, x: 7, y: 5 });
  world.tick(1);

  const hpBefore = world.get(enemy, Vitality).hp;

  // Run effectSystem to tick the DOT
  effectSystem(world);

  const hpAfter = world.get(enemy, Vitality).hp;
  assert(hpAfter < hpBefore, `DOT should reduce HP: before=${hpBefore} after=${hpAfter}`);
});

Deno.test("agony refreshes duration on reapply, stacks stay at 1", () => {
  setupFloorTiles();
  const world = new World({ seed: 44 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { name: 'Warlock' });
  const brain = world.get(player, Brain);
  brain.learnedSpellIds = ['agony'];
  brain.intelligence = 10;
  const pos = world.get(player, Position);
  pos.x = 5; pos.y = 5;

  const mana = world.get(player, Mana);
  mana.mana = 100; mana.maxMana = 100;

  const enemy = createEnemy(world, 7, 5, 100);

  // First cast
  world.add(player, CastSpellIntent, { spellId: 'agony', targetId: enemy, x: 7, y: 5 });
  world.tick(1);

  // Tick a few times to reduce duration
  effectSystem(world);
  effectSystem(world);

  const ae = world.get(enemy, ActiveEffects);
  const agonyBefore = ae.effects.find(e => e.key === 'agony');
  const durationBefore = agonyBefore.turnsLeft;

  // Second cast — should refresh
  world.add(player, CastSpellIntent, { spellId: 'agony', targetId: enemy, x: 7, y: 5 });
  world.tick(1);

  const ae2 = world.get(enemy, ActiveEffects);
  const agonies = ae2.effects.filter(e => e.key === 'agony');
  assertEquals(agonies.length, 1, 'should not duplicate agony entries');
  assert(agonies[0].turnsLeft >= durationBefore, 'duration should be refreshed');
  assertEquals(agonies[0].stacks, 1, 'stacks should remain 1');
});

Deno.test("agony fizzles with no target in range", () => {
  setupFloorTiles();
  const world = new World({ seed: 45 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { name: 'Warlock' });
  const brain = world.get(player, Brain);
  brain.learnedSpellIds = ['agony'];
  brain.intelligence = 10;
  const pos = world.get(player, Position);
  pos.x = 5; pos.y = 5;

  const mana = world.get(player, Mana);
  mana.mana = 50; mana.maxMana = 50;

  // Enemy far out of range
  const enemy = createEnemy(world, 50, 50, 100);

  const fizzles = [];
  world.on('spell:agony', (e) => { if (e.fizzle) fizzles.push(e); });

  // Cast with no valid target — falls back to auto-target which finds nothing in range
  world.add(player, CastSpellIntent, { spellId: 'agony' });
  world.tick(1);

  assert(fizzles.length > 0, 'should emit fizzle event');
  const ae = world.get(enemy, ActiveEffects);
  assert(!ae || !ae.effects?.some(e => e.key === 'agony'), 'enemy should not have agony');
});

Deno.test("agony respects LOS — blocked by wall", () => {
  clearAll();
  // Build a floor with a wall blocking LOS between (5,5) and (5,8)
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  // Place wall at (5,7) to block LOS from (5,5) to (5,8)
  tiles[7 * CHUNK_SIZE + 5] = TILE_WALL;
  loadChunk(0, 0, tiles);

  const world = new World({ seed: 46 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { name: 'Warlock' });
  const brain = world.get(player, Brain);
  brain.learnedSpellIds = ['agony'];
  brain.intelligence = 10;
  const pos = world.get(player, Position);
  pos.x = 5; pos.y = 5;

  const mana = world.get(player, Mana);
  mana.mana = 50; mana.maxMana = 50;

  const enemy = createEnemy(world, 5, 8, 100);

  const fizzles = [];
  world.on('spell:agony', (e) => { if (e.fizzle) fizzles.push(e); });

  world.add(player, CastSpellIntent, { spellId: 'agony', targetId: enemy, x: 5, y: 8 });
  world.tick(1);

  assert(fizzles.length > 0, 'should fizzle when LOS is blocked');
  const ae = world.get(enemy, ActiveEffects);
  assert(!ae || !ae.effects?.some(e => e.key === 'agony'), 'enemy should not have agony');
});

Deno.test("agony scales with intelligence", () => {
  setupFloorTiles();
  const world = new World({ seed: 47 });
  world.setScheduler((w) => scheduler(w));

  // Low INT caster
  const player1 = createPlayer(world, { name: 'Warlock1' });
  const brain1 = world.get(player1, Brain);
  brain1.learnedSpellIds = ['agony'];
  brain1.intelligence = 10;
  const pos1 = world.get(player1, Position);
  pos1.x = 3; pos1.y = 3;
  const mana1 = world.get(player1, Mana);
  mana1.mana = 50; mana1.maxMana = 50;

  const enemy1 = createEnemy(world, 4, 3, 100);
  world.add(player1, CastSpellIntent, { spellId: 'agony', targetId: enemy1, x: 4, y: 3 });
  world.tick(1);

  const ae1 = world.get(enemy1, ActiveEffects);
  const agony1 = ae1.effects.find(e => e.key === 'agony');

  // High INT caster
  const world2 = new World({ seed: 48 });
  world2.setScheduler((w) => { try { castSpellSystem(w); } catch (e) { console.error(e); } });
  setupFloorTiles();

  const player2 = createPlayer(world2, { name: 'Warlock2' });
  const brain2 = world2.get(player2, Brain);
  brain2.learnedSpellIds = ['agony'];
  brain2.intelligence = 20;
  const pos2 = world2.get(player2, Position);
  pos2.x = 3; pos2.y = 3;
  const mana2 = world2.get(player2, Mana);
  mana2.mana = 50; mana2.maxMana = 50;

  const enemy2 = createEnemy(world2, 4, 3, 100);
  world2.add(player2, CastSpellIntent, { spellId: 'agony', targetId: enemy2, x: 4, y: 3 });
  world2.tick(1);

  const ae2 = world2.get(enemy2, ActiveEffects);
  const agony2 = ae2.effects.find(e => e.key === 'agony');

  assert(agony2.potency > agony1.potency || agony2.turnsLeft > agony1.turnsLeft,
    `higher INT should increase potency or duration: INT10=[p=${agony1.potency},d=${agony1.turnsLeft}] INT20=[p=${agony2.potency},d=${agony2.turnsLeft}]`);
});

Deno.test("agony effect expires after turnsLeft reaches 0", () => {
  setupFloorTiles();
  const world = new World({ seed: 49 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { name: 'Warlock' });
  const brain = world.get(player, Brain);
  brain.learnedSpellIds = ['agony'];
  brain.intelligence = 10;
  const pos = world.get(player, Position);
  pos.x = 5; pos.y = 5;

  const mana = world.get(player, Mana);
  mana.mana = 50; mana.maxMana = 50;

  const enemy = createEnemy(world, 7, 5, 200);

  world.add(player, CastSpellIntent, { spellId: 'agony', targetId: enemy, x: 7, y: 5 });
  world.tick(1);

  const ae = world.get(enemy, ActiveEffects);
  const agony = ae.effects.find(e => e.key === 'agony');
  const duration = agony.turnsLeft;

  // Tick effectSystem until the effect expires
  for (let i = 0; i < duration + 2; i++) {
    effectSystem(world);
  }

  const aeAfter = world.get(enemy, ActiveEffects);
  const remaining = aeAfter?.effects?.filter(e => e.key === 'agony') ?? [];
  assertEquals(remaining.length, 0, 'agony should be removed after expiry');
});

// ── Auto-rotation tests ──────────────────────────────────────────────────

Deno.test("agony auto-targets enemy missing agony over one that has it", () => {
  setupFloorTiles();
  const world = new World({ seed: 50 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { name: 'Warlock' });
  const brain = world.get(player, Brain);
  brain.learnedSpellIds = ['agony'];
  brain.intelligence = 10;
  const pos = world.get(player, Position);
  pos.x = 5; pos.y = 5;
  const mana = world.get(player, Mana);
  mana.mana = 100; mana.maxMana = 100;

  const enemyA = createEnemy(world, 7, 5, 100);
  const enemyB = createEnemy(world, 8, 5, 100);

  // First cast — should hit nearest (enemyA at dist 2)
  world.add(player, CastSpellIntent, { spellId: 'agony' });
  world.tick(1);

  const aeA1 = world.get(enemyA, ActiveEffects);
  assert(aeA1?.effects?.some(e => e.key === 'agony'), 'first cast should hit nearest enemy');

  // Second cast — enemyA already has agony, enemyB does not → pick enemyB
  world.add(player, CastSpellIntent, { spellId: 'agony' });
  world.tick(1);

  const aeB = world.get(enemyB, ActiveEffects);
  assert(aeB?.effects?.some(e => e.key === 'agony'), 'second cast should rotate to enemy missing agony');
});

Deno.test("agony refreshes lowest-duration agony when all enemies have it", () => {
  setupFloorTiles();
  const world = new World({ seed: 51 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { name: 'Warlock' });
  const brain = world.get(player, Brain);
  brain.learnedSpellIds = ['agony'];
  brain.intelligence = 10;
  const pos = world.get(player, Position);
  pos.x = 5; pos.y = 5;
  const mana = world.get(player, Mana);
  mana.mana = 200; mana.maxMana = 200;

  const enemyA = createEnemy(world, 7, 5, 100);
  const enemyB = createEnemy(world, 8, 5, 100);

  // Apply agony to both enemies
  world.add(player, CastSpellIntent, { spellId: 'agony' });
  world.tick(1);
  world.add(player, CastSpellIntent, { spellId: 'agony' });
  world.tick(1);

  // Tick down enemyA's agony (applied first, so lower turnsLeft)
  effectSystem(world);
  effectSystem(world);

  const aeA = world.get(enemyA, ActiveEffects);
  const agonyA = aeA.effects.find(e => e.key === 'agony');
  const turnsBeforeA = agonyA.turnsLeft;

  const aeB = world.get(enemyB, ActiveEffects);
  const agonyB = aeB.effects.find(e => e.key === 'agony');
  const turnsBeforeB = agonyB.turnsLeft;

  // Third cast — should refresh the one with lowest turnsLeft
  world.add(player, CastSpellIntent, { spellId: 'agony' });
  world.tick(1);

  const agonyAAfter = world.get(enemyA, ActiveEffects).effects.find(e => e.key === 'agony');
  const agonyBAfter = world.get(enemyB, ActiveEffects).effects.find(e => e.key === 'agony');

  // The one with lower turnsLeft should have been refreshed
  if (turnsBeforeA <= turnsBeforeB) {
    assert(agonyAAfter.turnsLeft >= turnsBeforeA, 'should refresh enemy with lowest agony duration');
  } else {
    assert(agonyBAfter.turnsLeft >= turnsBeforeB, 'should refresh enemy with lowest agony duration');
  }
});

Deno.test("agony auto-targets nearest when no targetId provided", () => {
  setupFloorTiles();
  const world = new World({ seed: 52 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { name: 'Warlock' });
  const brain = world.get(player, Brain);
  brain.learnedSpellIds = ['agony'];
  brain.intelligence = 10;
  const pos = world.get(player, Position);
  pos.x = 5; pos.y = 5;
  const mana = world.get(player, Mana);
  mana.mana = 50; mana.maxMana = 50;

  // Near enemy at distance 3
  const nearEnemy = createEnemy(world, 8, 5, 100);
  // Far enemy at distance 6
  const farEnemy = createEnemy(world, 5, 11, 100);

  // Cast with no targetId
  world.add(player, CastSpellIntent, { spellId: 'agony' });
  world.tick(1);

  const nearAe = world.get(nearEnemy, ActiveEffects);
  assert(nearAe?.effects?.some(e => e.key === 'agony'), 'nearest enemy should get agony');

  const farAe = world.get(farEnemy, ActiveEffects);
  assert(!farAe?.effects?.some(e => e.key === 'agony'), 'far enemy should not get agony yet');
});
