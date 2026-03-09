import { DungeonState } from "../components/DungeonState.js";
import { Faction } from "../components/Faction.js";
import { Position } from "../components/Position.js";
import { TownState } from "../components/TownState.js";
import { WeatherState } from "../components/WeatherState.js";
import { Unpaid } from "../components/Unpaid.js";
import { getDestroyedTileLedger } from "../utils/destroyedTiles.js";
import {
  consumeInventoryIdentity,
  countInventoryByIdentity,
  createInventoryItem,
  findTownAnchor,
  findTownContainers,
} from "../utils/townEconomy.js";

const PULSE_BASE = 12;
const LOW_FOOD_THRESHOLD = 4;
const LOW_MATERIAL_THRESHOLD = 3;
const LOW_MEDICINE_THRESHOLD = 3;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function getDepth(world) {
  for (const [, ds] of world.query(DungeonState)) return ds.currentDepth ?? 1;
  return 1;
}

function getWeather(world) {
  for (const [, ws] of world.query(WeatherState)) return String(ws.current || "clear");
  return "clear";
}

function ensureTownState(world) {
  for (const [id, st] of world.query(TownState)) return [id, st];
  const id = world.create();
  const step = Math.max(0, world.step | 0);
  world.add(id, TownState, { nextPulseStep: step + PULSE_BASE });
  return [id, world.get(id, TownState)];
}

function hostileThreatNearTown(world, anchor) {
  let threat = 0;
  for (const [, pos, fac] of world.query(Position, Faction)) {
    const key = String(fac.key || "");
    if (!key || key === "townfolk" || key === "shopkeeper" || key === "neutral" || key === "player") continue;
    const dist = Math.max(Math.abs(pos.x - anchor.x), Math.abs(pos.y - anchor.y));
    if (dist <= 18) threat++;
  }
  return threat;
}

function countShopStock(world, shopkeeperId) {
  let total = 0;
  if (!(shopkeeperId > 0)) return 0;
  for (const [, unpaid] of world.query(Unpaid)) {
    if (Number(unpaid.shopkeeperId || 0) === shopkeeperId) total++;
  }
  return total;
}

function totalToolCount(world, storage, identity) {
  let total = 0;
  for (const ownerId of [storage.smithy, storage.tavern]) {
    if (ownerId > 0) total += Number(countInventoryByIdentity(world, ownerId)[identity] || 0);
  }
  return total;
}

function chooseForgeOutput(world, storage) {
  const smith = storage.smithy > 0 ? countInventoryByIdentity(world, storage.smithy) : {};
  if ((smith.material_lumber || 0) < 1) return null;

  if (totalToolCount(world, storage, "tool_kitchen_knife") < 1 && (smith.material_iron || 0) >= 1) {
    return { itemId: "tool_kitchen_knife", iron: 1, coal: 1, lumber: 1 };
  }
  if (totalToolCount(world, storage, "tool_hatchet") < 1 && (smith.material_iron || 0) >= 1) {
    return { itemId: "tool_hatchet", iron: 1, coal: 1, lumber: 1 };
  }
  if (totalToolCount(world, storage, "iron_pickaxe") < 2 && (smith.material_iron || 0) >= 2) {
    return { itemId: "iron_pickaxe", iron: 2, coal: 1, lumber: 1 };
  }
  return null;
}

