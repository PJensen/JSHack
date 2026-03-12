import { DistrictProfile } from "../components/DistrictProfile.js";
import { DistrictState } from "../components/DistrictState.js";
import { EntranceProfile } from "../components/EntranceProfile.js";
import { EntranceState } from "../components/EntranceState.js";
import { Player } from "../components/Player.js";
import { getTownDistrictDef } from "../data/townDistricts.js";
import { getDistrictEntityByKey } from "./townInterpretation.js";

const DEFINED = Symbol.for("jshack:townInterpretationVirtuals:defined");
const ENTRANCE_SUMMARY_KEY = Symbol.for("jshack:townInterpretationVirtuals:EntrancePressureSummary");
const DISTRICT_BULLETIN_KEY = Symbol.for("jshack:townInterpretationVirtuals:DistrictBulletin");
const PLAYER_OPPORTUNITY_KEY = Symbol.for("jshack:townInterpretationVirtuals:PlayerOpportunityView");

function entrancePressureBand(pressure) {
  if (pressure >= 0.95) return "bleeding";
  if (pressure >= 0.7) return "active";
  if (pressure >= 0.4) return "rumbling";
  return "quiet";
}

function dangerTags(profile, state) {
  const out = [];
  if ((state?.dangerBand || "safe") === "dangerous") out.push("night_fear");
  if ((state?.dangerBand || "safe") === "closed") out.push("restricted_access");
  if (String(profile?.key || "") === "churchyard" && Number(state?.graveyardInfluence || 0) >= 0.4) out.push("graveyard_restless");
  if (String(profile?.key || "") === "civic_core" && Number(state?.townInfluence || 0) >= 0.45) out.push("drains_unsteady");
  return out;
}

function shortageTags(profile, state) {
  const out = [];
  const shortageBand = String(state?.shortageBand || "stable");
  if (shortageBand === "scarce" || shortageBand === "panic") {
    if ((profile?.tags || []).includes("craft")) out.push("iron_and_lumber_short");
    if ((profile?.tags || []).includes("market")) out.push("bandages_and_stew_short");
    if ((profile?.tags || []).includes("temple")) out.push("incense_and_bandages_short");
  } else if (shortageBand === "strained") {
    if ((profile?.tags || []).includes("craft")) out.push("repair_queue_growing");
    if ((profile?.tags || []).includes("market")) out.push("market_stalls_thinning");
  }
  return out;
}

function opportunityTags(profile, state) {
  const out = [];
  const tags = profile?.tags || [];
  if (tags.includes("craft") && Number(state?.shortageScore || 0) >= 0.55) out.push("smith_repairs");
  if (tags.includes("market") && Number(state?.dangerScore || 0) >= 0.35) out.push("escort_work");
  if (tags.includes("temple") && Number(state?.graveyardInfluence || 0) >= 0.45) out.push("graveyard_watch");
  if (tags.includes("civic") && Number(state?.townInfluence || 0) >= 0.35) out.push("mason_repairs");
  return out;
}

function rumorTags(profile, state) {
  const out = [];
  if (String(profile?.key || "") === "churchyard" && Number(state?.graveyardInfluence || 0) >= 0.5) {
    out.push("the_old_crypt_is_not_quiet");
  }
  if (String(profile?.key || "") === "market_green" && Number(state?.dangerScore || 0) >= 0.4) {
    out.push("watch_is_pulling_escorts_off_the_roads");
  }
  if (String(profile?.key || "") === "workshop_row" && Number(state?.shortageScore || 0) >= 0.5) {
    out.push("smiths_are_hammering_air");
  }
  return out;
}

export function defineTownInterpretationVirtuals(world) {
  if (world[DEFINED]) return;
  world[DEFINED] = true;

  world[ENTRANCE_SUMMARY_KEY] = world.defineVirtual("EntrancePressureSummary", (world, entranceId) => {
    const profile = world.get(entranceId, EntranceProfile);
    const state = world.get(entranceId, EntranceState);
    if (!profile || !state) return null;
    return Object.freeze({
      entrance: String(profile.key || ""),
      label: String(profile.label || profile.key || "Entrance"),
      pressure: entrancePressureBand(state.pressure),
      pressureValue: Number(state.pressure || 0),
      corruption: Number(state.corruption || 0),
      accessibility: Number(state.accessibility || 0),
      factionControl: String(state.factionControl || ""),
      laborDemand: [...(profile.laborDemand || [])],
      districtEffects: [...(profile.districtEffects || [])],
    });
  });

  world[DISTRICT_BULLETIN_KEY] = world.defineVirtual("DistrictBulletin", (world, districtId) => {
    const profile = world.get(districtId, DistrictProfile);
    const state = world.get(districtId, DistrictState);
    if (!profile || !state) return null;
    return Object.freeze({
      district: String(profile.key || ""),
      label: String(profile.label || profile.key || "District"),
      shortages: shortageTags(profile, state),
      dangers: dangerTags(profile, state),
      opportunities: opportunityTags(profile, state),
      rumors: rumorTags(profile, state),
      shortageBand: String(state.shortageBand || "stable"),
      dangerBand: String(state.dangerBand || "safe"),
      pressureBand: String(state.pressureBand || "quiet"),
      topEntrance: String(state.topEntrance || ""),
    });
  });

  world[PLAYER_OPPORTUNITY_KEY] = world.defineVirtual("PlayerOpportunityView", (world, playerId) => {
    const player = world.get(playerId, Player);
    if (!player) return null;
    const jobs = new Set();
    const leverage = new Set();
    const sectors = new Set();
    for (const [districtId] of world.query(DistrictProfile, DistrictState)) {
      const bulletin = world.vget(districtId, world[DISTRICT_BULLETIN_KEY]);
      if (!bulletin) continue;
      for (const tag of bulletin.opportunities || []) jobs.add(tag);
      if (bulletin.topEntrance === "graveyard") leverage.add("inspect_crypt_stairs");
      if (bulletin.topEntrance === "town") leverage.add("clear_town_drain_access");
      if (bulletin.district === "workshop_row" && bulletin.shortageBand !== "stable") sectors.add("smith_repairs");
      if (bulletin.district === "market_green" && bulletin.dangerBand !== "safe") sectors.add("escort_work");
      if (bulletin.district === "churchyard" && bulletin.pressureBand !== "quiet") sectors.add("incense_trade");
    }
    return Object.freeze({
      availableJobs: Array.from(jobs),
      highLeverageActions: Array.from(leverage),
      profitableSectors: Array.from(sectors),
    });
  });
}

export function getEntrancePressureSummaryVirtual(world) {
  return world?.[ENTRANCE_SUMMARY_KEY] || null;
}

export function getDistrictBulletinVirtual(world) {
  return world?.[DISTRICT_BULLETIN_KEY] || null;
}

export function getPlayerOpportunityViewVirtual(world) {
  return world?.[PLAYER_OPPORTUNITY_KEY] || null;
}

export function getDistrictBulletin(world, key) {
  const districtId = getDistrictEntityByKey(world, key);
  const virtualComp = getDistrictBulletinVirtual(world);
  if (!(districtId > 0) || !virtualComp) return null;
  return world.vget(districtId, virtualComp);
}

export function getDistrictLabel(key) {
  return getTownDistrictDef(key)?.label || key;
}
