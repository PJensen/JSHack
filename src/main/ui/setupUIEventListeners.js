import { setupInput } from "../../display/input/InputRouter.js";
import { enableInputLockdown } from "../../display/input/lockdown.js";
import { makeRulesDispatcher } from "../../../app/input/rulesDispatch.js";
import { initOverlays } from "../../display/ui/overlay.js";
import { initHUD } from "../../display/ui/hud.js";
import { Inventory } from "../../rules/components/Inventory.js";
import { Equipment } from "../../rules/components/Equipment.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { itemsAt, playerEntity } from "../../rules/utils/queries.js";
import { zoomTo } from "../../display/camera/utils.js";

const resolveRulesDispatcher = (world, playerIdFn) => makeRulesDispatcher(world, playerIdFn);

/**
 * Wires UI/browser events so the rules engine can respond.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {{ canvas: HTMLCanvasElement, cam: any, tileSize: number, getMessageLogEntries: () => string[], activeSpells: any }} deps
 */
export function setupUIEventListeners(world, deps) {
  const { canvas, cam, tileSize, getMessageLogEntries, activeSpells } = deps;
  const { learnedSpells, ensureActiveSpell, setActiveSpell } = activeSpells;

  enableInputLockdown({ canvas });
  initOverlays();
  initHUD();

  const inputDisposers = [];
  const rulesHandler = resolveRulesDispatcher(
    /** @type any */ (world),
    () => (playerEntity(world)?.id || 0)
  );

  const displayHandler = (action) => {
    switch (action.type) {
      case "display.openInventory":
        window.dispatchEvent(new CustomEvent("ui:openInventory"));
        break;
      case "display.openMessageLog":
        window.dispatchEvent(new CustomEvent("ui:openMessageLog"));
        break;
      case "display.zoom": {
        const f = Math.max(0.5, Math.min(1.5, Number(action.payload?.factor) || 1));
        const minS = tileSize * 0.5;
        const maxS = tileSize * 4.0;
        const current = (cam.targetScale || cam.scale || tileSize);
        const next = Math.max(minS, Math.min(maxS, current * f));
        zoomTo(cam, next);
        break;
      }
      case "display.openPickupChooser": {
        const p = playerEntity(world);
        if (!p) break;
        const ids = itemsAt(world, p.pos.x, p.pos.y);
        if (ids.length === 0) {
          break;
        }
        if (ids.length === 1) {
          const only = ids[0];
          rulesHandler({ type: "rules.pickupItem", payload: { itemId: only } });
        } else {
          const items = ids.map((id) => {
            const info = world.get(id, ItemInfo);
            const name = world.get(id, NamedIdentity);
            return { id, type: info?.type || "item", name: name?.name || info?.type || "item", count: info?.count || 1 };
          });
          window.dispatchEvent(new CustomEvent("ui:openPickupChooser", { detail: { items } }));
        }
        break;
      }
      default:
        break;
    }
  };

  const getPointerOrigin = () => {
    const pe = playerEntity(world);
    return pe ? { x: pe.pos.x, y: pe.pos.y } : null;
  };

  setupInput({
    canvas,
    rulesHandler,
    displayHandler,
    onDispose: inputDisposers,
    touchFeedback: true,
    camera: cam,
    getPointerOrigin,
  });

  addEventListener("ui:requestInventoryData", () => {
    const p = playerEntity(world);
    const items = [];
    if (p) {
      const inv = world.get(p.id, Inventory);
      const eq = world.get(p.id, Equipment);
      if (inv && Array.isArray(inv.items)) {
        for (const id of inv.items) {
          const info = world.get(id, ItemInfo);
          const name = world.get(id, NamedIdentity);
          if (info) {
            const equippedSlot = (eq && (
              (eq.weapon === id && "weapon") ||
              (eq.armor === id && "armor") ||
              (eq.shield === id && "shield") ||
              (eq.ring1 === id && "ring1") ||
              (eq.ring2 === id && "ring2")
            )) || null;
            items.push({
              id,
              type: info.type,
              description: info.description,
              count: info.count,
              slot: info.slot,
              name: name?.name,
              rarityName: info.rarityName,
              bonuses: info.bonuses || {},
              affixes: Array.isArray(info.affixes) ? info.affixes.slice() : [],
              equipped: Boolean(equippedSlot),
              equippedSlot,
            });
          }
        }
      }
    }
    window.dispatchEvent(new CustomEvent("ui:inventoryData", { detail: { items } }));
  });

  addEventListener("ui:requestMessageLogData", () => {
    const entries = getMessageLogEntries();
    window.dispatchEvent(new CustomEvent("ui:messageLogData", { detail: { entries } }));
  });

  addEventListener("ui:castActiveSpell", () => {
    const handler = resolveRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
    const id = ensureActiveSpell();
    handler({ type: "rules.castActiveSpell", payload: id ? { spellId: id } : {} });
  });

  addEventListener("ui:requestPickup", (e) => {
    const arr = e.detail?.itemIds;
    if (!Array.isArray(arr) || !arr.length) return;
    const handler = resolveRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
    for (const id of arr) {
      if (Number.isInteger(id) && id > 0) {
        handler({ type: "rules.pickupItem", payload: { itemId: id } });
      }
    }
  });

  addEventListener("ui:requestSpellData", () => {
    const spells = learnedSpells();
    const activeSpellId = ensureActiveSpell();
    try { window.dispatchEvent(new CustomEvent("ui:spellData", { detail: { spells, activeSpellId } })); } catch {}
  });

  addEventListener("ui:selectActiveSpell", (ev) => {
    const spellId = ev?.detail?.spellId;
    if (typeof spellId === "string" && spellId.length) setActiveSpell(spellId);
  });

  addEventListener("ui:requestDrink", (ev) => {
    const itemId = ev?.detail?.itemId;
    if (!Number.isInteger(itemId)) return;
    const handler = resolveRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
    handler({ type: "rules.drinkPotion", payload: { itemId } });
  });

  addEventListener("ui:requestEquip", (ev) => {
    const itemId = ev?.detail?.itemId;
    if (!Number.isInteger(itemId)) return;
    const handler = resolveRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
    handler({ type: "rules.equipItem", payload: { itemId } });
  });

  addEventListener("ui:requestUse", (ev) => {
    const itemId = ev?.detail?.itemId;
    if (!Number.isInteger(itemId)) return;
    const handler = resolveRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
    handler({ type: "rules.useItem", payload: { itemId } });
  });

  return { inputDisposers };
}
