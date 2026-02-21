import { playerEntity } from "../../rules/utils/queries.js";
import { Vitality } from "../../rules/components/Vitality.js";
import { Stamina } from "../../rules/components/Stamina.js";
import { Equipment } from "../../rules/components/Equipment.js";
import { ActiveEffects } from "../../rules/components/ActiveEffects.js";
import { Status } from "../../rules/components/Status.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Inventory } from "../../rules/components/Inventory.js";
import { AFFIX_DEFS } from "../../rules/data/affixes.js";
import { DungeonState } from "../../rules/components/DungeonState.js";
import { Hunger } from "../../rules/components/Hunger.js";
import { getHungerLevel } from "../../rules/data/food.js";
import { Pet } from "../../rules/components/Pet.js";
import { PetState } from "../../rules/components/PetState.js";

/**
 * Provides HUD feed updaters that cache the last dispatched values.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {{ getPlayerMana: () => { mana: number, maxMana: number } }} deps
 */
export function createHudFeeds(world, deps) {
  const { getPlayerMana } = deps;

  let lastVitals = { hp: -1, maxHp: -1, mana: -1, maxMana: -1, stamina: -1, maxStamina: -1 };
  let lastCombatHud = { weaponId: -1, rangedId: -1, rangedCount: -1, atk: -999, def: -999, statusSig: "", affixSig: "", ammo: -1 };
  let lastDepth = -1;
  let lastPetExists = false;
  let lastPetState = "";

  function updateVitalsHUD() {
    const pe = playerEntity(world);
    if (!pe) return;
    /** @type {{ hp?:number, maxHp?:number }|null} */
    const vit = /** @type any */ (world.get(pe.id, Vitality));
    const mana = getPlayerMana();
    const stam = /** @type any */ (world.get(pe.id, Stamina));
    const eq = /** @type any */ (world.get(pe.id, Equipment));

    const hp = Number(vit?.hp ?? 0);
    const maxHp = Number(vit?.maxHp ?? 0);
    const stamina = Number(stam?.stamina ?? 0);
    const maxStaminaBonus = Number(eq?.maxStaminaDerived ?? 0);
    const maxStamina = Number(stam?.maxStamina ?? 100) + maxStaminaBonus;
    if (hp !== lastVitals.hp || maxHp !== lastVitals.maxHp ||
        mana.mana !== lastVitals.mana || mana.maxMana !== lastVitals.maxMana ||
        stamina !== lastVitals.stamina || maxStamina !== lastVitals.maxStamina) {
      lastVitals = { hp, maxHp, mana: mana.mana, maxMana: mana.maxMana, stamina, maxStamina };
      try {
        window.dispatchEvent(new CustomEvent("ui:updateVitals", { detail: lastVitals }));
      } catch (e) { console.debug('[hudFeeds] dispatch ui:updateVitals:', e); }
    }
  }

  function updateCombatHUD() {
    const pe = playerEntity(world);
    if (!pe) return;
    const eq = /** @type any */ (world.get(pe.id, Equipment));
    const st = /** @type any */ (world.get(pe.id, ActiveEffects));
    const semanticStatus = /** @type any */ (world.get(pe.id, Status));
    const wid = Number(eq?.weapon || 0);
    const rangedId = Number(eq?.ranged || 0);
    const atk = Number(eq?.attackDerived || 0);
    const def = Number(eq?.defenseDerived || 0);
    const wInfo = wid ? world.get(wid, ItemInfo) : null;
    const rangedInfo = rangedId ? world.get(rangedId, ItemInfo) : null;
    const rangedCount = Number(rangedInfo?.count || 0);
    const wName = wid ? (world.get(wid, NamedIdentity)?.name || wInfo?.description || wInfo?.type) : "";
    const rangedName = rangedId ? (world.get(rangedId, NamedIdentity)?.name || rangedInfo?.description || rangedInfo?.type) : "";
    const dmgDice = wInfo?.damageDice || "";
    const rangedType = String(rangedInfo?.type || "");
    /** @type {Map<string, { key: string, turns: number, stacks: number }>} */
    const statusMap = new Map();
    if (Array.isArray(st?.effects)) {
      for (const e of st.effects) {
        const key = String(e?.key || e?.type || "").toLowerCase();
        if (!key) continue;
        const turns = Math.max(0, Number(e?.turnsLeft || e?.duration || 0));
        const stacks = Math.max(1, Number(e?.stacks || 1));
        const prev = statusMap.get(key);
        if (!prev) statusMap.set(key, { key, turns, stacks });
        else statusMap.set(key, { key, turns: Math.max(prev.turns, turns), stacks: Math.max(prev.stacks, stacks) });
      }
    }
    if (Array.isArray(semanticStatus?.statuses)) {
      for (const s of semanticStatus.statuses) {
        const key = String(s?.type || s?.key || "").toLowerCase();
        if (!key) continue;
        const turns = Math.max(0, Number(s?.duration || s?.turns || 0));
        const stacks = Math.max(1, Number(s?.stacks || 1));
        const prev = statusMap.get(key);
        if (!prev) statusMap.set(key, { key, turns, stacks });
        else statusMap.set(key, { key, turns: Math.max(prev.turns, turns), stacks: Math.max(prev.stacks, stacks) });
      }
    }
    const hc = /** @type any */ (world.get(pe.id, Hunger));
    if (hc) {
      const level = hc.satiation > 0 ? "satiated" : getHungerLevel(Number(hc.hunger || 0));
      if (level !== "normal") {
        const key = String(level).toLowerCase();
        const turns = hc.satiation > 0 ? Math.max(0, Number(hc.satiation || 0)) : 9999;
        const stacks = 1;
        const prev = statusMap.get(key);
        if (!prev) statusMap.set(key, { key, turns, stacks });
        else statusMap.set(key, { key, turns: Math.max(prev.turns, turns), stacks: Math.max(prev.stacks, stacks) });
      }
    }
    const statuses = Array.from(statusMap.values());
    const statusSig = statuses.map((s) => `${s.key}:${s.turns}:${s.stacks}`).join("|");

    const affixIds = [];
    const pushAffixes = (id) => {
      const info = id ? world.get(id, ItemInfo) : null;
      const arr = info && Array.isArray(info.affixes) ? info.affixes : [];
      for (const a of arr) affixIds.push(String(a));
    };
    if (eq) {
      pushAffixes(Number(eq.weapon || 0));
      pushAffixes(Number(eq.armor || 0));
      pushAffixes(Number(eq.ring1 || 0));
      pushAffixes(Number(eq.ring2 || 0));
      pushAffixes(Number(eq.ranged || 0));
    }
    const affixNames = affixIds
      .filter((id) => !/^thorns/i.test(String(id)))
      .map((id) => (AFFIX_DEFS?.[id]?.name) || id);
    const affixSig = affixNames.join("|");

    // Count ammo in player inventory
    let ammo = 0;
    const inv = /** @type any */ (world.get(pe.id, Inventory));
    if (inv && Array.isArray(inv.items)) {
      for (const iid of inv.items) {
        const info = world.get(iid, ItemInfo);
        if (info && info.type === 'ammo') ammo += Number(info.count || 1);
      }
    }

    if (lastCombatHud.weaponId !== wid || lastCombatHud.rangedId !== rangedId || lastCombatHud.rangedCount !== rangedCount || lastCombatHud.atk !== atk || lastCombatHud.def !== def ||
      lastCombatHud.statusSig !== statusSig || lastCombatHud.affixSig !== affixSig || lastCombatHud.ammo !== ammo) {
      lastCombatHud = { weaponId: wid, rangedId, rangedCount, atk, def, statusSig, affixSig, ammo };
      try {
        window.dispatchEvent(new CustomEvent("ui:updateCombatHUD", { detail: {
          weapon: wid ? { id: wid, name: wName || null, damageDice: dmgDice || null, attack: atk } : null,
          ranged: rangedId ? { id: rangedId, name: rangedName || null, isWand: rangedType === 'wand', count: rangedCount } : null,
          defense: def,
          statuses,
          affixes: affixNames,
          ammo,
        } }));
      } catch (e) { console.debug('[hudFeeds] dispatch ui:updateCombatHUD:', e); }
    }
  }

  function updateDepthHUD() {
    for (const [, state] of world.query(DungeonState)) {
      const d = state.currentDepth;
      if (d !== lastDepth) {
        lastDepth = d;
        try {
          window.dispatchEvent(new CustomEvent("ui:updateDepth", { detail: { depth: d } }));
        } catch (e) { console.debug('[hudFeeds] dispatch ui:updateDepth:', e); }
      }
      break;
    }
  }

  function updatePetHUD() {
    // Check if pet exists
    let petExists = false;
    let petState = "";
    for (const [petId, _pet, vit] of world.query(Pet, Vitality)) {
      if (!vit || vit.hp <= 0) continue;
      petExists = true;
      const state = world.get(petId, PetState);
      petState = state?.state || "following";
      break; // Only one pet for now
    }

    // Update visibility if changed
    if (petExists !== lastPetExists) {
      lastPetExists = petExists;
      try {
        window.dispatchEvent(new CustomEvent("ui:petExists", {
          detail: { exists: petExists }
        }));
      } catch (e) { console.debug('[hudFeeds] dispatch ui:petExists:', e); }
    }

    // Update state if changed
    if (petExists && petState !== lastPetState) {
      lastPetState = petState;
      try {
        window.dispatchEvent(new CustomEvent("ui:updatePetButton", {
          detail: { state: petState }
        }));
      } catch (e) { console.debug('[hudFeeds] dispatch ui:updatePetButton:', e); }
    }
  }

  return {
    updateVitalsHUD,
    updateCombatHUD,
    updateDepthHUD,
    updatePetHUD,
  };
}
