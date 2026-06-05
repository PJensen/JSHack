import { DungeonState } from '../components/DungeonState.js';
import { DeathApplied } from '../components/DeathApplied.js';
import { Player } from '../components/Player.js';
import { Score } from '../components/Score.js';
import { Vitality } from '../components/Vitality.js';

/**
 * Award the dead entity's maxHp to the player's score,
 * multiplied by the current floor depth.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function scoreSystem(world) {
  for (const [, death] of world.query(DeathApplied)) {
    const id = Number(death.target || 0) | 0;
    const killer = Number(death.killer || 0) | 0;
    // Only score kills made by the player
    if (!killer || !world.has(killer, Player)) continue;
    // Don't score the player's own death
    if (world.has(id, Player)) continue;

    const vit = world.get(id, Vitality);
    if (!vit) continue;

    const score = world.get(killer, Score);
    if (!score) continue;

    let depth = 1;
    for (const [, ds] of world.query(DungeonState)) { depth = ds.currentDepth || 1; break; }

    score.current += vit.maxHp * depth;
  }
}
