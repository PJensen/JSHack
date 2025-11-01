// app/input/rulesDispatch.js
// App-owned translation from display/input Actions → rules intents on the ECS world.
// This file is allowed to import rules and the ECS World (per Separation Manifest).

import { MoveIntent, WaitIntent, DrinkIntent, CastSpellIntent } from "../../src/rules/components/index.js";

/**
 * Create a rules dispatcher bound to a world and an actor resolver.
 * @param {World} world - ECS world
 * @param {() => number} getActorId - Returns the current controlled actor id
 * @returns {(action:{type:string,payload?:object})=>void}
 */
export function makeRulesDispatcher(world, getActorId) {
  return function dispatch(action) {
    const actorId = (typeof getActorId === "function") ? getActorId() : 0;
    if (!actorId) return;

    switch (action.type) {
      case "rules.move": {
        const { dx = 0, dy = 0 } = action.payload || {};
        world?.add?.(actorId, MoveIntent, { dx, dy });
        break;
      }
      case "rules.wait": {
        world?.add?.(actorId, WaitIntent, {});
        break;
      }
      case "rules.drinkPotion": {
        const { itemId = 0, targetId = actorId } = action.payload || {};
        world?.add?.(actorId, DrinkIntent, { itemId, targetId });
        break;
      }
      case "rules.castActiveSpell": {
        const { spellId = 0, targetId = actorId } = action.payload || {};
        world?.add?.(actorId, CastSpellIntent, { spellId, targetId });
        break;
      }
    }
  };
}
