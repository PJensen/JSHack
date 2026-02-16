import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * HarvestNode — interactive gatherable node that regrows over time.
 */
export const HarvestNode = defineComponent("HarvestNode", {
  kind: "berries",      // logical node kind: 'berries' | 'herbs'
  ready: true,          // true when it can be harvested
  regrowTurns: 40,      // turns required to regrow after harvest
  turnsUntilReady: 0,   // countdown while !ready
}, {
  validate(rec) {
    if (typeof rec.kind !== "string" || !rec.kind) throw new Error("HarvestNode.kind must be a non-empty string");
    if (typeof rec.ready !== "boolean") throw new Error("HarvestNode.ready must be boolean");
    if (!Number.isInteger(rec.regrowTurns) || rec.regrowTurns < 1) throw new Error("HarvestNode.regrowTurns must be >= 1");
    if (!Number.isInteger(rec.turnsUntilReady) || rec.turnsUntilReady < 0) throw new Error("HarvestNode.turnsUntilReady must be >= 0");
    return true;
  },
});
