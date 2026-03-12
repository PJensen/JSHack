import { DungeonState } from "../components/DungeonState.js";
import { EntranceProfile } from "../components/EntranceProfile.js";
import { EntranceState } from "../components/EntranceState.js";
import { Faction } from "../components/Faction.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Position } from "../components/Position.js";
import { TownState } from "../components/TownState.js";
import { WeatherState } from "../components/WeatherState.js";
import { clamp01, chebyshev, ensureTownInterpretationEntities } from "../utils/townInterpretation.js";

function getDepth(world) {
  for (const [, ds] of world.query(DungeonState)) return ds.currentDepth ?? 1;
  return 1;
}

function getTownState(world) {
  for (const [, state] of world.query(TownState)) return state;
  return null;
}

function getWeather(world) {
  for (const [, weather] of world.query(WeatherState)) return String(weather.current || "clear");
  return "clear";
}

function hostileCountNear(world, x, y, radius) {
  let total = 0;
  for (const [, pos, fac] of world.query(Position, Faction)) {
    const key = String(fac.key || "");
    if (!key || key === "townfolk" || key === "shopkeeper" || key === "neutral" || key === "player" || key === "pet") continue;
    if (chebyshev(pos.x, pos.y, x, y) <= radius) total++;
  }
  return total;
}

function tombstoneCountNear(world, x, y, radius) {
  let total = 0;
  for (const [, pos, ni] of world.query(Position, NamedIdentity)) {
    if (String(ni.identity || "") !== "grave_tombstone") continue;
    if (chebyshev(pos.x, pos.y, x, y) <= radius) total++;
  }
  return total;
}

export function entrancePressureSystem(world) {
  if (getDepth(world) !== 0) return;
  ensureTownInterpretationEntities(world);

  const town = getTownState(world);
  const weather = getWeather(world);

  for (const [id, pos, profile, state] of world.query(Position, EntranceProfile, EntranceState)) {
    const key = String(profile.key || "");
    const hostiles = hostileCountNear(world, pos.x, pos.y, Number(profile.radius || 12));
    const tombstones = tombstoneCountNear(world, pos.x, pos.y, Number(profile.radius || 12));
    const repairBacklog = Number(town?.repairBacklog || 0);
    const threatLevel = Number(town?.threatLevel || 0);
    const weatherPenalty = weather === "heavy_rain" ? 0.22 : weather === "rain" ? 0.1 : 0;

    let pressure = 0;
    let corruption = 0;
    let traffic = 0.3;
    let accessibility = 1;
    let localFear = 0;
    let incidentRate = 0;
    let resourceYield = 0.4;
    let knowledge = 0.5;
    let factionControl = String(state.factionControl || "civic");

    if (key === "graveyard") {
      pressure = 0.25 + hostiles * 0.16 + tombstones * 0.05 + threatLevel * 0.08;
      corruption = 0.25 + tombstones * 0.08 + hostiles * 0.12;
      traffic = 0.18 + tombstones * 0.03;
      accessibility = 0.82 - weatherPenalty * 0.4 - Math.min(0.28, hostiles * 0.04);
      localFear = 0.35 + hostiles * 0.12 + tombstones * 0.04;
      incidentRate = 0.18 + hostiles * 0.14;
      resourceYield = 0.18;
      knowledge = 0.58;
      factionControl = hostiles >= 3 ? "temple_contested" : "temple";
    } else {
      pressure = 0.18 + threatLevel * 0.14 + repairBacklog * 0.05 + hostiles * 0.1 + weatherPenalty * 0.4;
      corruption = 0.08 + hostiles * 0.03 + weatherPenalty * 0.1;
      traffic = 0.52 - weatherPenalty * 0.22 - Math.min(0.2, hostiles * 0.05);
      accessibility = 0.95 - weatherPenalty - Math.min(0.3, repairBacklog * 0.05);
      localFear = 0.18 + threatLevel * 0.12 + repairBacklog * 0.04;
      incidentRate = 0.12 + repairBacklog * 0.06 + hostiles * 0.08;
      resourceYield = 0.46 - weatherPenalty * 0.1;
      knowledge = 0.62;
      factionControl = threatLevel >= 3 ? "civic_strained" : "civic";
    }

    world.set(id, EntranceState, {
      ...state,
      pressure: clamp01(pressure),
      corruption: clamp01(corruption),
      traffic: clamp01(traffic),
      accessibility: clamp01(accessibility),
      localFear: clamp01(localFear),
      incidentRate: clamp01(incidentRate),
      resourceYield: clamp01(resourceYield),
      knowledge: clamp01(knowledge),
      factionControl,
    });
  }
}
