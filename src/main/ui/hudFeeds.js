import { playerEntity } from "../../rules/utils/queries.js";
import { Vitality } from "../../rules/components/Vitality.js";
import { Equipment } from "../../rules/components/Equipment.js";
import { ActiveEffects } from "../../rules/components/ActiveEffects.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { AFFIX_DEFS } from "../../rules/data/affixes.js";

/**
 * Provides HUD feed updaters that cache the last dispatched values.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {{ getPlayerMana: () => { mana: number, maxMana: number } }} deps
 */
export function createHudFeeds(world, deps) {
  const { getPlayerMana } = deps;

  let lastVitals = { hp: -1, maxHp: -1, mana: -1, maxMana: -1 };
  let lastCombatHud = { weaponId: -1, atk: -999, def: -999, statusSig: "", affixSig: "" };

  function updateVitalsHUD() {
    const pe = playerEntity(world);
    if (!pe) return;
    /** @type {{ hp?:number, maxHp?:number }|null} */
    const vit = /** @type any */ (world.get(pe.id, Vitality));
    const mana = getPlayerMana();
    const hp = Number(vit?.hp ?? 0);
    const maxHp = Number(vit?.maxHp ?? 0);
    if (hp !== lastVitals.hp || maxHp !== lastVitals.maxHp || mana.mana !== lastVitals.mana || mana.maxMana !== lastVitals.maxMana) {
      lastVitals = { hp, maxHp, mana: mana.mana, maxMana: mana.maxMana };
      try {
        window.dispatchEvent(new CustomEvent("ui:updateVitals", { detail: lastVitals }));
      } catch {}
    }
  }

  function updateCombatHUD() {
    const pe = playerEntity(world);
    if (!pe) return;
    const eq = /** @type any */ (world.get(pe.id, Equipment));
    const st = /** @type any */ (world.get(pe.id, ActiveEffects));
    const wid = Number(eq?.weapon || 0);
    const atk = Number(eq?.attackDerived || 0);
    const def = Number(eq?.defenseDerived || 0);
    const wInfo = wid ? world.get(wid, ItemInfo) : null;
    const wName = wid ? (world.get(wid, NamedIdentity)?.name || wInfo?.description || wInfo?.type) : "";
    const dmgDice = wInfo?.damageDice || "";
    const statuses = Array.isArray(st?.effects)
      ? st.effects.map((e) => ({ key: String(e.key || e.type || "").toLowerCase(), turns: Number(e.turnsLeft || e.duration || 0) }))
      : [];
    const statusSig = statuses.map((s) => `${s.key}:${s.turns}`).join("|");

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
    }
    const affixNames = affixIds
      .filter((id) => !/^thorns/i.test(String(id)))
      .map((id) => (AFFIX_DEFS?.[id]?.name) || id);
    const affixSig = affixNames.join("|");

    if (lastCombatHud.weaponId !== wid || lastCombatHud.atk !== atk || lastCombatHud.def !== def ||
      lastCombatHud.statusSig !== statusSig || lastCombatHud.affixSig !== affixSig) {
      lastCombatHud = { weaponId: wid, atk, def, statusSig, affixSig };
      try {
        window.dispatchEvent(new CustomEvent("ui:updateCombatHUD", { detail: {
          weapon: wid ? { id: wid, name: wName || null, damageDice: dmgDice || null, attack: atk } : null,
          defense: def,
          statuses,
          affixes: affixNames,
        } }));
      } catch {}
    }
  }

  return {
    updateVitalsHUD,
    updateCombatHUD,
  };
}
