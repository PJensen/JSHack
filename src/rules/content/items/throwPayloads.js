import { getItemHooksByIdentity } from "./itemHooks.js";
import { AggroState, AGGRO_LEVELS, SEARCH_TURNS_ALERTED } from "../../components/AggroState.js";
import { Position } from "../../components/Position.js";
import { Vitality } from "../../components/Vitality.js";
import { NamedIdentity } from "../../components/NamedIdentity.js";
import { CreatureType } from "../../components/CreatureType.js";

export const THROW_ITEM_PAYLOADS = Object.freeze({});

// ── Corpse Misdirect ───────────────────────────────────────────────────
// Throwing a corpse near hostile mobs misdirects them: they investigate the
// thud instead of chasing the player.  The corpse lands normally (not consumed).

const MISDIRECT_RADIUS = 3;

function createCorpseMisdirectThrowHook() {
  return (ctx, state) => {
    const actorId = Number(state?.actor || ctx.actor || 0) | 0;
    const itemId = Number(state?.itemId || ctx.primary || 0) | 0;
    const throwSpec = (state?.throw && typeof state.throw === "object") ? state.throw : null;
    const fallback = ctx.helpers.adjacentPoint(actorId);
    const at = {
      x: Number.isFinite(Number(throwSpec?.to?.x)) ? (Number(throwSpec.to.x) | 0) : (fallback.x | 0),
      y: Number.isFinite(Number(throwSpec?.to?.y)) ? (Number(throwSpec.to.y) | 0) : (fallback.y | 0),
    };

    const identity = String(state?.identity || "");
    const isUndead = identity.includes("wight") || identity.includes("lich")
      || identity.includes("wraith") || identity.includes("skeleton");
    const isDragonWhelp = identity === "corpse_dragon_whelp";

    // Find all living hostiles in misdirect radius
    const misdirected = [];
    for (let dx = -MISDIRECT_RADIUS; dx <= MISDIRECT_RADIUS; dx++) {
      for (let dy = -MISDIRECT_RADIUS; dy <= MISDIRECT_RADIUS; dy++) {
        const ids = ctx.query.livingAt(at.x + dx, at.y + dy, { exclude: [actorId] });
        for (const id of (Array.isArray(ids) ? ids : [])) {
          const aggro = ctx.query.get(id, AggroState);
          if (!aggro) continue;
          const level = String(aggro.alertLevel || "");
          if (level !== AGGRO_LEVELS.hunting && level !== AGGRO_LEVELS.alerted) continue;

          // Undead corpse thrown at undead: they hesitate instead of full misdirect
          const ct = ctx.query.get(id, CreatureType);
          if (isUndead && ct && ct.type === "undead") {
            aggro.alertLevel = AGGRO_LEVELS.curious;
            aggro.searchTurnsLeft = 6;
            misdirected.push(id);
            continue;
          }

          // Standard misdirect: redirect to corpse landing and downgrade to alerted
          aggro.alertLevel = AGGRO_LEVELS.alerted;
          aggro.lastKnownX = at.x;
          aggro.lastKnownY = at.y;
          aggro.searchTurnsLeft = SEARCH_TURNS_ALERTED;
          aggro.retreating = false;
          misdirected.push(id);
        }
      }
    }

    // Dragon whelp corpse: 30% chance to apply burn to entities on landing tile
    if (isDragonWhelp) {
      const hitIds = ctx.query.livingAt(at.x, at.y, { exclude: [actorId] });
      for (const hitId of (Array.isArray(hitIds) ? hitIds : [])) {
        if (ctx.helpers.chance(30)) {
          ctx.helpers.addEffect(hitId, {
            key: "burning",
            potency: 1,
            turnsLeft: 4,
            onsetLeft: 0,
            peakLeft: 0,
            stack: "refresh",
            maxStacks: 1,
            sourceId: itemId,
            meta: { source: "corpse_dragon_whelp", delivery: "thrown" },
          });
        }
      }
    }

    if (misdirected.length > 0) {
      ctx.io.emit("corpse:misdirect", {
        actor: actorId,
        itemId,
        at: { ...at },
        identity,
        misdirectedCount: misdirected.length,
        isUndead,
      });
    }

    // Don't consume — corpse drops normally via base throw
    return { consumed: false, skipBaseThrow: false };
  };
}

export const THROW_ITEM_MATCHER_PAYLOADS = Object.freeze([
  {
    id: "corpse:misdirect",
    matches: (state) => String(state?.identity || "").startsWith("corpse_"),
    onThrow: createCorpseMisdirectThrowHook(),
  },
]);

/**
 * Resolve a first-class throw payload object for the current item state.
 * Priority:
 * 1. Exact item identity payload object
 * 2. Item-def throw hooks
 * 3. Matcher payload object
 *
 * @param {{
 *   identity: string,
 *   info?: any,
 *   intent?: any,
 * }} state
 */
export function findThrowPayload(state) {
  const identity = String(state?.identity || "");
  const direct = THROW_ITEM_PAYLOADS[identity];
  if (direct) return { ...direct, source: "identity" };

  const hooks = getItemHooksByIdentity(identity);
  const hasThrowHooks = (
    typeof hooks.beforeThrow === "function"
    || typeof hooks.onThrow === "function"
    || typeof hooks.afterThrow === "function"
  );
  if (hasThrowHooks) {
    return {
      id: `item:${identity}:hooks`,
      source: "itemHooks",
      beforeThrow: hooks.beforeThrow,
      onThrow: hooks.onThrow,
      afterThrow: hooks.afterThrow,
    };
  }

  for (let i = 0; i < THROW_ITEM_MATCHER_PAYLOADS.length; i++) {
    const payload = THROW_ITEM_MATCHER_PAYLOADS[i];
    try {
      if (payload.matches(state)) return { ...payload, source: "matcher" };
    } catch (e) { console.error('[throwPayloads] matcher failed:', e); }
  }

  return null;
}
