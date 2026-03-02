import { DungeonState } from '../components/DungeonState.js';
import { Player } from '../components/Player.js';
import { Score } from '../components/Score.js';
import { Vitality } from '../components/Vitality.js';

const INSTALLED_KEY = Symbol.for('jshack:score:kill:installed');

/**
 * Listen for 'died' events and award the dead entity's maxHp to the player's score,
 * multiplied by the current floor depth.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function installScoreListener(world) {
  if (!world || world[INSTALLED_KEY]) return;
  world[INSTALLED_KEY] = true;

  world.on('died', ({ id, killer }) => {
    // Only score kills made by the player
    if (!killer || !world.has(killer, Player)) return;
    // Don't score the player's own death
    if (world.has(id, Player)) return;

    const vit = world.get(id, Vitality);
    if (!vit) return;

    const score = world.get(killer, Score);
    if (!score) return;

    let depth = 1;
    for (const [, ds] of world.query(DungeonState)) { depth = ds.currentDepth || 1; break; }

    score.current += vit.maxHp * depth;
  });
}
