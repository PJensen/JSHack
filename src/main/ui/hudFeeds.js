import { playerEntity } from "../../rules/utils/queries.js";
import { Vitality } from "../../rules/components/Vitality.js";
import { Equipment } from "../../rules/components/Equipment.js";
import { ActiveEffects } from "../../rules/components/ActiveEffects.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Inventory } from "../../rules/components/Inventory.js";
import { AFFIX_DEFS } from "../../rules/data/affixes.js";
import { DungeonState } from "../../rules/components/DungeonState.js";

/**
 * Provides HUD feed updaters that cache the last dispatched values.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {{ getPlayerMana: () => { mana: number, maxMana: number } }} deps
 */
export function createHudFeeds(world, deps) {
  const { getPlayerMana } = deps;

  let lastVitals = { hp: -1, maxHp: -1, mana: -1, maxMana: -1 };
  let lastCombatHud = { weaponId: -1, atk: -999, def: -999, statusSig: "", affixSig: "", ammo: -1 };
  let lastDepth = -1;

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
      ? st.effects.map((e) => ({ key: String(e.key || e.type || "").toLowerCase(), turns: Number(e.turnsLeft || e.duration || 0), stacks: Number(e.stacks || 1) }))
      : [];
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

    if (lastCombatHud.weaponId !== wid || lastCombatHud.atk !== atk || lastCombatHud.def !== def ||
      lastCombatHud.statusSig !== statusSig || lastCombatHud.affixSig !== affixSig || lastCombatHud.ammo !== ammo) {
      lastCombatHud = { weaponId: wid, atk, def, statusSig, affixSig, ammo };
      try {
        window.dispatchEvent(new CustomEvent("ui:updateCombatHUD", { detail: {
          weapon: wid ? { id: wid, name: wName || null, damageDice: dmgDice || null, attack: atk } : null,
          defense: def,
          statuses,
          affixes: affixNames,
          ammo,
        } }));
      } catch {}
    }
  }

  function updateDepthHUD() {
    for (const [, state] of world.query(DungeonState)) {
      const d = state.currentDepth;
      if (d !== lastDepth) {
        lastDepth = d;
        try {
          window.dispatchEvent(new CustomEvent("ui:updateDepth", { detail: { depth: d } }));
        } catch {}
      }
      break;
    }
  }

  return {
    updateVitalsHUD,
    updateCombatHUD,
    updateDepthHUD,
  };
}
