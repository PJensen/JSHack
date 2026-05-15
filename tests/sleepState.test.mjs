import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { buildWorldView } from "../src/bridge/schema/worldView.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { BaseStats } from "../src/rules/components/BaseStats.js";
import { Facing } from "../src/rules/components/Facing.js";
import { SleepState } from "../src/rules/components/SleepState.js";
import { MoveIntent } from "../src/rules/components/Intents/MoveIntent.js";
import { AttackIntent } from "../src/rules/components/Intents/AttackIntent.js";
import { SearchIntent } from "../src/rules/components/Intents/SearchIntent.js";
import { intentValidationSystem } from "../src/rules/systems/intentValidationSystem.js";
import { clearAll, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";
import { clearExplored } from "../src/rules/environment/dungeon/exploredMap.js";
import { clearPerceptionMemory } from "../src/rules/environment/dungeon/perceptionMemory.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";
import { dealDamage } from "../src/rules/utils/dealDamage.js";
import { installSleepWakeListeners, isAsleep, tryWakeActor } from "../src/rules/utils/sleep.js";
import { getMonster } from "../src/rules/data/monsters.js";
import { toMonsterSpawnParams } from "../src/rules/utils/monsterSpawnParams.js";
import { spawnMonsterEntity } from "../src/rules/utils/spawnMonsterEntity.js";
import "../src/content/monsters/index.js";

function resetFloor() {
  clearAll();
  clearExplored();
  clearPerceptionMemory();
  loadChunk(0, 0, new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR));
}

function makeActor(world, x = 5, y = 5) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, NamedIdentity, { name: "Sleeper", identity: "goblin" });
  world.add(id, Vitality, { hp: 10, maxHp: 10 });
  return id;
}

Deno.test("SleepState blocks queued actor intents", () => {
  const world = new World({ seed: 0x51EE9 });
  const actor = makeActor(world);
  const target = makeActor(world, 6, 5);
  world.add(actor, SleepState, { asleep: true, wakeDifficulty: 8, wakeRadius: 2, wakeOnDamage: true });
  world.add(actor, MoveIntent, { dx: 1, dy: 0 });
  world.add(actor, AttackIntent, { target });
  world.add(actor, SearchIntent, {});

  let blocked = null;
  world.on("intent:blocked", (ev) => { blocked = ev; });
  intentValidationSystem(world);

  assert(!world.has(actor, MoveIntent), "sleeping actor should lose MoveIntent");
  assert(!world.has(actor, AttackIntent), "sleeping actor should lose AttackIntent");
  assert(!world.has(actor, SearchIntent), "sleeping actor should lose SearchIntent");
  assertEquals(blocked?.reason, "asleep");
});

Deno.test("damage wakes a sleeping actor through canonical listener", () => {
  const world = new World({ seed: 0xDA6A9E });
  installSleepWakeListeners(world);

  const source = makeActor(world, 4, 5);
  const sleeper = makeActor(world, 5, 5);
  world.add(sleeper, SleepState, { asleep: true, wakeDifficulty: 20, wakeRadius: 2, wakeOnDamage: true });

  let woke = null;
  world.on("sleep:woke", (ev) => { woke = ev; });

  dealDamage(world, {
    source,
    target: sleeper,
    amount: 1,
    type: "physical",
  });

  assert(!isAsleep(world, sleeper), "damage should wake sleeper");
  assertEquals(woke?.actor, sleeper);
  assertEquals(woke?.reason, "damage");
});

Deno.test("tryWakeActor respects non-damage wake difficulty", () => {
  const world = new World({ seed: 0x51EED });
  const sleeper = makeActor(world);
  world.add(sleeper, SleepState, { asleep: true, wakeDifficulty: 8, wakeRadius: 2, wakeOnDamage: true });

  assertEquals(tryWakeActor(world, sleeper, { reason: "noise", intensity: 4 }), false);
  assert(isAsleep(world, sleeper), "weak noise should not wake sleeper");

  assertEquals(tryWakeActor(world, sleeper, { reason: "noise", intensity: 8 }), true);
  assert(!isAsleep(world, sleeper), "strong enough noise should wake sleeper");
});

Deno.test("WorldView projects sleeping tag while SleepState is asleep", () => {
  resetFloor();
  const world = new World({ seed: 0xA51EE9 });

  const player = world.create();
  world.add(player, Player, {});
  world.add(player, Position, { x: 10, y: 10 });
  world.add(player, NamedIdentity, { name: "Hero", identity: "player" });
  world.add(player, Facing, { dx: 1, dy: 0 });
  world.add(player, BaseStats, { perception: 5 });

  const sleeper = makeActor(world, 11, 10);
  world.add(sleeper, SleepState, { asleep: true, wakeDifficulty: 8, wakeRadius: 2, wakeOnDamage: true });

  let view = buildWorldView(world);
  let rec = view.entities.find((e) => e.id === sleeper);
  assert(rec, "visible sleeper should be projected");
  assert(rec.tags.includes("sleeping"), "asleep entity should carry sleeping tag");

  world.set(sleeper, SleepState, { asleep: false, wakeDifficulty: 8, wakeRadius: 2, wakeOnDamage: true });
  view = buildWorldView(world);
  rec = view.entities.find((e) => e.id === sleeper);
  assert(rec, "awake entity should still be projected");
  assert(!rec.tags.includes("sleeping"), "awake entity should not carry sleeping tag");
});

Deno.test("authored bat sleep chance attaches SleepState deterministically", () => {
  const def = getMonster("bat");
  assert(def?.sleep, "bat should author sleep behavior");
  assertEquals(def.sleep.pattern, "roosting");

  const sleepyWorld = new World({ seed: 0xB47 });
  sleepyWorld.rand = () => 0.44;
  const sleepyBat = spawnMonsterEntity(sleepyWorld, { identity: "bat" });
  assert(isAsleep(sleepyWorld, sleepyBat), "bat should spawn asleep when roll is below chance");

  const awakeWorld = new World({ seed: 0xB48 });
  awakeWorld.rand = () => 0.46;
  const awakeBat = spawnMonsterEntity(awakeWorld, { identity: "bat" });
  assert(!isAsleep(awakeWorld, awakeBat), "bat should spawn awake when roll is above chance");
});

Deno.test("authored dragon sleep is forwarded through spawn params", () => {
  const def = getMonster("dragon");
  assert(def?.sleep, "dragon should author sleep behavior");
  assertEquals(def.sleep, "ancient");

  const params = toMonsterSpawnParams(def, 10);
  assertEquals(params.sleep, "ancient");

  const world = new World({ seed: 0xD0A60 });
  const dragon = spawnMonsterEntity(world, params);
  const sleep = world.get(dragon, SleepState);
  assert(sleep?.asleep === true, "dragon should spawn asleep from authored params");
  assertEquals(sleep.wakeRadius, 3);
});
