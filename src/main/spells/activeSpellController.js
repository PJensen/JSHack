import { playerEntity } from "../../rules/utils/queries.js";
import { Brain } from "../../rules/components/Brain.js";
import { Mana } from "../../rules/components/Mana.js";
import { getSpell } from "../../rules/data/spells.js";
import { effectiveMaxMana } from "../../rules/utils/passiveBonuses.js";

/**
 * Controls the currently selected active spell and related metadata.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function createActiveSpellController(world) {
  /** @type {string|null} */
  let activeSpellId = null;
  const uiTarget = /** @type {any} */ ((typeof window !== "undefined") ? window : globalThis);

  // Action bar slots (WoW-style bindable spell/ability slots, keys 1-6)
  const MAX_SLOTS = 6;
  /** @type {(string|null)[]} */
  const _actionBarSlots = new Array(MAX_SLOTS).fill(null);

  function knownSpellIds() {
    const spells = learnedSpells();
    const ids = [];
    for (let i = 0; i < spells.length; i++) {
      const id = String(spells[i]?.id || "");
      if (!id) continue;
      if (!getSpell(id)) continue;
      ids.push(id);
    }
    return ids;
  }

  function learnedSpells() {
    const pe = playerEntity(world);
    if (!pe) return [];
    /** @type {{ learnedSpellIds?: string[] }|null} */
    const brain = /** @type any */ (world.get(pe.id, Brain));
    const ids = Array.isArray(brain?.learnedSpellIds) ? brain.learnedSpellIds : [];
    return ids.map((id) => ({ id, ...(getSpell(id) || {}) }));
  }

  function getPlayerMana() {
    const pe = playerEntity(world);
    if (!pe) return { mana: 0, maxMana: 0 };
    /** @type {{ mana?:number, maxMana?:number }|null} */
    const m = /** @type any */ (world.get(pe.id, Mana));
    return { mana: Number(m?.mana || 0), maxMana: effectiveMaxMana(world, pe.id, m) };
  }

  function updateActiveSpellLabel() {
    const spell = activeSpellId ? getSpell(activeSpellId) : null;
    const name = spell?.name || activeSpellId || "";
    const symbol = spell?.symbol || "";
    const cost = Number(spell?.manaCost || 0);
    const { mana } = getPlayerMana();
    const canCast = mana >= cost && !!activeSpellId;
    try {
      if (uiTarget && typeof uiTarget.dispatchEvent === "function") {
        uiTarget.dispatchEvent(new CustomEvent("ui:updateActiveSpellLabel", {
          detail: { id: activeSpellId, name, symbol, cost, canCast }
        }));
      }
    } catch (e) { console.debug('[activeSpellController] dispatch ui:updateActiveSpellLabel:', e); }
  }

  function ensureActiveSpell() {
    const ids = knownSpellIds();
    if (!activeSpellId || !ids.includes(activeSpellId)) {
      activeSpellId = ids[0] || null;
      updateActiveSpellLabel();
    }
    return activeSpellId;
  }

  function setActiveSpell(id) {
    const requested = (typeof id === "string" && id.length) ? id : null;
    const ids = knownSpellIds();
    if (!requested) {
      activeSpellId = ids[0] || null;
    } else if (ids.includes(requested)) {
      activeSpellId = requested;
    } else {
      activeSpellId = ids[0] || null;
    }
    updateActiveSpellLabel();
  }

  function getActiveSpellId() {
    return activeSpellId;
  }

  function getActionBarSlots() {
    return _actionBarSlots.slice();
  }

  function setSlot(index, spellId) {
    if (index < 0 || index >= MAX_SLOTS) return;
    if (spellId && !getSpell(spellId)) return;
    _actionBarSlots[index] = spellId || null;
  }

  function clearSlot(index) {
    if (index < 0 || index >= MAX_SLOTS) return;
    _actionBarSlots[index] = null;
  }

  /** Auto-assign a spell to the first empty slot. Returns the slot index or -1. */
  function autoAssignSlot(spellId) {
    if (!spellId || !getSpell(spellId)) return -1;
    // Already in a slot? Skip.
    if (_actionBarSlots.includes(spellId)) return _actionBarSlots.indexOf(spellId);
    for (let i = 0; i < MAX_SLOTS; i++) {
      if (_actionBarSlots[i] === null) {
        _actionBarSlots[i] = spellId;
        return i;
      }
    }
    return -1;
  }

  /** Restore slots from savegame data. */
  function restoreSlots(savedSlots) {
    for (let i = 0; i < MAX_SLOTS; i++) {
      _actionBarSlots[i] = null;
    }
    if (!Array.isArray(savedSlots)) return;
    for (let i = 0; i < Math.min(savedSlots.length, MAX_SLOTS); i++) {
      const id = savedSlots[i];
      if (typeof id === "string" && id.length && getSpell(id)) {
        _actionBarSlots[i] = id;
      }
    }
  }

  return {
    learnedSpells,
    knownSpellIds,
    getPlayerMana,
    ensureActiveSpell,
    setActiveSpell,
    updateActiveSpellLabel,
    getActiveSpellId,
    getActionBarSlots,
    setSlot,
    clearSlot,
    autoAssignSlot,
    restoreSlots,
  };
}
