import "./helpers/installContentMonsters.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { configureWorld } from "../src/main/scheduler.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { AggroState } from "../src/rules/components/AggroState.js";
import { Anatomy } from "../src/rules/components/Anatomy.js";
import { Brain } from "../src/rules/components/Brain.js";
import { Collider } from "../src/rules/components/Collider.js";
import { CreatureType } from "../src/rules/components/CreatureType.js";
import { Encumbrance } from "../src/rules/components/Encumbrance.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { Mana } from "../src/rules/components/Mana.js";
import { MonsterSpawner } from "../src/rules/components/MonsterSpawner.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Physiology } from "../src/rules/components/Physiology.js";
import { Position } from "../src/rules/components/Position.js";
import { Resistances } from "../src/rules/components/Resistences.js";
import { SoundEmitter } from "../src/rules/components/SoundEmitter.js";
import { Speed } from "../src/rules/components/Speed.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Wounds } from "../src/rules/components/Wounds.js";
import { materializeSpawn } from "../src/rules/environment/dungeon/populate.js";
import { pickSpecificMonster } from "../src/rules/environment/dungeon/tables.js";
import { TILE_FLOOR, CHUNK_SIZE } from "../src/rules/environment/dungeon/constants.js";
import { clearAll, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";
import { applyMutation } from "../src/rules/interaction/mutations.js";
import { getMonster } from "../src/rules/data/monsters.js";
import { monsterDeathHookSystem } from "../src/rules/systems/monsterDeathHookSystem.js";
import { monsterSpawnerSystem } from "../src/rules/systems/monsterSpawnerSystem.js";
import { dealDamage } from "../src/rules/utils/dealDamage.js";

const MONSTER_BASELINE = Object.freeze([
  Position,
  NamedIdentity,
  Faction,
  Collider,
  Inventory,
  Equipment,
  Vitality,
  Speed,
  Resistances,
  Anatomy,
  Physiology,
  Wounds,
  ActiveEffects,
  AggroState,
  SoundEmitter,
  CreatureType,
  Encumbrance,
]);

function setupFloorTiles() {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
}

function findEntityAt(world, x, y, identity) {
  for (const [id, pos, ni] of world.query(Position, NamedIdentity)) {
    if (!pos || !ni) continue;
    if ((pos.x | 0) !== (x | 0) || (pos.y | 0) !== (y | 0)) continue;
    if (String(ni.identity || "") !== String(identity || "")) continue;
    return id;
  }
  return 0;
}

function describeMonster(world, id) {
  return {
    components: MONSTER_BASELINE
      .filter((Comp) => world.has(id, Comp))
      .map((Comp) => Comp.name)
      .sort(),
    identity: world.get(id, NamedIdentity),
    speed: world.get(id, Speed),
    creatureType: world.get(id, CreatureType),
    electricOhms: world.get(id, Resistances)?.electric?.ohms,
  };
}

Deno.test("grid_bug parity: debug spawn, dungeon spawn, and spawner child share the same build and death cloud", () => {
  setupFloorTiles();

  const world = new World({ seed: 0xC0FFEE });
  configureWorld(world);

  applyMutation(world, {
    type: "spawnMonster",
    monsterId: "grid_bug",
    x: 2,
    y: 2,
    emitEvent: false,
  }, { getMonster });
  const debugId = findEntityAt(world, 2, 2, "grid_bug");
  assert(debugId > 0, "debug-style spawn should create a grid bug");

  const spawnParams = pickSpecificMonster("grid_bug", 1);
  assert(spawnParams, "grid_bug spawn params should resolve");

  const dungeonId = materializeSpawn(world, {
    x: 5,
    y: 2,
    kind: "monster",
    params: spawnParams,
  });
  assert(dungeonId > 0, "dungeon materialize should create a grid bug");

  const spawnerId = world.create();
  world.add(spawnerId, Position, { x: 8, y: 2 });
  world.add(spawnerId, MonsterSpawner, {
    maxConcurrent: 1,
    cooldownTicks: 0,
    totalToSpawn: 1,
    spawnedSoFar: 0,
    lastSpawnStep: -Infinity,
    activeChildren: [],
    spawnParams,
    spawnRadius: 0,
    isActive: true,
  });
  monsterSpawnerSystem(world);

  const spawnerState = world.get(spawnerId, MonsterSpawner);
  const spawnerChildId = Number(spawnerState?.activeChildren?.[0] || 0) | 0;
  assert(spawnerChildId > 0, "spawner should create a grid bug child");

  const debugDesc = describeMonster(world, debugId);
  const dungeonDesc = describeMonster(world, dungeonId);
  const spawnerDesc = describeMonster(world, spawnerChildId);

  assertEquals(debugDesc.components, dungeonDesc.components);
  assertEquals(debugDesc.components, spawnerDesc.components);
  assertEquals(debugDesc.identity?.identity, "grid_bug");
  assertEquals(debugDesc.identity, dungeonDesc.identity);
  assertEquals(debugDesc.identity, spawnerDesc.identity);
  assertEquals(debugDesc.speed?.actEvery, dungeonDesc.speed?.actEvery);
  assertEquals(debugDesc.speed?.actEvery, spawnerDesc.speed?.actEvery);
  assertEquals(debugDesc.creatureType?.type, dungeonDesc.creatureType?.type);
  assertEquals(debugDesc.creatureType?.type, spawnerDesc.creatureType?.type);
  assertEquals(debugDesc.electricOhms, Infinity);
  assertEquals(dungeonDesc.electricOhms, Infinity);
  assertEquals(spawnerDesc.electricOhms, Infinity);

  const spawned = [];
  world.on("hazard:spawned", (event) => spawned.push(event));

  for (const id of [debugId, dungeonId, spawnerChildId]) {
    dealDamage(world, {
      target: id,
      amount: 999,
      type: "physical",
      source: 0,
      bypassResist: true,
    });
  }
  monsterDeathHookSystem(world);

  assertEquals(spawned.length, 3, "all grid bug variants should leave plasma");
  for (const event of spawned) {
    assertEquals(String(event?.kind || ""), "plasma");
    assertEquals(String(event?.identity || ""), "plasma_cloud");
  }
});

Deno.test("caster parity: mutation spawn keeps warlock learned spells and mana", () => {
  setupFloorTiles();

  const world = new World({ seed: 0xC0FFEE });
  configureWorld(world);

  applyMutation(world, {
    type: "spawnMonster",
    monsterId: "skeletal_agony_warlock",
    x: 3,
    y: 3,
    emitEvent: false,
  }, { getMonster });

  const warlockId = findEntityAt(world, 3, 3, "skeletal_agony_warlock");
  assert(warlockId > 0, "mutation spawn should create warlock");

  const brain = world.get(warlockId, Brain);
  const mana = world.get(warlockId, Mana);

  assert(Array.isArray(brain?.learnedSpellIds), "warlock should have learnedSpellIds array");
  assert(brain.learnedSpellIds.includes("shadow_bolt"), "warlock should know shadow_bolt");
  assert(brain.learnedSpellIds.includes("agony"), "warlock should know agony");
  assert(brain.learnedSpellIds.includes("summon_skeleton"), "warlock should know summon_skeleton");

  assert(mana, "warlock should have mana component");
  assertEquals(Number(mana?.maxMana || 0), 58);
  assertEquals(Number(mana?.mana || 0), 58);
});
