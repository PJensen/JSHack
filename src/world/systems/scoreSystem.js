/**
 * Generates a Twitter share link for a given Score component object.
 * @param {Object} score - The Score object containing current, best, lastDeathDepth, runs, and seed.
 * @param {number} score.current - The current score points.
 * @param {number} score.best - The best score achieved.
 * @param {number} score.lastDeathDepth - The depth reached at last death.
 * @param {number} score.runs - The number of runs.
 * @param {number} score.seed - The game seed (number).
 * @returns {string} - A Twitter intent URL for sharing the score.
 */
export function makeShareLinkSystem(score) {
  const text = encodeURIComponent(
    `☠️ I perished at Depth ${score.lastDeathDepth} with ${score.current} points! Seed ${score.seed ? score.seed.toString(16).toUpperCase() : ''} (RNG 0x${score.rng ? score.rng.toString(16).toUpperCase() : 'UNKNOWN'}) #JS-Hack`
  );
  const url = encodeURIComponent(location.href.split('#')[0]);
  return `https://x.com/intent/tweet?text=${text}&url=${url}`;
}
// scoreSystem.js
// System for handling score updates on events
import { Score } from '../components/Score.js';
import { PlayerTag } from '../components/PlayerTag.js';

/**
 * Score system: listens for kill events and updates player score.
 * @param {object} world - The ECS world instance.
 */
export function scoreSystem(world) {
  // Standard: use world.get(eid, Component) for component access
  world.on('onKill', ({ killer, victim }) => {
    if (world.has(killer, PlayerTag)) {
      const s = world.get(killer, Score);
      if (s) s.current += victim.xpValue ?? 10;
    }
  });
}
