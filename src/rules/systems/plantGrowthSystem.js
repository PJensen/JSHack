import { GrowthStage } from "../components/GrowthStage.js";
import { HarvestNode } from "../components/HarvestNode.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { DungeonState } from "../components/DungeonState.js";

/**
 * Advance plant growth stages on the overworld (depth 0).
 *
 * Two modes:
 *   1. Crop mode (growInterval === 0): stage derived from HarvestNode regrow
 *      countdown progress. Stage resets to 0 on harvest.
 *   2. Standalone mode (growInterval > 0): simple turn-counter advances one
 *      stage per interval until maxStage is reached.
 *
 * When stage changes, NamedIdentity.identity is updated to drive the palette
 * glyph swap (seedling → herb → mature emoji).
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
export function plantGrowthSystem(world) {
  let depth = 1;
  for (const [, ds] of world.query(DungeonState)) {
    depth = ds.currentDepth ?? 1;
    break;
  }
  if (depth !== 0) return;

  for (const [id, gs] of world.query(GrowthStage)) {
    const identities = gs.stageIdentities;
    if (!Array.isArray(identities)) continue;

    let newStage = gs.currentStage;

    const hn = world.get(id, HarvestNode);
    if (hn) {
      // Crop mode: derive stage from HarvestNode countdown
      if (hn.ready) {
        newStage = gs.maxStage;
      } else {
        const total = hn.regrowTurns || 1;
        const remaining = hn.regrowCountdown || 0;
        const progress = 1 - remaining / total;  // 0..1
        newStage = Math.min(
          gs.maxStage - 1,
          Math.floor(progress * gs.maxStage)
        );
      }
    } else if (gs.growInterval > 0) {
      // Standalone mode: turn-counter growth
      if (gs.currentStage >= gs.maxStage) continue;  // already mature

      const countdown = (gs.growCountdown || 0) - 1;
      if (countdown <= 0) {
        newStage = Math.min(gs.currentStage + 1, gs.maxStage);
        world.mutate(id, GrowthStage, (r) => {
          r.growCountdown = gs.growInterval;
          r.currentStage = newStage;
        });
      } else {
        world.mutate(id, GrowthStage, (r) => {
          r.growCountdown = countdown;
        });
        continue;  // no stage change, skip identity update
      }
    }

    if (newStage === gs.currentStage) continue;

    // For crop mode, update stage via mutate (standalone already updated above)
    if (hn) {
      world.mutate(id, GrowthStage, (r) => {
        r.currentStage = newStage;
      });
    }

    // Update identity to swap palette glyph
    const newIdentity = identities[newStage];
    if (newIdentity) {
      const ni = world.get(id, NamedIdentity);
      if (ni && ni.identity !== newIdentity) {
        world.set(id, NamedIdentity, { ...ni, identity: newIdentity });
      }
    }
  }
}
