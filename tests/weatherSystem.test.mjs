import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { WeatherState } from "../src/rules/components/WeatherState.js";
import { Position } from "../src/rules/components/Position.js";
import { HazardArea } from "../src/rules/components/HazardArea.js";
import { weatherSystem } from "../src/rules/systems/weatherSystem.js";

function addOverworldState(world) {
  const dungeonId = world.create();
  world.add(dungeonId, DungeonState, {
    worldSeed: world.seed >>> 0,
    currentDepth: 0,
    profileType: "overworld",
    floorEntityIds: [],
    destroyedTiles: {},
  });
}

Deno.test("weatherSystem: rain extinguishes floor fire hazards in overworld", () => {
  const world = new World({ seed: 12345 });
  addOverworldState(world);

  const ws = world.create();
  world.add(ws, WeatherState, {
    current: "rain",
    turnsRemaining: 5,
    transitionCooldown: 10,
  });

  const floorFire = world.create();
  world.add(floorFire, Position, { x: 3, y: 3 });
  world.add(floorFire, HazardArea, {
    kind: "fire",
    medium: "floor",
    turnsLeft: 4,
    radius: 0,
    tickDamage: 1,
    damageType: "fire",
    cause: "test",
    sourceId: 0,
    sourceKind: "",
    meta: null,
  });

  const airFire = world.create();
  world.add(airFire, Position, { x: 4, y: 3 });
  world.add(airFire, HazardArea, {
    kind: "fire",
    medium: "air",
    turnsLeft: 4,
    radius: 1,
    tickDamage: 1,
    damageType: "fire",
    cause: "test",
    sourceId: 0,
    sourceKind: "",
    meta: null,
  });

  const floorPoison = world.create();
  world.add(floorPoison, Position, { x: 5, y: 3 });
  world.add(floorPoison, HazardArea, {
    kind: "poison",
    medium: "floor",
    turnsLeft: 4,
    radius: 1,
    tickDamage: 1,
    damageType: "poison",
    cause: "test",
    sourceId: 0,
    sourceKind: "",
    meta: null,
  });

  const extinguishEvents = [];
  world.on("weather:extinguish", (event) => extinguishEvents.push(event));

  weatherSystem(world);

  assertEquals(world.isAlive(floorFire), false, "rain should destroy floor fire hazards");
  assert(world.isAlive(airFire), "rain should not destroy air fire hazards");
  assert(world.isAlive(floorPoison), "rain should not destroy non-fire floor hazards");

  const hazardEvent = extinguishEvents.find((event) => event.kind === "hazard");
  assert(hazardEvent, "rain should emit weather:extinguish for floor fire hazards");
  assertEquals(hazardEvent.hazardKind, "fire");
  assertEquals(hazardEvent.medium, "floor");
  assertEquals(hazardEvent.count, 1);
});
