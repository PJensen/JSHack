import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { Faction } from "../src/rules/components/Faction.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Position } from "../src/rules/components/Position.js";
import { TownState } from "../src/rules/components/TownState.js";
import { WeatherState } from "../src/rules/components/WeatherState.js";
import { DistrictState } from "../src/rules/components/DistrictState.js";
import { entrancePressureSystem } from "../src/rules/systems/entrancePressureSystem.js";
import { districtConditionSystem } from "../src/rules/systems/districtConditionSystem.js";
import { getDistrictEntityByKey } from "../src/rules/utils/townInterpretation.js";
import { defineTownInterpretationVirtuals, getDistrictBulletin } from "../src/rules/utils/townInterpretationVirtuals.js";
import { installVirtuals } from "../src/rules/utils/inventoryVirtuals.js";

function addAnchor(world, identity, x, y, name = identity) {
  const id = world.create();
  world.add(id, NamedIdentity, { name, identity });
  world.add(id, Position, { x, y });
  return id;
}

function buildTownWorld() {
  const world = new World({ seed: 0x5157 });
  installVirtuals(world);
  defineTownInterpretationVirtuals(world);

  const dungeon = world.create();
  world.add(dungeon, DungeonState, {
    worldSeed: 0x5157,
    currentDepth: 0,
    profileType: "overworld",
    floorEntityIds: [],
    downStairPositions: [],
    destroyedTiles: {},
  });

  const town = world.create();
  world.add(town, TownState, {
    foodStores: 5,
    materialStores: 2,
    medicineStores: 1,
    repairBacklog: 5,
    threatLevel: 3,
    morale: 42,
    weather: "heavy_rain",
    lowFood: false,
    lowMaterials: true,
    lowMedicine: true,
    nextPulseStep: 0,
    lastPulseStep: -1,
  });

  const weather = world.create();
  world.add(weather, WeatherState, { current: "heavy_rain", turnsRemaining: 10, transitionCooldown: 0 });

  addAnchor(world, "house_sign", 10, 10, "House");
  addAnchor(world, "church_sign", 18, 6, "Church");
  addAnchor(world, "smithy_sign", 15, 12, "Smithy");
  addAnchor(world, "tavern_sign", 9, 14, "Tavern");
  addAnchor(world, "stair_down", 11, 9, "Town Stair");
  addAnchor(world, "stair_down", 18, 2, "Crypt Stair");

  for (const [x, y] of [[18, 4], [19, 5], [17, 4]]) {
    addAnchor(world, "grave_tombstone", x, y, "Tombstone");
  }
  for (const [x, y] of [[18, 3], [17, 3], [19, 4]]) {
    const enemy = world.create();
    world.add(enemy, Position, { x, y });
    world.add(enemy, Faction, { key: "enemy" });
  }

  return world;
}

function townStateEntityId(world) {
  for (const [id] of world.query(TownState)) return id;
  return 0;
}

Deno.test("town interpretation systems derive bulletins from entrance pressure and town state", () => {
  const world = buildTownWorld();

  entrancePressureSystem(world);
  districtConditionSystem(world);

  const churchyardId = getDistrictEntityByKey(world, "churchyard");
  const workshopId = getDistrictEntityByKey(world, "workshop_row");

  assert(churchyardId > 0, "churchyard district should be created");
  assert(workshopId > 0, "workshop district should be created");

  const churchyardState = world.get(churchyardId, DistrictState);
  const workshopState = world.get(workshopId, DistrictState);
  const churchyardBulletin = getDistrictBulletin(world, "churchyard");
  const workshopBulletin = getDistrictBulletin(world, "workshop_row");

  assertEquals(churchyardState.topEntrance, "graveyard");
  assert(churchyardState.dangerBand === "dangerous" || churchyardState.dangerBand === "closed");
  assert(churchyardBulletin.opportunities.includes("graveyard_watch"));

  assertEquals(workshopState.topEntrance, "town");
  assert(workshopState.shortageBand === "scarce" || workshopState.shortageBand === "panic");
  assert(workshopBulletin.opportunities.includes("smith_repairs"));
});

Deno.test("district condition hysteresis prevents workshop shortages from flapping on small improvements", () => {
  const world = buildTownWorld();

  entrancePressureSystem(world);
  districtConditionSystem(world);

  let workshopId = getDistrictEntityByKey(world, "workshop_row");
  assertEquals(world.get(workshopId, DistrictState).shortageBand, "scarce");

  const townId = townStateEntityId(world);
  world.set(townId, TownState, {
    ...world.get(townId, TownState),
    repairBacklog: 2,
    lowMaterials: true,
  });
  districtConditionSystem(world);
  workshopId = getDistrictEntityByKey(world, "workshop_row");
  assertEquals(world.get(workshopId, DistrictState).shortageBand, "scarce");

  world.set(townId, TownState, {
    ...world.get(townId, TownState),
    repairBacklog: 1,
    lowMaterials: true,
  });
  districtConditionSystem(world);
  assertEquals(world.get(workshopId, DistrictState).shortageBand, "strained");
});
