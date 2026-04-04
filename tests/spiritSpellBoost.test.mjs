// @ts-nocheck
import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { createPlayer } from '../src/rules/archetypes/Player.js';
import { Brain } from '../src/rules/components/Brain.js';
import { Mana } from '../src/rules/components/Mana.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { Devotion } from '../src/rules/components/Devotion.js';
import { CastSpellIntent } from '../src/rules/components/Intents/CastSpellIntent.js';
import { castSpellSystem } from '../src/rules/systems/castSpellSystem.js';
import { initDeity } from '../src/rules/systems/deitySystem.js';

function scheduler(world) {
  try { castSpellSystem(world); } catch (e) { console.error('cast system error', e); }
}

function setupPlayer(world, opts = {}) {
  const player = createPlayer(world, { name: 'Mage', maxHp: 20, hp: opts.hp ?? 20 });
  const brain = world.get(player, Brain);
  if (!Array.isArray(brain.learnedSpellIds)) brain.learnedSpellIds = [];
  brain.learnedSpellIds.push('lightning');
  let mana = world.get(player, Mana);
  if (!mana) { world.add(player, Mana, { maxMana: 50, mana: 50, manaRegen: 0 }); mana = world.get(player, Mana); }
  mana.mana = 50;
  mana.maxMana = 50;

  // Set HP
  const vit = world.get(player, Vitality);
  if (opts.hp !== undefined) vit.hp = opts.hp;

  // Set up deity if requested
  if (opts.deityId) {
    world.add(player, Devotion, { deityId: opts.deityId, pantheon: false });
    initDeity(opts.deityId, world);
  }

  return player;
}

Deno.test("spirit boost does not fire without a deity patron", () => {
  let boosted = false;
  // Try many seeds — none should boost without deity
  for (let seed = 0; seed < 20; seed++) {
    const world = new World({ seed });
    world.setScheduler(scheduler);
    const player = setupPlayer(world, { hp: 3 }); // very low HP, no deity

    world.on('spirit:spellBoost', () => { boosted = true; });
    world.add(player, CastSpellIntent, { spellId: 'lightning' });
    world.tick(1);
  }
  assert(!boosted, 'spirit boost should never fire without a deity');
});

Deno.test("spirit boost does not fire at full HP", () => {
  let boosted = false;
  for (let seed = 0; seed < 30; seed++) {
    const world = new World({ seed });
    world.setScheduler(scheduler);
    const player = setupPlayer(world, { hp: 20, deityId: 'seraphine' });

    world.on('spirit:spellBoost', () => { boosted = true; });
    world.add(player, CastSpellIntent, { spellId: 'lightning' });
    world.tick(1);
  }
  assert(!boosted, 'spirit boost should never fire at full HP');
});

Deno.test("spirit boost can fire when player is hurting with deity", () => {
  let boostCount = 0;
  const attempts = 100;
  for (let seed = 0; seed < attempts; seed++) {
    const world = new World({ seed });
    world.setScheduler(scheduler);
    // HP = 3/20 = 15%, well below 50% threshold
    const player = setupPlayer(world, { hp: 3, deityId: 'seraphine' });

    world.on('spirit:spellBoost', () => { boostCount++; });
    world.add(player, CastSpellIntent, { spellId: 'lightning' });
    world.tick(1);
  }
  // With ~35% chance at 15% HP, we expect roughly 25-45 boosts out of 100
  assert(boostCount > 5, `spirit boost should fire sometimes when hurting (got ${boostCount}/${attempts})`);
  assert(boostCount < attempts, `spirit boost should not fire every time (got ${boostCount}/${attempts})`);
});

Deno.test("spirit boost scales powerScale on the castSpell event", () => {
  let boostedPowerScale = null;
  // Find a seed that triggers the boost at low HP
  // castSpell fires with spiritBoosted flag + boosted powerScale
  for (let seed = 0; seed < 200; seed++) {
    const world = new World({ seed });
    world.setScheduler(scheduler);
    const player = setupPlayer(world, { hp: 2, deityId: 'seraphine' });

    world.on('castSpell', (e) => {
      if (e.spiritBoosted) boostedPowerScale = e.powerScale;
    });

    world.add(player, CastSpellIntent, { spellId: 'lightning' });
    world.tick(1);
    if (boostedPowerScale !== null) break;
  }
  assert(boostedPowerScale !== null, 'should find at least one seed that triggers boost');
  assert(boostedPowerScale > 1.0, `boosted powerScale should be > 1.0, got ${boostedPowerScale}`);
  assert(Math.abs(boostedPowerScale - 1.3) < 0.02, `boosted powerScale should be ~1.3, got ${boostedPowerScale}`);
});

Deno.test("spirit boost emits spiritBoosted flag on castSpell event", () => {
  let foundBoostedEvent = false;
  for (let seed = 0; seed < 200; seed++) {
    const world = new World({ seed });
    world.setScheduler(scheduler);
    const player = setupPlayer(world, { hp: 2, deityId: 'seraphine' });

    world.on('castSpell', (e) => {
      if (e.spiritBoosted) foundBoostedEvent = true;
    });

    world.add(player, CastSpellIntent, { spellId: 'lightning' });
    world.tick(1);
    if (foundBoostedEvent) break;
  }
  assert(foundBoostedEvent, 'castSpell event should include spiritBoosted flag');
});
