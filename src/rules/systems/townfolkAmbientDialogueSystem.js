import { Position } from "../components/Position.js";
import { Faction } from "../components/Faction.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { TownfolkJob, TOWNFOLK_STATES } from "../components/TownfolkJob.js";
import { playerEntity } from "../utils/queries.js";
import { currentDepth } from "../utils/worldAccess.js";
import { chebyshevScalar } from "../utils/distance.js";
import { getTownPhase } from "../data/calendar.js";
import { getTownState, getWeather } from "../utils/townStateAccess.js";
import { generateTownfolkAmbientLine } from "../data/townfolkAmbientDialogue.js";
import { createRng } from "../../lib/ecs-js/rng.js";

const STATE_KEY = Symbol.for("jshack:townfolkAmbientDialogue:state");
const PLAYER_HEARING_RADIUS = 9;
const PAIR_RADIUS = 4;
const GLOBAL_COOLDOWN_TURNS = 40;
const ACTOR_COOLDOWN_TURNS = 90;
const PAIR_COOLDOWN_TURNS = 180;

function getState(world) {
  let state = world[STATE_KEY];
  if (!state || typeof state !== "object") {
    state = {
      lastEmitStep: -9999,
      actorLastStep: new Map(),
      pairLastStep: new Map(),
      pairLastTopic: new Map(),
    };
    world[STATE_KEY] = state;
  }
  return state;
}

function ambientSeed(seed, step, candidateCount) {
  const a = Math.imul((Number(step || 0) | 0) >>> 0, 0x9e3779b1) >>> 0;
  const b = Math.imul((Number(candidateCount || 0) | 0) >>> 0, 0x85ebca6b) >>> 0;
  return ((seed >>> 0) ^ a ^ b ^ 0x43484154) >>> 0;
}

function weightedPick(rng, list, weightFn) {
  let total = 0;
  for (const item of list) total += Math.max(0, Number(weightFn(item) || 0));
  if (total <= 0) return null;
  let roll = rng.float() * total;
  for (const item of list) {
    roll -= Math.max(0, Number(weightFn(item) || 0));
    if (roll <= 0) return item;
  }
  return list[list.length - 1] || null;
}

function pairKey(a, b) {
  const lo = Math.min(Number(a || 0) | 0, Number(b || 0) | 0);
  const hi = Math.max(Number(a || 0) | 0, Number(b || 0) | 0);
  return `${lo}:${hi}`;
}

function cadenceFor(phase, actors) {
  const socialCount = actors.filter((actor) => actor.job.state === TOWNFOLK_STATES.socializing).length;
  const workingCount = actors.filter((actor) => actor.job.state === TOWNFOLK_STATES.working).length;
  let cadence = 70 - Math.min(20, actors.length * 4);
  if (socialCount > 0) cadence -= Math.min(10, socialCount * 3);
  if (phase === "pub") cadence -= 10;
  if (phase === "home") cadence -= 4;
  if (workingCount >= 3 && phase === "work") cadence -= 4;
  return Math.max(GLOBAL_COOLDOWN_TURNS, cadence);
}

function roleAffinity(a, b) {
  const key = `${a}:${b}`;
  switch (key) {
    case "barkeep:villager":
    case "villager:barkeep":
    case "barkeep:smith":
    case "smith:barkeep":
    case "priest:villager":
    case "villager:priest":
    case "miner:smith":
    case "smith:miner":
    case "mason:woodcutter":
    case "woodcutter:mason":
    case "herbalist:alchemist":
    case "alchemist:herbalist":
    case "book_vendor:priest":
    case "priest:book_vendor":
    case "gem_vendor:barkeep":
    case "barkeep:gem_vendor":
      return 4;
    default:
      return a === b ? 2 : 0;
  }
}

function isEligibleState(state) {
  return state !== TOWNFOLK_STATES.sleeping
    && state !== TOWNFOLK_STATES.armed
    && state !== TOWNFOLK_STATES.walking;
}

