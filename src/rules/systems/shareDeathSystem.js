import { Player } from '../components/Player.js';
import { Score } from '../components/Score.js';
import { NamedIdentity } from '../components/NamedIdentity.js';
import { DungeonState } from '../components/DungeonState.js';

/**
 * Build an X/Twitter intent URL for sharing a player death.
 * @param {{ depth: number, score: number, seed: number, killerName?: string|null, cause?: string }} info
 * @returns {string} Twitter intent URL
 */
export function makeDeathShareLink({ depth, score, seed, killerName, cause }) {
  const seedHex = seed ? seed.toString(16).toUpperCase() : '???';
  const slainBy = killerName ? ` by ${killerName}` : cause ? ` (${cause})` : '';
  const text = encodeURIComponent(
    `\u2620\uFE0F I perished at Depth ${depth}${slainBy} with ${score} points! Seed 0x${seedHex} #JS-Hack`
  );
  const base = `${window.location.origin}${window.location.pathname}`;
  const qs = new URLSearchParams({
    d: String(depth),
    s: String(score),
    seed: seedHex,
    ...(killerName ? { k: killerName } : {}),
    ...(cause && cause !== 'unknown' ? { c: cause } : {}),
  });
  const url = encodeURIComponent(`${base}?${qs}`);
  return `https://x.com/intent/tweet?text=${text}&url=${url}`;
}

/**
 * Install a listener on the world 'died' event that dispatches a
 * window custom event so the display layer can show the death screen.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function installDeathShareListener(world) {
  world.on('died', ({ id, killer, cause }) => {
    if (!world.has(id, Player)) return;

    const score = world.get(id, Score);
    let depth = 1;
    let seed = 0;
    for (const [, ds] of world.query(DungeonState)) {
      depth = ds.currentDepth || 1;
      seed = ds.worldSeed || 0;
      break;
    }

    let killerName = null;
    if (killer) {
      const ki = world.get(killer, NamedIdentity);
      if (ki) killerName = ki.name;
    }

    const shareUrl = makeDeathShareLink({
      depth,
      score: score?.current ?? 0,
      seed,
      killerName,
      cause
    });

    window.dispatchEvent(new CustomEvent('ui:playerDied', {
      detail: {
        depth,
        score: score?.current ?? 0,
        seed,
        killerName,
        cause,
        shareUrl
      }
    }));
  });
}
