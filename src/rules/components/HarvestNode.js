import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * HarvestNode — interactive gatherable node that regrows over time.
 *
 * Yield and side-effect behaviour is encoded as pure data on the component,
 * matching the weapon/equipment pattern (staminaCost, bonuses.dig, etc.).
 *
 * Fields:
 *   kind          — logical node kind (used for UI labels / regrowth display)
 *   ready         — true when harvestable
 *   regrowTurns   — turns to regrow after depletion
 *   regrowCountdown — countdown while !ready
 *   yield         — catalog item id to award (e.g. 'ore_iron')
 *   yieldMin      — minimum count
 *   yieldMax      — maximum count
 *   requiresTool  — equipment bonus key required to harvest (e.g. 'dig'), or null
 *   danger        — optional melee-style damage on harvest: { type, dmgMin, dmgMax, cause }
 *   hazard        — optional floor hazard on harvest: { kind, turnsLeft, tickDamage, identity, name }
 */
export const HarvestNode = defineComponent("HarvestNode", {
  kind: "berries",
  ready: true,
  regrowTurns: 40,
  regrowCountdown: 0,
  yield: null,
  yieldMin: 1,
  yieldMax: 1,
  requiresTool: null,
  danger: null,
  hazard: null,
  replantable: false,
  needsPlanting: false,
}, {
  validate(rec) {
    if (typeof rec.kind !== "string" || !rec.kind) throw new Error("HarvestNode.kind must be a non-empty string");
    if (typeof rec.ready !== "boolean") throw new Error("HarvestNode.ready must be boolean");
    if (!Number.isInteger(rec.regrowTurns) || rec.regrowTurns < 1) throw new Error("HarvestNode.regrowTurns must be >= 1");
    if (!Number.isInteger(rec.regrowCountdown) || rec.regrowCountdown < 0) throw new Error("HarvestNode.regrowCountdown must be >= 0");
    return true;
  },
});
