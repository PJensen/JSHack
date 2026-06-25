import { defineInteractable } from "../../index.js";
import { Vitality } from "../../../rules/components/Vitality.js";
import { FountainState } from "../../../rules/components/FountainState.js";
import { inventoryItems } from "../../../rules/utils/inventoryFacade.js";
import { combatSeed, mulberry32 } from "../../../rules/utils/rng.js";
import { FountainDried } from "../../../events/FountainDried.js";
import { FountainDipPrompted } from "../../../events/FountainDipPrompted.js";
import { ensureFountainState, spendFountainCharge } from "./state.js";
import { chooseFountainDrinkOutcome } from "./outcomes.js";
import { resolveFountainDip } from "./dip.js";

const ACTIONS = Object.freeze([
  Object.freeze({ mode: "drink", label: "Drink" }),
  Object.freeze({ mode: "dip", label: "Dip" }),
]);

function fountainRng(world, actor, targetId, salt) {
  return mulberry32(combatSeed(world.seed, world.step, actor | 0, targetId | 0, salt));
}

defineInteractable("fountain", {
  actions(world, targetId) {
    const state = ensureFountainState(world, targetId);
    return state.chargesRemaining > 0 ? ACTIONS : [];
  },

  beforeInteract(ctx) {
    const { world, actor, targetId, intent } = ctx;
    const state = ensureFountainState(world, targetId);
    if (state.chargesRemaining <= 0) {
      world.emit(new FountainDried({
        actor,
        targetId,
        cooldownTurns: state.cooldownTurns,
        dryUntilStep: state.dryUntilStep,
      }));
      ctx.cancel("FOUNTAIN_DRY", "The fountain has run dry.");
      return;
    }
    if (intent?.mode === "drink" && !world.has(actor, Vitality)) {
      ctx.cancel("NO_VITALITY", "Actor has no vitality component.");
      return;
    }
    if (intent?.mode === "dip" && !(intent.itemId > 0)) {
      world.emit(new FountainDipPrompted({ actor, targetId, items: inventoryItems(world, actor) }));
      ctx.cancel("DIP_PROMPT");
      return;
    }
    if (intent?.mode === "dip" && !world.isAlive(intent.itemId | 0)) {
      ctx.cancel("INVALID_ITEM", "The selected item no longer exists.");
    }
  },

  onInteract(ctx) {
    const state = ensureFountainState(ctx.world, ctx.targetId);
    if (ctx.intent?.mode === "dip") {
      resolveFountainDip(ctx, fountainRng(ctx.world, ctx.actor, ctx.targetId, 0xD1B5));
    } else {
      const rng = fountainRng(ctx.world, ctx.actor, ctx.targetId, 0xF0C5);
      chooseFountainDrinkOutcome(rng).run({ ...ctx, state, rng });
    }
    spendFountainCharge(ctx.world, ctx.actor, ctx.targetId);
  },
});

export { FOUNTAIN_DRINK_OUTCOMES } from "./outcomes.js";
export { ensureFountainState, spendFountainCharge } from "./state.js";
export { FountainState };
