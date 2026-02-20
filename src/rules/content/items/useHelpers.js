import { Brain } from "../../components/Brain.js";
import { getCatalogItem } from "../../data/itemCatalog.js";
import { getSpell } from "../../data/spells.js";
import { ScriptVerb } from "../../scripting.js";

/**
 * @param {any} result
 */
export function normalizeScriptUseResult(result) {
  if (typeof result === "boolean") return { consumed: result, cancelled: false };
  if (result && typeof result === "object") {
    return {
      consumed: typeof result.consumed === "boolean" ? result.consumed : true,
      cancelled: result.cancelled === true,
      code: result.code,
      message: result.message,
      consumesTurn: result.consumesTurn,
    };
  }
  return { consumed: true, cancelled: false };
}

/**
 * @param {string} identity
 * @param {string} prefix
 */
export function spellIdFromIdentity(identity, prefix) {
  const id = String(identity || "").toLowerCase();
  const p = String(prefix || "").toLowerCase();
  if (!p || !id.startsWith(p)) return "";
  return id.slice(p.length);
}

/**
 * @param {{
 *   identityPrefix: string,
 *   targetMode?: "intentTarget" | "self" | "none",
 *   castEventSource?: string,
 *   consumeOnSuccess?: boolean,
 * }} opts
 */
export function createCastSpellFromIdentityOnUse(opts) {
  const identityPrefix = String(opts?.identityPrefix || "").toLowerCase();
  const targetMode = /** @type {"intentTarget" | "self" | "none"} */ (String(opts?.targetMode || "self"));
  const castEventSource = opts?.castEventSource;
  const consumeOnSuccess = opts?.consumeOnSuccess !== false;

  return (ctx, state) => {
    if (typeof ctx?.rules?.runSpell !== "function") return { consumed: false };
    const spellId = spellIdFromIdentity(state.identity, identityPrefix);
    if (!spellId) return { consumed: false };
    const spell = getSpell(spellId);
    if (!spell) return { consumed: false };

    const runIntent = targetMode === "intentTarget" ? { targetId: state.intent?.targetId } : {};
    try { ctx.rules.runSpell(state.actor, spell, runIntent); } catch { return { consumed: false }; }

    const castEvent = {
      actor: state.actor,
      spellId: spell.id,
      targetId: targetMode === "intentTarget"
        ? (state.intent?.targetId || state.actor)
        : state.actor,
    };
    if (castEventSource) castEvent.source = castEventSource;
    ctx.io.emit("castSpell", castEvent);

    return { consumed: consumeOnSuccess, spellId: spell.id };
  };
}

/**
 * @param {{
 *   identityPrefix: string,
 *   consumeOnSuccess?: boolean,
 * }} opts
 */
export function createLearnSpellFromIdentityOnUse(opts) {
  const identityPrefix = String(opts?.identityPrefix || "").toLowerCase();
  const consumeOnSuccess = opts?.consumeOnSuccess !== false;

  return (ctx, state) => {
    const spellId = spellIdFromIdentity(state.identity, identityPrefix);
    if (!spellId) return { consumed: false };

    const spell = getSpell(spellId);
    if (!spell) {
      ctx.io.emit("spell:learn-denied", { actor: state.actor, reason: "unknown-spell", spellId });
      return { consumed: false };
    }

    const brain = /** @type any */ (ctx.query.get(state.actor, Brain));
    const learned = Array.isArray(brain?.learnedSpellIds) ? brain.learnedSpellIds : [];
    if (learned.includes(spell.id)) {
      ctx.io.emit("spell:already-known", { actor: state.actor, spellId: spell.id });
      return { consumed: false };
    }

    ctx.mutate.learnSpell(state.actor, spell.id);
    ctx.io.emit("spell:learned", { actor: state.actor, spellId: spell.id });
    return { consumed: consumeOnSuccess, spellId: spell.id };
  };
}

/**
 * @param {string} effectKey
 */
export function createConsumableScriptOnUse(effectKey) {
  const key = String(effectKey || "");
  return (ctx, state) => {
    if (typeof ctx?.rules?.runScript !== "function" || !key) return { consumed: false };
    const scriptResult = normalizeScriptUseResult(
      ctx.rules.runScript(key, ScriptVerb.ItemUse, {
        actor: state.actor,
        itemId: state.itemId,
        params: { ...(state.effectParams || {}) },
      }),
    );
    if (scriptResult.cancelled) {
      ctx.cancel({
        code: String(scriptResult.code || "USE_CANCELLED"),
        message: String(scriptResult.message || "Use action cancelled."),
        consumesTurn: scriptResult.consumesTurn === true,
      });
      return { consumed: false, scriptResult };
    }
    return { consumed: scriptResult.consumed === true, scriptResult };
  };
}

export function openDeathLogOnUse(ctx, state) {
  ctx.io.emit("deathlog:open", { actor: state.actor });
  return { consumed: false };
}

export function openFlavorBookOnUse(ctx, state) {
  const def = getCatalogItem(state.identity);
  if (!def || String(def.type || "") !== "book" || !def.flavorText) return { consumed: false };
  ctx.io.emit("book:open", { actor: state.actor, title: def.name, text: def.flavorText });
  return { consumed: false };
}
