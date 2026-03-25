// @ts-nocheck
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createPlayer } from "../src/rules/archetypes/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Brain } from "../src/rules/components/Brain.js";
import { Mana } from "../src/rules/components/Mana.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { Channeling } from "../src/rules/components/Channeling.js";
import { CastSpellIntent } from "../src/rules/components/Intents/CastSpellIntent.js";
import { castSpellSystem } from "../src/rules/systems/castSpellSystem.js";
import { channelingSystem } from "../src/rules/systems/channelingSystem.js";
import { effectSystem } from "../src/rules/systems/effectSystem.js";
import { installDrainLifeDamageInterruptListener } from "../src/rules/systems/channelingSystem.js";
import { dealDamage } from "../src/rules/utils/dealDamage.js";
import { clearAll, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";

function setupFloorTiles() {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
}

function scheduler(world) {
  installDrainLifeDamageInterruptListener(world);
  try { channelingSystem(world); } catch (e) { console.error("channeling system error", e); }
  try { castSpellSystem(world); } catch (e) { console.error("cast system error", e); }
  try { effectSystem(world); } catch (e) { console.error("effect system error", e); }
}

function createEnemy(world, x, y, hp = 40) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Faction, { key: "enemy" });
  world.add(id, Vitality, { maxHp: hp, hp });
  return id;
}

function createDrainLifeCaster(world, x, y) {
  const caster = createPlayer(world, { name: "Warlock" });
  world.set(caster, Position, { x, y });
  world.set(caster, Faction, { key: "ally" });
  const brain = world.get(caster, Brain);
  brain.learnedSpellIds = ["drain_life"];
  brain.intelligence = 14;
  const mana = world.get(caster, Mana);
  mana.mana = 100;
  mana.maxMana = 100;
  return caster;
}

Deno.test("drain_life: applies channel effect on caster and emits start", () => {
  setupFloorTiles();
  const world = new World({ seed: 7001 });
  world.setScheduler((w) => scheduler(w));

  const caster = createDrainLifeCaster(world, 5, 5);
  const target = createEnemy(world, 7, 5, 50);
  const startEvents = [];
  world.on("spell:drain_life:start", (e) => startEvents.push(e));

  world.add(caster, CastSpellIntent, { spellId: "drain_life", targetId: target, x: 7, y: 5 });
  world.tick(1);
  world.tick(1);

  const ae = world.get(caster, ActiveEffects);
  assert(ae && Array.isArray(ae.effects), "caster should have active effects");
  const channel = ae.effects.find((e) => e.key === "drain_life_channel");
  assert(channel, "caster should receive drain_life_channel");
  assertEquals(Number(channel.meta?.channel?.targetId || 0), target);
  assert(startEvents.length > 0, "should emit drain_life:start");
});

Deno.test("drain_life: tick drains target and heals caster", () => {
  setupFloorTiles();
  const world = new World({ seed: 7002 });
  world.setScheduler((w) => scheduler(w));

  const caster = createDrainLifeCaster(world, 5, 5);
  const casterVit = world.get(caster, Vitality);
  casterVit.hp = Math.max(1, casterVit.hp - 10);
  const target = createEnemy(world, 7, 5, 60);

  world.add(caster, CastSpellIntent, { spellId: "drain_life", targetId: target, x: 7, y: 5 });
  world.tick(1);
  world.tick(1);

  const beforeTargetHp = world.get(target, Vitality).hp;
  const beforeCasterHp = world.get(caster, Vitality).hp;

  world.tick(1);

  const afterTargetHp = world.get(target, Vitality).hp;
  const afterCasterHp = world.get(caster, Vitality).hp;
  assert(afterTargetHp < beforeTargetHp, "drain tick should damage target");
  assert(afterCasterHp > beforeCasterHp, "drain tick should heal caster");
});

Deno.test("drain_life: moving caster breaks channel before tick", () => {
  setupFloorTiles();
  const world = new World({ seed: 7003 });
  world.setScheduler((w) => scheduler(w));

  const caster = createDrainLifeCaster(world, 5, 5);
  const target = createEnemy(world, 7, 5, 60);
  const breakEvents = [];
  world.on("spell:drain_life:break", (e) => breakEvents.push(e));

  world.add(caster, CastSpellIntent, { spellId: "drain_life", targetId: target, x: 7, y: 5 });
  world.tick(1);
  world.tick(1);

  const tpos = world.get(target, Position);
  const targetHpBefore = world.get(target, Vitality).hp;
  world.set(caster, Position, { x: 6, y: 5 });
  world.tick(1);

  const targetHpAfter = world.get(target, Vitality).hp;
  const ae = world.get(caster, ActiveEffects);
  const channelLeft = ae?.effects?.find((e) => e.key === "drain_life_channel");

  assertEquals(targetHpAfter, targetHpBefore, "break should prevent tick damage");
  assert(!channelLeft, "channel effect should be removed after break");
  assert(breakEvents.some((e) => e.reason === "caster_moved"), "should emit caster_moved break reason");
  assertEquals(tpos.x, 7);
});

Deno.test("drain_life: no valid target emits failed and does not apply effect", () => {
  setupFloorTiles();
  const world = new World({ seed: 7004 });
  world.setScheduler((w) => scheduler(w));

  const caster = createDrainLifeCaster(world, 5, 5);
  const failedEvents = [];
  world.on("spell:drain_life:failed", (e) => failedEvents.push(e));

  world.add(caster, CastSpellIntent, { spellId: "drain_life" });
  world.tick(1);
  world.tick(1);

  const ae = world.get(caster, ActiveEffects);
  const channel = ae?.effects?.find((e) => e.key === "drain_life_channel");
  assert(!channel, "channel effect should not be created without a valid target");
  assert(failedEvents.length > 0, "should emit drain_life:failed");
});

Deno.test("drain_life: incoming damage interrupts channel", () => {
  setupFloorTiles();
  const world = new World({ seed: 7005 });
  world.setScheduler((w) => scheduler(w));

  const caster = createDrainLifeCaster(world, 5, 5);
  const enemy = createEnemy(world, 7, 5, 60);
  const cancelled = [];
  world.on("channeling:cancelled", (e) => cancelled.push(e));

  world.add(caster, CastSpellIntent, { spellId: "drain_life", targetId: enemy, x: 7, y: 5 });
  world.tick(1);
  world.tick(1);
  assert(world.has(caster, Channeling), "drain_life should be actively channeling");

  dealDamage(world, { target: caster, source: enemy, amount: 1, type: "physical", cause: "melee" });

  assert(!world.has(caster, Channeling), "incoming damage should cancel drain_life channel");
  const ae = world.get(caster, ActiveEffects);
  assert(!ae?.effects?.some((e) => e.key === "drain_life_channel"), "drain_life effect should be removed on damage interrupt");
  assert(cancelled.some((e) => e.reason === "damage_interrupt"), "should emit damage_interrupt cancellation reason");
});