function pulseIndustry(world, state, storage, weather) {
  const step = Math.max(0, world.step | 0);
  if (step < (state.nextPulseStep | 0)) return;

  let produced = false;
  const pulseDelay = weather === "heavy_rain" ? PULSE_BASE + 8 : weather === "rain" ? PULSE_BASE + 4 : PULSE_BASE;

  if (storage.mill > 0) {
    const mill = countInventoryByIdentity(world, storage.mill);
    if ((mill.food_wheat || 0) >= 1) {
      consumeInventoryIdentity(world, storage.mill, "food_wheat", 1);
      createInventoryItem(world, storage.mill, "food_flour");
      produced = true;
      world.emit?.("town:produced", { chain: "mill", itemId: "food_flour" });
    }
  }

  if (storage.smithy > 0) {
    const smith = countInventoryByIdentity(world, storage.smithy);
    if ((smith.ore_iron || 0) >= 1 && (smith.ore_coal || 0) >= 1) {
      consumeInventoryIdentity(world, storage.smithy, "ore_iron", 1);
      consumeInventoryIdentity(world, storage.smithy, "ore_coal", 1);
      createInventoryItem(world, storage.smithy, "material_iron");
      produced = true;
      world.emit?.("town:produced", { chain: "furnace", itemId: "material_iron" });
    }
    const craft = chooseForgeOutput(world, storage);
    if (craft) {
      consumeInventoryIdentity(world, storage.smithy, "material_iron", craft.iron);
      consumeInventoryIdentity(world, storage.smithy, "material_lumber", craft.lumber);
      createInventoryItem(world, storage.smithy, craft.itemId);
      produced = true;
      world.emit?.("town:produced", { chain: "smithy", itemId: craft.itemId });
    }
  }

  if (storage.tavern > 0) {
    const tavern = countInventoryByIdentity(world, storage.tavern);
    if ((tavern.food_flour || 0) >= 1 && (tavern.water_bucket || 0) >= 1 && (tavern.fuel_firewood || 0) >= 1 && (tavern.tool_kitchen_knife || 0) >= 1) {
      consumeInventoryIdentity(world, storage.tavern, "food_flour", 1);
      consumeInventoryIdentity(world, storage.tavern, "fuel_firewood", 1);
      createInventoryItem(world, storage.tavern, "food_stew");
      produced = true;
      world.emit?.("town:produced", { chain: "tavern", itemId: "food_stew" });
    }
    const preparedMeals = Number(tavern.food_stew || 0) + Number(tavern.food_ration || 0);
    if ((tavern.food_stew || 0) >= 1 && preparedMeals > 1) {
      consumeInventoryIdentity(world, storage.tavern, "food_stew", 1);
      produced = true;
      world.emit?.("town:fed", { itemId: "food_stew" });
    } else if ((tavern.food_ration || 0) >= 1 && preparedMeals > 1) {
      consumeInventoryIdentity(world, storage.tavern, "food_ration", 1);
      produced = true;
      world.emit?.("town:fed", { itemId: "food_ration" });
    }
  }

  state.lastPulseStep = step;
  state.nextPulseStep = step + pulseDelay + (produced ? 0 : 4);
}

export function townSimulationSystem(world) {
  if (getDepth(world) !== 0) return;

  const [stateId, state] = ensureTownState(world);
  const weather = getWeather(world);
  const storage = findTownContainers(world);
  const anchor = findTownAnchor(world);

  pulseIndustry(world, state, storage, weather);

  const mill = countInventoryByIdentity(world, storage.mill);
  const smith = countInventoryByIdentity(world, storage.smithy);
  const lumber = countInventoryByIdentity(world, storage.lumber);
  const herb = countInventoryByIdentity(world, storage.herb);
  const tavern = countInventoryByIdentity(world, storage.tavern);
  const shopStock = countShopStock(world, storage.alchemist);
  const repairBacklog = Object.keys(getDestroyedTileLedger(world)).length;
  const threatLevel = hostileThreatNearTown(world, anchor);

  const foodStores = (mill.food_wheat || 0)
    + (mill.food_flour || 0)
    + (tavern.food_flour || 0)
    + (tavern.food_stew || 0)
    + (tavern.food_ration || 0);
  const materialStores = (smith.ore_iron || 0)
    + (smith.ore_coal || 0)
    + (smith.material_iron || 0)
    + (smith.material_lumber || 0)
    + (smith.iron_pickaxe || 0)
    + (smith.tool_hatchet || 0)
    + (smith.tool_kitchen_knife || 0)
    + (lumber.material_lumber || 0)
    + (lumber.fuel_firewood || 0);
  const medicineStores = (herb.food_wild_herbs || 0) + (herb.reagent_thorn_pod || 0) + (herb.reagent_venom_frond || 0) + shopStock;
  const lowFood = foodStores < LOW_FOOD_THRESHOLD;
  const lowMaterials = materialStores < LOW_MATERIAL_THRESHOLD;
  const lowMedicine = medicineStores < LOW_MEDICINE_THRESHOLD;

  const morale = clamp(
    62
      + Math.min(12, foodStores * 2)
      + Math.min(10, medicineStores * 2)
      - repairBacklog * 5
      - threatLevel * 8
      - (weather === "heavy_rain" ? 10 : weather === "rain" ? 4 : 0)
      - (lowFood ? 12 : 0)
      - (lowMaterials ? 6 : 0)
      - (lowMedicine ? 8 : 0),
    0,
    100,
  );

  const prevThreat = Number(state.threatLevel || 0);
  const prevWeather = String(state.weather || "clear");
  const shortagesChanged =
    !!state.lowFood !== lowFood
    || !!state.lowMaterials !== lowMaterials
    || !!state.lowMedicine !== lowMedicine;

  world.set(stateId, TownState, {
    ...state,
    foodStores,
    materialStores,
    medicineStores,
    repairBacklog,
    threatLevel,
    morale,
    weather,
    lowFood,
    lowMaterials,
    lowMedicine,
  });

  if (shortagesChanged) {
    world.emit?.("town:shortage", {
      food: lowFood,
      materials: lowMaterials,
      medicine: lowMedicine,
    });
  }
  if (threatLevel > prevThreat) world.emit?.("town:threatened", { threatLevel });
  if (weather !== prevWeather) world.emit?.("town:weather", { weather, prev: prevWeather });
}
