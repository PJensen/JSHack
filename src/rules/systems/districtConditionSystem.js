import { DistrictProfile } from "../components/DistrictProfile.js";
import { DistrictState } from "../components/DistrictState.js";
import { DungeonState } from "../components/DungeonState.js";
import { EntranceProfile } from "../components/EntranceProfile.js";
import { EntranceState } from "../components/EntranceState.js";
import { Position } from "../components/Position.js";
import { TownState } from "../components/TownState.js";
import { clamp01, chebyshev, ensureTownInterpretationEntities } from "../utils/townInterpretation.js";

const SHORTAGE_ORDER = Object.freeze(["stable", "tight", "strained", "scarce", "panic"]);
const DANGER_ORDER = Object.freeze(["safe", "uneasy", "dangerous", "closed"]);
const PRESSURE_ORDER = Object.freeze(["quiet", "rumbling", "active", "bleeding"]);

function getDepth(world) {
  for (const [, ds] of world.query(DungeonState)) return ds.currentDepth ?? 1;
  return 1;
}

function getTownState(world) {
  for (const [, state] of world.query(TownState)) return state;
  return null;
}

function pickBand(prev, value, bands) {
  const current = bands.find((band) => band.name === prev) || bands[0];
  if (value >= current.exitUp) {
    for (let i = bands.length - 1; i >= 0; i--) {
      if (value >= bands[i].enter) return bands[i].name;
    }
  }
  if (value < current.exitDown) {
    for (let i = 0; i < bands.length; i++) {
      if (value < bands[i].enter) return bands[Math.max(0, i - 1)].name;
    }
    return bands[0].name;
  }
  return current.name;
}

const SHORTAGE_BANDS = Object.freeze([
  Object.freeze({ name: "stable", enter: 0.0, exitDown: -1, exitUp: 0.4 }),
  Object.freeze({ name: "tight", enter: 0.4, exitDown: 0.25, exitUp: 0.62 }),
  Object.freeze({ name: "strained", enter: 0.62, exitDown: 0.48, exitUp: 0.84 }),
  Object.freeze({ name: "scarce", enter: 0.84, exitDown: 0.7, exitUp: 1.08 }),
  Object.freeze({ name: "panic", enter: 1.08, exitDown: 0.92, exitUp: 999 }),
]);

const DANGER_BANDS = Object.freeze([
  Object.freeze({ name: "safe", enter: 0.0, exitDown: -1, exitUp: 0.3 }),
  Object.freeze({ name: "uneasy", enter: 0.3, exitDown: 0.18, exitUp: 0.58 }),
  Object.freeze({ name: "dangerous", enter: 0.58, exitDown: 0.42, exitUp: 0.88 }),
  Object.freeze({ name: "closed", enter: 0.88, exitDown: 0.72, exitUp: 999 }),
]);

const PRESSURE_BANDS = Object.freeze([
  Object.freeze({ name: "quiet", enter: 0.0, exitDown: -1, exitUp: 0.28 }),
  Object.freeze({ name: "rumbling", enter: 0.28, exitDown: 0.16, exitUp: 0.55 }),
  Object.freeze({ name: "active", enter: 0.55, exitDown: 0.4, exitUp: 0.86 }),
  Object.freeze({ name: "bleeding", enter: 0.86, exitDown: 0.7, exitUp: 999 }),
]);

function influenceFor(districtPos, districtRadius, entrancePos, entranceState, entranceProfile) {
  const reach = Math.max(Number(districtRadius || 0), Number(entranceProfile?.radius || 0), 1);
  const dist = chebyshev(districtPos.x, districtPos.y, entrancePos.x, entrancePos.y);
  const falloff = clamp01(1 - (dist / reach));
  return falloff * Number(entranceState?.pressure || 0);
}

export function districtConditionSystem(world) {
  if (getDepth(world) !== 0) return;
  ensureTownInterpretationEntities(world);

  const town = getTownState(world);
  const entrances = [];
  for (const [id, pos, profile, state] of world.query(Position, EntranceProfile, EntranceState)) {
    entrances.push({ id, pos, profile, state });
  }

  for (const [id, pos, profile, state] of world.query(Position, DistrictProfile, DistrictState)) {
    let townInfluence = 0;
    let graveyardInfluence = 0;
    let topEntrance = "";
    let topInfluence = -1;

    for (const entry of entrances) {
      const influence = influenceFor(pos, profile.radius, entry.pos, entry.state, entry.profile);
      if (String(entry.profile.key || "") === "graveyard") graveyardInfluence = influence;
      if (String(entry.profile.key || "") === "town") townInfluence = influence;
      if (influence > topInfluence) {
        topInfluence = influence;
        topEntrance = String(entry.profile.key || "");
      }
    }

    const tags = new Set(profile.tags || []);
    let shortageScore = 0.1;
    if (town?.lowFood && (tags.has("market") || tags.has("civic"))) shortageScore += 0.42;
    if (town?.lowMaterials && (tags.has("craft") || tags.has("repair"))) shortageScore += 0.48;
    if (town?.lowMedicine && (tags.has("temple") || tags.has("market"))) shortageScore += 0.4;
    shortageScore += Number(town?.repairBacklog || 0) * (tags.has("repair") ? 0.08 : 0.03);

    let dangerScore = 0.08 + townInfluence * 0.85 + graveyardInfluence * 0.95 + Number(town?.threatLevel || 0) * 0.06;
    if (tags.has("temple")) dangerScore += graveyardInfluence * 0.2;
    if (tags.has("civic")) dangerScore += townInfluence * 0.12;

    let pressureScore = 0.12 + Math.max(townInfluence, graveyardInfluence) + (shortageScore * 0.14);
    if (tags.has("rumor")) pressureScore += 0.08;
    if (tags.has("craft")) pressureScore += Number(town?.repairBacklog || 0) * 0.03;

    shortageScore = clamp01(shortageScore);
    dangerScore = clamp01(dangerScore);
    pressureScore = clamp01(pressureScore);

    const prevShortage = String(state.shortageBand || state.lastShortageBand || "stable");
    const prevDanger = String(state.dangerBand || state.lastDangerBand || "safe");
    const prevPressure = String(state.pressureBand || state.lastPressureBand || "quiet");

    const shortageBand = pickBand(prevShortage, shortageScore, SHORTAGE_BANDS);
    const dangerBand = pickBand(prevDanger, dangerScore, DANGER_BANDS);
    const pressureBand = pickBand(prevPressure, pressureScore, PRESSURE_BANDS);

    world.set(id, DistrictState, {
      ...state,
      topEntrance,
      townInfluence,
      graveyardInfluence,
      shortageScore,
      dangerScore,
      pressureScore,
      shortageBand,
      dangerBand,
      pressureBand,
      lastShortageBand: shortageBand,
      lastDangerBand: dangerBand,
      lastPressureBand: pressureBand,
    });

    if (shortageBand !== prevShortage || dangerBand !== prevDanger || pressureBand !== prevPressure) {
      world.emit?.("town:districtChanged", {
        district: String(profile.key || ""),
        shortageBand,
        dangerBand,
        pressureBand,
        topEntrance,
      });
    }
  }
}
