// src/rules/systems/aiPolicySystem.js
// Neural-network policy override for high-intelligence monsters (intel ≥ 7).
//
// Runs AFTER aiChaseSystem in the 'ai' phase.
//
// Contract:
//   • If the entity already has CastSpellIntent (set by a whileLOS hook), skip it —
//     the hook made a contextual decision and we don't want to second-guess it here.
//   • Otherwise: extract features → forward pass → argmax → applyAction.
//     applyAction can replace MoveIntent with a better direction, add CastSpellIntent,
//     or remove MoveIntent (wait/hold).
//   • Falls back silently if no trained weights exist for this tier (TRAINED_WEIGHTS empty).

import { Faction }       from '../components/Faction.js';
import { Brain }         from '../components/Brain.js';
import { AggroState, AGGRO_LEVELS } from '../components/AggroState.js';
import { NamedIdentity } from '../components/NamedIdentity.js';
import { CastSpellIntent } from '../components/Intents/CastSpellIntent.js';
import { forEachInRadius } from '../utils/spatialIndex.js';
import { playerEntity }    from '../utils/queries.js';
import { canActThisTurn }  from '../utils/speedGate.js';
import { hasLOS }          from '../../shared/math/gridLOS.js';
import { buildBlocksVisionMap, blockedCallback } from '../utils/vision.js';
import { chebyshevScalar } from '../utils/distance.js';
import { getMonster }      from '../data/monsters.js';
import { extractFeatures } from '../ai/policyFeatures.js';
import { forward, argmax, deserializeNet } from '../ai/tinyMLP.js';
import { applyAction }     from '../ai/policyAction.js';
import { getWeightsForIntelligence } from '../data/aiWeights.js';

const POLICY_INTEL_THRESHOLD = 7;
const ACTIVE_RADIUS          = 32;

// Cache deserialised networks keyed by tier string (lives for the page lifetime).
/** @type {Map<string, ReturnType<import('../ai/tinyMLP.js').createMLP>>} */
const NET_CACHE = new Map();

/**
 * @param {number} intel
 * @returns {ReturnType<import('../ai/tinyMLP.js').createMLP> | null}
 */
function getNet(intel) {
  const tier = intel >= 9 ? 'caster' : 'tactical';
  if (NET_CACHE.has(tier)) return NET_CACHE.get(tier);

  const spec = getWeightsForIntelligence(intel);
  if (!spec) return null; // untrained — policy inactive for this tier

  const net = deserializeNet(spec);
  NET_CACHE.set(tier, net);
  return net;
}

/** @param {any} world */
export function aiPolicySystem(world) {
  const _player = playerEntity(world);
  if (!_player) return;

  const playerId  = _player.id;
  const playerPos = _player.pos;

  // LOS blocking map — built once per tick, shared.
  let _isBlocked = null;
  function ensureBlocked() {
    if (!_isBlocked) _isBlocked = blockedCallback(buildBlocksVisionMap(world));
    return _isBlocked;
  }

  forEachInRadius(world, playerPos.x, playerPos.y, ACTIVE_RADIUS, (id, pos) => {
    // Only enemy entities
    const fac = world.get(id, Faction);
    if (!fac || fac.key !== 'enemy') return;

    // Intelligence gate
    const brain = world.get(id, Brain);
    const intel = Number(brain?.intelligence ?? 10);
    if (intel < POLICY_INTEL_THRESHOLD) return;

    // Only act when hunting and it's this monster's turn
    const aggro = world.get(id, AggroState);
    if (!aggro || aggro.alertLevel !== AGGRO_LEVELS.hunting) return;
    if (!canActThisTurn(world, id)) return;

    // If a whileLOS hook already cast a spell this tick, don't interfere
    if (world.has(id, CastSpellIntent)) return;

    // Network must be trained for this tier
    const net = getNet(intel);
    if (!net) return;

    // LOS check (monsters without LOS are handled by aiChaseSystem's search)
    const dist = chebyshevScalar(pos.x | 0, pos.y | 0, playerPos.x | 0, playerPos.y | 0);
    if (dist > (brain?.visionRange ?? 8)) return;
    const canSee = hasLOS(
      pos.x | 0, pos.y | 0,
      playerPos.x | 0, playerPos.y | 0,
      ensureBlocked(),
    );
    if (!canSee) return;

    // Extract features and run policy
    const features = extractFeatures(world, id, pos, playerId, playerPos);
    const probs    = forward(net, features);
    const action   = argmax(probs);

    const learnedSpells = Array.isArray(brain?.learnedSpellIds) ? brain.learnedSpellIds : [];
    applyAction(world, id, playerId, action, learnedSpells);
  });
}