function buildNearbyActors(world, playerPos) {
  const actors = [];
  for (const [id, pos, faction, ident, job] of world.query(Position, Faction, NamedIdentity, TownfolkJob)) {
    if (String(faction?.key || "") !== "townfolk") continue;
    if (!job || !isEligibleState(String(job.state || ""))) continue;
    const distanceToPlayer = chebyshevScalar(playerPos.x, playerPos.y, pos.x, pos.y);
    if (distanceToPlayer > PLAYER_HEARING_RADIUS) continue;
    actors.push({
      id,
      pos,
      ident,
      job,
      distanceToPlayer,
    });
  }
  return actors;
}

function candidateWeight(candidate, phase) {
  let weight = 2;
  weight += Math.max(0, 5 - candidate.distance);
  weight += Math.max(0, 4 - candidate.speaker.distanceToPlayer);
  if (candidate.speaker.job.state === TOWNFOLK_STATES.socializing) weight += 6;
  if (candidate.listener.job.state === TOWNFOLK_STATES.socializing) weight += 5;
  if (candidate.speaker.job.state === TOWNFOLK_STATES.working) weight += 2;
  if (candidate.listener.job.state === TOWNFOLK_STATES.working) weight += 1;
  if (phase === "pub") weight += 3;
  if (phase === "work") weight += 1;
  weight += roleAffinity(candidate.speaker.job.role, candidate.listener.job.role);
  return weight;
}

export function townfolkAmbientDialogueSystem(world) {
  if (currentDepth(world, -1) !== 0) return;

  const phase = getTownPhase(world.step);
  if (phase === "sleep") return;

  const player = playerEntity(world);
  if (!player?.pos) return;

  const actors = buildNearbyActors(world, player.pos);
  if (actors.length < 2) return;

  const cadence = cadenceFor(phase, actors);
  if (((Number(world.step || 0) | 0) % cadence) !== 0) return;

  const state = getState(world);
  const currentStep = Number(world.step || 0) | 0;
  if ((currentStep - Number(state.lastEmitStep || 0)) < GLOBAL_COOLDOWN_TURNS) return;

  const candidates = [];
  for (const speaker of actors) {
    const actorLastStep = Number(state.actorLastStep.get(speaker.id) || -9999);
    if ((currentStep - actorLastStep) < ACTOR_COOLDOWN_TURNS) continue;
    for (const listener of actors) {
      if (listener.id === speaker.id) continue;
      const distance = chebyshevScalar(speaker.pos.x, speaker.pos.y, listener.pos.x, listener.pos.y);
      if (distance > PAIR_RADIUS) continue;
      const key = pairKey(speaker.id, listener.id);
      const pairLastStep = Number(state.pairLastStep.get(key) || -9999);
      if ((currentStep - pairLastStep) < PAIR_COOLDOWN_TURNS) continue;
      candidates.push({
        key,
        distance,
        speaker,
        listener,
      });
    }
  }
  if (candidates.length === 0) return;

  const rng = createRng(ambientSeed(world.seed >>> 0, currentStep, candidates.length));
  const chosen = weightedPick(rng, candidates, (candidate) => candidateWeight(candidate, phase));
  if (!chosen) return;

  const previousTopic = String(state.pairLastTopic.get(chosen.key) || "");
  const line = generateTownfolkAmbientLine({
    seed: world.seed >>> 0,
    speakerId: chosen.speaker.id,
    listenerId: chosen.listener.id,
    speakerName: chosen.speaker.ident?.name || "",
    listenerName: chosen.listener.ident?.name || "",
    speakerRole: String(chosen.speaker.job.role || "villager"),
    listenerRole: String(chosen.listener.job.role || "villager"),
    phase,
    weather: getWeather(world),
    townState: getTownState(world),
    step: currentStep,
    previousTopic,
  });
  const text = String(line?.text || "").trim();
  if (!text) return;

  state.lastEmitStep = currentStep;
  state.actorLastStep.set(chosen.speaker.id, currentStep);
  state.pairLastStep.set(chosen.key, currentStep);
  state.pairLastTopic.set(chosen.key, String(line?.topic || ""));

  world.emit?.("npc:dialogue", {
    actor: chosen.speaker.id,
    targetId: chosen.listener.id,
    text,
    source: "townfolk:ambient",
    topic: String(line?.topic || ""),
    phase,
    weather: getWeather(world),
  });
}
