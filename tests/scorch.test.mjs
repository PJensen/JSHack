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

Deno.test("scorch deals fire damage to target", () => {
  setupFloorTiles();
  const world = new World({ seed: 60 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { name: 'Mage' });
  const brain = world.get(player, Brain);
  brain.learnedSpellIds = ['scorch'];
  brain.intelligence = 12;
  const pos = world.get(player, Position);
  pos.x = 5; pos.y = 5;
  const mana = world.get(player, Mana);
  mana.mana = 50; mana.maxMana = 50;

  const enemy = createEnemy(world, 7, 5, 100);
  const hpBefore = world.get(enemy, Vitality).hp;

  world.add(player, CastSpellIntent, { spellId: 'scorch', targetId: enemy, x: 7, y: 5 });
  world.tick(1);

  const hpAfter = world.get(enemy, Vitality).hp;
  assert(hpAfter < hpBefore, `scorch should deal damage: before=${hpBefore} after=${hpAfter}`);
});

Deno.test("scorch applies fire vulnerability debuff (negative resist_fire)", () => {
  setupFloorTiles();
  const world = new World({ seed: 61 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { name: 'Mage' });
  const brain = world.get(player, Brain);
  brain.learnedSpellIds = ['scorch'];
  brain.intelligence = 12;
  const pos = world.get(player, Position);
  pos.x = 5; pos.y = 5;
  const mana = world.get(player, Mana);
  mana.mana = 50; mana.maxMana = 50;

  const enemy = createEnemy(world, 7, 5, 100);

  world.add(player, CastSpellIntent, { spellId: 'scorch', targetId: enemy, x: 7, y: 5 });
  world.tick(1);

  const ae = world.get(enemy, ActiveEffects);
  assert(ae, 'enemy should have ActiveEffects');
  const scorchDebuff = ae.effects.find(e => e.key === 'resist_fire' && e.potency < 0);
  assert(scorchDebuff, 'should have negative resist_fire effect (fire vulnerability)');
  assertEquals(scorchDebuff.potency, -0.3, 'fire vulnerability should be -0.3');
  assertEquals(scorchDebuff.turnsLeft, 15, 'fire vulnerability should last 15 turns');
});

Deno.test("scorch fizzles with no target in range", () => {
  setupFloorTiles();
  const world = new World({ seed: 62 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { name: 'Mage' });
  const brain = world.get(player, Brain);
  brain.learnedSpellIds = ['scorch'];
  brain.intelligence = 10;
  const pos = world.get(player, Position);
  pos.x = 5; pos.y = 5;
  const mana = world.get(player, Mana);
  mana.mana = 50; mana.maxMana = 50;

  // Enemy far out of range
  const enemy = createEnemy(world, 50, 50, 100);

  const fizzles = [];
  world.on('spell:scorch', (e) => { if (e.fizzle) fizzles.push(e); });

  world.add(player, CastSpellIntent, { spellId: 'scorch' });
  world.tick(1);

  assert(fizzles.length > 0, 'should emit fizzle event');
});

Deno.test("scorch respects LOS — blocked by wall", () => {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  tiles[7 * CHUNK_SIZE + 5] = TILE_WALL;
  loadChunk(0, 0, tiles);

  const world = new World({ seed: 63 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { name: 'Mage' });
  const brain = world.get(player, Brain);
  brain.learnedSpellIds = ['scorch'];
  brain.intelligence = 10;
  const pos = world.get(player, Position);
  pos.x = 5; pos.y = 5;
  const mana = world.get(player, Mana);
  mana.mana = 50; mana.maxMana = 50;

  const enemy = createEnemy(world, 5, 8, 100);

  const fizzles = [];
  world.on('spell:scorch', (e) => { if (e.fizzle) fizzles.push(e); });

  world.add(player, CastSpellIntent, { spellId: 'scorch', targetId: enemy, x: 5, y: 8 });
  world.tick(1);

  assert(fizzles.length > 0, 'should fizzle when LOS is blocked');
  const hpAfter = world.get(enemy, Vitality).hp;
  assertEquals(hpAfter, 100, 'enemy should not take damage through wall');
});

Deno.test("scorch prefers intent.targetId over nearest enemy", () => {
  setupFloorTiles();
  const world = new World({ seed: 64 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { name: 'Mage' });
  const brain = world.get(player, Brain);
  brain.learnedSpellIds = ['scorch'];
  brain.intelligence = 12;
  const pos = world.get(player, Position);
  pos.x = 5; pos.y = 5;
  const mana = world.get(player, Mana);
  mana.mana = 50; mana.maxMana = 50;

  const nearEnemy = createEnemy(world, 6, 5, 100);
  const farEnemy = createEnemy(world, 8, 5, 100);

  // Explicitly target the far enemy
  world.add(player, CastSpellIntent, { spellId: 'scorch', targetId: farEnemy, x: 8, y: 5 });
  world.tick(1);

  const farHp = world.get(farEnemy, Vitality).hp;
  assert(farHp < 100, 'explicitly targeted far enemy should take damage');

  const nearHp = world.get(nearEnemy, Vitality).hp;
  assertEquals(nearHp, 100, 'near enemy should not take damage');
});
