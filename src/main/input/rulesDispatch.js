// src/main/input/rulesDispatch.js
// App-owned translation from display/input Actions → rules intents on the ECS world.
// This file is allowed to import rules and the ECS World (per Separation Manifest).

import { MoveIntent, WaitIntent, PrayIntent, DrinkIntent, CastSpellIntent, PickupIntent, DropIntent, EquipIntent, RangedAttackIntent, EngraveIntent, DisarmIntent, Position, ItemInfo } from "../../rules/components/index.js";
import { UseIntent } from "../../rules/components/Intents/UseIntent.js";
import { ApplyIntent } from "../../rules/components/Intents/ApplyIntent.js";
import { ThrowIntent } from "../../rules/components/Intents/ThrowIntent.js";
import { InteractIntent } from "../../rules/components/Intents/InteractIntent.js";
import { itemsAt } from "../../rules/utils/queries.js";

/**
 * Create a rules dispatcher bound to a world and an actor resolver.
 * @param {World} world - ECS world
 * @param {() => number} getActorId - Returns the current controlled actor id
 * @returns {(action:{type:string,payload?:object})=>void}
 */
export function makeRulesDispatcher(world, getActorId) {
  return function dispatch(action) {
    // Display-side lock: used for brief blocking FX windows (e.g. thrown-item flight).
    if (typeof window !== "undefined") {
      try {
        if (/** @type {any} */ (window).__JSHACK_INPUT_LOCKED === true) return;
      } catch (e) { console.debug('[rulesDispatch] input lock check failed:', e); }
    }

    const actorId = (typeof getActorId === "function") ? getActorId() : 0;
    if (!actorId) return;

    switch (action.type) {
      case "rules.move": {
        const { dx = 0, dy = 0 } = action.payload || {};
        world?.add?.(actorId, MoveIntent, { dx, dy });
        world?.tick?.(1);
        break;
      }
      case "rules.wait": {
        world?.add?.(actorId, WaitIntent, {});
        world?.tick?.(1);
        break;
      }
      case "rules.pray": {
        world?.add?.(actorId, PrayIntent, {});
        world?.tick?.(1);
        break;
      }
      case "rules.drinkPotion": {
        const { itemId = 0, targetId = actorId } = action.payload || {};
        world?.add?.(actorId, DrinkIntent, { itemId, targetId });
        world?.tick?.(1);
        break;
      }
      case "rules.castActiveSpell": {
        const { spellId, targetId = actorId, x = null, y = null } = action.payload || {};
        if (!spellId) {
          // No spell specified (keyboard shortcut); delegate to app-side
          // active spell resolution via the same path as the Cast button.
          try { window.dispatchEvent(new CustomEvent('ui:castActiveSpell')); } catch (e) { console.debug('[rulesDispatch] dispatch ui:castActiveSpell:', e); }
          break;
        }
        const cast = { spellId, targetId };
        if (Number.isFinite(x) && Number.isFinite(y)) {
          cast.x = Math.floor(Number(x));
          cast.y = Math.floor(Number(y));
        }
        world?.add?.(actorId, CastSpellIntent, cast);
        world?.tick?.(1);
        break;
      }
      case "rules.equipItem": {
        const { itemId = 0 } = action.payload || {};
        if (!Number.isInteger(itemId) || itemId <= 0) break;
        world?.add?.(actorId, EquipIntent, { itemId });
        world?.tick?.(1);
        break;
      }
      case "rules.useItem": {
        const { itemId = 0, targetId = actorId, x = null, y = null } = action.payload || {};
        if (!Number.isInteger(itemId) || itemId <= 0) break;
        const use = { itemId, targetId };
        if (Number.isFinite(x) && Number.isFinite(y)) {
          use.x = Math.floor(Number(x));
          use.y = Math.floor(Number(y));
        }
        world?.add?.(actorId, UseIntent, use);
        world?.tick?.(1);
        break;
      }
      case "rules.throwItem": {
        const { itemId = 0, targetId = 0, x = null, y = null } = action.payload || {};
        if (!Number.isInteger(itemId) || itemId <= 0) break;
        const throwIntent = { itemId, targetId };
        if (Number.isFinite(x) && Number.isFinite(y)) {
          throwIntent.x = Math.floor(Number(x));
          throwIntent.y = Math.floor(Number(y));
        }
        world?.add?.(actorId, ThrowIntent, throwIntent);
        world?.tick?.(1);
        break;
      }
      case "rules.shootRanged": {
        // No explicit target; delegate to app-side auto-targeting
        try { window.dispatchEvent(new CustomEvent('ui:shootRanged')); } catch (e) { console.debug('[rulesDispatch] dispatch ui:shootRanged:', e); }
        break;
      }
      case "rules.rangedAttack": {
        const { targetId = 0, toX = 0, toY = 0 } = action.payload || {};
        if (!Number.isInteger(targetId) || targetId <= 0) break;
        world?.add?.(actorId, RangedAttackIntent, { targetId, toX, toY });
        world?.tick?.(1);
        break;
      }
      case "rules.engrave": {
        const { text = "" } = action.payload || {};
        if (!text) break;
        world?.add?.(actorId, EngraveIntent, { text });
        world?.tick?.(1);
        break;
      }
      case "rules.applyItem": {
        const { itemId = 0, targetItemId = 0 } = action.payload || {};
        if (!Number.isInteger(itemId) || itemId <= 0) break;
        if (!Number.isInteger(targetItemId) || targetItemId <= 0) break;
        world?.add?.(actorId, ApplyIntent, { itemId, targetItemId });
        world?.tick?.(1);
        break;
      }
      case "rules.pickupItem": {
        // Determine which item to pick up: prefer payload.itemId; otherwise choose a ground item at actor's tile.
        const { itemId = 0, count = null } = action.payload || {};
        let targetId = 0;

        if (Number.isInteger(itemId) && itemId > 0) {
          targetId = itemId;
        } else {
          const pos = world?.get?.(actorId, Position);
          if (!pos) break;
          const ids = itemsAt(world, pos.x, pos.y);
          if (!ids || ids.length === 0) break;
          // Prefer non-currency items when multiple are present; fall back to any item (incl. currency)
          const nonCurrency = ids.filter((id) => {
            const info = world.get(id, ItemInfo);
            return info && info.type !== "currency";
          });
          targetId = (nonCurrency[0] ?? ids[0]) || 0;
        }

        if (!targetId) break;

        const intent = { targetId };
        if (Number.isFinite(count) && count > 0) intent.count = count;
        world?.add?.(actorId, PickupIntent, intent);
        world?.tick?.(1);
        break;
      }
      case "rules.dropItem": {
        const { itemId = 0, count = null } = action.payload || {};
        if (!Number.isInteger(itemId) || itemId <= 0) break;

        const intent = { itemId };
        if (Number.isFinite(count) && count > 0) intent.count = count;
        world?.add?.(actorId, DropIntent, intent);
        world?.tick?.(1);
        break;
      }
      case "rules.disarmTrap": {
        const { trapId = 0 } = action.payload || {};
        const disarm = {};
        if (Number.isInteger(trapId) && trapId > 0) disarm.trapId = trapId;
        world?.add?.(actorId, DisarmIntent, disarm);
        world?.tick?.(1);
        break;
      }
      case "rules.brewAlchemy": {
        const { benchId = 0, recipe = "" } = action.payload || {};
        if (!Number.isInteger(benchId) || benchId <= 0) break;
        const recipeKey = String(recipe || "").trim().toLowerCase();
        if (!recipeKey) break;
        world?.add?.(actorId, InteractIntent, { targetId: benchId, mode: "brew", recipe: recipeKey });
        world?.tick?.(1);
        break;
      }
      case "rules.cookFood": {
        const { fireId = 0, itemId: cookItemId = 0 } = action.payload || {};
        if (!Number.isInteger(fireId) || fireId <= 0) break;
        if (!Number.isInteger(cookItemId) || cookItemId <= 0) break;
        world?.add?.(actorId, InteractIntent, { targetId: fireId, mode: "cook", itemId: cookItemId });
        world?.tick?.(1);
        break;
      }
      case "rules.altarOffer": {
        const { altarId = 0, itemId = 0 } = action.payload || {};
        if (!Number.isInteger(altarId) || altarId <= 0) break;
        if (!Number.isInteger(itemId) || itemId <= 0) break;
        world?.add?.(actorId, InteractIntent, { targetId: altarId, mode: "offer", itemId });
        world?.tick?.(1);
        break;
      }
    }
  };
}
