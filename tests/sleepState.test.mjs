import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { buildWorldView } from "../src/bridge/schema/worldView.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { BaseStats } from "../src/rules/components/BaseStats.js";
import { Facing } from "../src/rules/components/Facing.js";
import { Flying } from "../src/rules/components/Flying.js";
import { SleepState } from "../src/rules/components/SleepState.js";
import { AggroState, AGGRO_LEVELS } from "../src/rules/components/AggroState.js";
import { MoveIntent } from "../src/rules/components/Intents/MoveIntent.js";
import { FlyIntent } from "../src/rules/components/Intents/FlyIntent.js";
import { AttackIntent } from "../src/rules/components/Intents/AttackIntent.js";
import { SearchIntent } from "../src/rules/components/Intents/SearchIntent.js";
import { intentValidationSystem } from "../src/rules/systems/intentValidationSystem.js";
import { movementSystem } from "../src/rules/systems/movementSystem.js";
import { flyIntentSystem } from "../src/rules/systems/flyIntentSystem.js";
import { clearAll, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";
import { clearExplored } from "../src/rules/environment/dungeon/exploredMap.js";
import { clearPerceptionMemory } from "../src/rules/environment/dungeon/perceptionMemory.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";
import { dealDamage } from "../src/rules/utils/dealDamage.js";
import { isAsleep, putActorToSleep, SLEEP_DISPLAY_TAG, tryWakeActor } from "../src/rules/utils/sleep.js";
import { sleepDamageReactionSystem } from "../src/rules/systems/damageReactions/sleepDamageReactionSystem.js";
import { getMonster } from "../src/rules/data/monsters.js";
import { listSleepProfileIds, resolveSleepProfile } from "../src/rules/data/sleepProfiles.js";
import { toMonsterSpawnParams } from "../src/rules/utils/monsterSpawnParams.js";
import { spawnMonsterEntity } from "../src/rules/utils/spawnMonsterEntity.js";
import { sleepScheduleSystem } from "../src/rules/systems/sleepScheduleSystem.js";
import "../src/content/monsters/index.js";

const SIX_AM = 180;
const NINE_PM = 630;

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

Deno.test("putActorToSleep emits only on awake to asleep transition", () => {
  const world = new World({ seed: 0x51EED });
  const actor = makeActor(world);
  const events = [];
  world.on("sleep:slept", (ev) => events.push(ev));

  assertEquals(putActorToSleep(world, actor, { reason: "test", wakeDifficulty: 12 }), true);
  assertEquals(isAsleep(world, actor), true);
  assertEquals(events.length, 1);
  assertEquals(events[0].reason, "test");

  assertEquals(putActorToSleep(world, actor, { reason: "test_again", wakeDifficulty: 4 }), false);
  assertEquals(events.length, 1);
  assertEquals(world.get(actor, SleepState)?.wakeDifficulty, 4);
});

Deno.test("movementSystem rejects sleepers even when validation is bypassed", () => {
  resetFloor();
  const world = new World({ seed: 0x510 });
  const actor = makeActor(world, 5, 5);
  putActorToSleep(world, actor, { suppressEvent: true });
  world.add(actor, MoveIntent, { dx: 1, dy: 0 });

  movementSystem(world);

  assertEquals(world.get(actor, Position)?.x, 5);
  assertEquals(world.get(actor, Position)?.y, 5);
  assertEquals(world.has(actor, MoveIntent), false);
});

Deno.test("flyIntentSystem rejects sleepers even when validation is bypassed", () => {
  const world = new World({ seed: 0xF17 });
  const actor = makeActor(world, 5, 5);
  putActorToSleep(world, actor, { suppressEvent: true });
  world.add(actor, FlyIntent, { airborne: true });

  flyIntentSystem(world);

  assertEquals(world.has(actor, FlyIntent), false);
  assertEquals(world.has(actor, Flying), false);
});

Deno.test("damage wakes a sleeping actor through canonical listener", () => {
  const world = new World({ seed: 0xDA6A9E });

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
  sleepDamageReactionSystem(world);

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
  assert(rec.tags.includes(SLEEP_DISPLAY_TAG), "asleep entity should carry sleeping tag");

  world.set(sleeper, SleepState, { asleep: false, wakeDifficulty: 8, wakeRadius: 2, wakeOnDamage: true });
  view = buildWorldView(world);
  rec = view.entities.find((e) => e.id === sleeper);
  assert(rec, "awake entity should still be projected");
  assert(!rec.tags.includes(SLEEP_DISPLAY_TAG), "awake entity should not carry sleeping tag");
});

Deno.test("sleep profiles expose activity-pattern vocabulary", () => {
  const ids = listSleepProfileIds();
  for (const id of ["diurnal", "nocturnal", "crepuscular", "cathemeral", "dormant", "ancient", "nocturnal_roost"]) {
    assert(ids.includes(id), `expected sleep profile ${id}`);
  }

  const roost = resolveSleepProfile({ pattern: "nocturnal", context: "roost", chance: 0.25 });
  assertEquals(roost?.chance, 0.25);
  assertEquals(roost?.wakeDifficulty, 5);
  assertEquals(roost?.wakeRadius, 2);
});

Deno.test("authored bat sleep chance attaches SleepState deterministically", () => {
  const def = getMonster("bat");
  assert(def?.sleep, "bat should author sleep behavior");
  assertEquals(def.sleep.pattern, "nocturnal");
  assertEquals(def.sleep.context, "roost");

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

Deno.test("cave bear den sleep follows time of day at spawn", () => {
  const def = getMonster("cave_bear");
  assertEquals(def?.sleep?.pattern, "diurnal");
  assertEquals(def?.sleep?.context, "den");

  const dayWorld = new World({ seed: 0xBEA6 });
  dayWorld.step = SIX_AM;
  const dayBear = spawnMonsterEntity(dayWorld, { identity: "cave_bear" });
  assert(!isAsleep(dayWorld, dayBear), "cave bear should spawn awake during active daytime phase");

  const nightWorld = new World({ seed: 0xBEA7 });
  nightWorld.step = NINE_PM;
  const nightBear = spawnMonsterEntity(nightWorld, { identity: "cave_bear" });
  assert(isAsleep(nightWorld, nightBear), "cave bear should spawn asleep during night rest phase");
});

Deno.test("sleep schedule wakes cave bear at dawn", () => {
  const world = new World({ seed: 0xDA9 });
  world.step = SIX_AM;
  const bear = spawnMonsterEntity(world, { identity: "cave_bear", sleep: false });
  world.add(bear, SleepState, { asleep: true, wakeDifficulty: 8, wakeRadius: 2, wakeOnDamage: true });

  let woke = null;
  world.on("sleep:woke", (ev) => { woke = ev; });
  sleepScheduleSystem(world);

  assert(!isAsleep(world, bear), "dawn should wake sleeping cave bear");
  assertEquals(woke?.reason, "scheduled_wake");
});

Deno.test("sleep schedule does not put aggroed cave bear to sleep at night", () => {
  const world = new World({ seed: 0xF19A7 });
  world.step = NINE_PM;
  const bear = spawnMonsterEntity(world, { identity: "cave_bear", sleep: false });
  world.set(bear, AggroState, {
    alertLevel: AGGRO_LEVELS.hunting,
    lastKnownX: 5,
    lastKnownY: 5,
    searchTurnsLeft: 10,
  });

  sleepScheduleSystem(world);

  assert(!isAsleep(world, bear), "aggroed cave bear should not fall asleep when night starts");
});

Deno.test("sleep schedule can put unaware cave bear to sleep at night", () => {
  const world = new World({ seed: 0xBED });
  world.step = NINE_PM;
  const bear = spawnMonsterEntity(world, { identity: "cave_bear", sleep: false });
  world.set(bear, AggroState, { alertLevel: AGGRO_LEVELS.unaware });

  let slept = null;
  world.on("sleep:slept", (ev) => { slept = ev; });
  sleepScheduleSystem(world);

  assert(isAsleep(world, bear), "unaware cave bear should fall asleep during night rest phase");
  assertEquals(slept?.actor, bear);
  assertEquals(slept?.reason, "scheduled_rest");
});
