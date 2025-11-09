import { setupInput } from "../../display/input/InputRouter.js";
import { enableInputLockdown } from "../../display/input/lockdown.js";
import { makeRulesDispatcher } from "../../../app/input/rulesDispatch.js";
import { initOverlays } from "../../display/ui/overlay.js";
import { initHUD } from "../../display/ui/hud.js";
import { Inventory } from "../../rules/components/Inventory.js";
import { Position } from "../../rules/components/Position.js";
import { Equipment } from "../../rules/components/Equipment.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Settings } from "../../rules/components/Settings.js";
import { Anatomy } from "../../rules/components/Anatomy.js";
import { BoundingCircle } from "../../rules/components/BoundingCircle.js";
import { Vitality } from "../../rules/components/Vitality.js";
import { itemsAt, playerEntity } from "../../rules/utils/queries.js";
import { zoomTo } from "../../display/camera/utils.js";
import { Facing } from "../../rules/components/Facing.js";

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

  // Simple spell targeting latch for Meteor
  let _meteorTargeting = null; // { vx, vy }

  /**
   * Maps an arbitrary direction vector to the nearest 8-direction grid step.
   * @param {number} dx
   * @param {number} dy
   */
  const resolveGridStep = (dx, dy) => {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return { dx: 0, dy: 0 };
    const len = Math.hypot(dx, dy);
    if (len <= 1e-5) return { dx: 0, dy: 0 };
    const nx = dx / len;
    const ny = dy / len;
    const absX = Math.abs(nx);
    const absY = Math.abs(ny);
    const horizontalBias = absY > 1e-5 ? absX / absY : Infinity;
    const verticalBias = absX > 1e-5 ? absY / absX : Infinity;
    const ORTHO_BIAS = 1.2; // favor N/S/E/W when one axis dominates

    if (horizontalBias >= ORTHO_BIAS) {
      return { dx: Math.sign(nx), dy: 0 };
    }
    if (verticalBias >= ORTHO_BIAS) {
      return { dx: 0, dy: Math.sign(ny) };
    }

    const directions = [
      { dx: 1, dy: 1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: -1, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    let best = directions[0];
    let bestDot = -Infinity;
    for (let i = 0; i < directions.length; i++) {
      const dir = directions[i];
      const dot = nx * dir.dx + ny * dir.dy;
      if (dot > bestDot) {
        bestDot = dot;
        best = dir;
      }
    }
    return best;
  };

  const displayHandler = (action) => {
    switch (action.type) {
      case "display.tapWorld": {
        const wx = (typeof action?.payload?.x === "number") ? action.payload.x : NaN;
        const wy = (typeof action?.payload?.y === "number") ? action.payload.y : NaN;
        const pe = playerEntity(world);
        if (!pe) break;
        if (Number.isFinite(wx) && Number.isFinite(wy)) {
          // If meteor targeting is armed, cast at tapped location
          if (_meteorTargeting) {
            const handler = resolveRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
            handler({ type: "rules.castActiveSpell", payload: { spellId: "meteor", x: wx, y: wy, vx: _meteorTargeting.vx, vy: _meteorTargeting.vy } });
            _meteorTargeting = null;
            break;
          }
          // Keep tap-to-move by default; only shoot if: tap hits monster AND player is ranged (bow equipped)
          let tappedMonster = null; let minCenter = Infinity;
          for (const [id, pos, ni, vit] of world.query(Position, NamedIdentity, Vitality)) {
            if (!ni || ni.identity !== 'monster') continue;
            if (!vit || (vit.hp|0) <= 0) continue;
            const baseR = Math.max(0, world.get(id, BoundingCircle)?.radius ?? 0.45);
            const pxMin = 18; // mobile-friendly minimum in screen pixels
            const worldMin = tileSize && tileSize > 0 ? (pxMin / tileSize) : 0.0;
            const hitR = Math.max(baseR * 0.9, worldMin);
            const centerDist = Math.hypot(pos.x - wx, pos.y - wy);
            if (centerDist <= hitR && centerDist < minCenter) { minCenter = centerDist; tappedMonster = id; }
          }

          // Check if player is ranged-only (bow equipped)
          let isRanged = false;
          const eq = world.get(pe.id, Equipment);
          if (eq && Number.isInteger(eq.weapon) && eq.weapon > 0) {
            const wName = world.get(eq.weapon, NamedIdentity);
            if (wName && typeof wName.identity === 'string' && wName.identity.startsWith('bow_')) isRanged = true;
          }

          // Facing + FOV cone check: ensure monster sits within the visible arc
          const facingComp = world.get(pe.id, Facing) || { x: 1, y: 0 };
          const baseAngle = Math.atan2(facingComp.y || 0, facingComp.x || 1);
          const halfFov = Math.PI * 0.75 * 0.5; // match display FOV
          let inFront = false;
          if (tappedMonster) {
            const fx = world.get(pe.id, Facing) || { x: 1, y: 0 };
            const ppos = world.get(pe.id, Position);
            const tpos = world.get(tappedMonster, Position);
            if (ppos && tpos) {
              const dx = tpos.x - ppos.x, dy = tpos.y - ppos.y;
              const len = Math.hypot(dx, dy) || 1;
              const dot = (dx/len) * (fx.x||1) + (dy/len) * (fx.y||0);
              const CONE_DOT = Math.cos(halfFov);
              const ang = Math.atan2(dy, dx);
              let diff = ang - baseAngle;
              diff = Math.atan2(Math.sin(diff), Math.cos(diff));
              inFront = dot >= CONE_DOT && Math.abs(diff) <= (halfFov + 1e-3);
            }
          }

          if (tappedMonster && isRanged && inFront) {
            const handler = resolveRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
            handler({ type: "rules.shootRangedAt", payload: { targetId: tappedMonster } });
            break;
          }

          if (tappedMonster && isRanged) {
            const tpos = world.get(tappedMonster, Position);
            if (tpos) {
              const handler = resolveRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
              handler({ type: "rules.face", payload: { toX: tpos.x, toY: tpos.y } });
              break;
            }
          }

          // Default: move toward tap
          const dx = wx - pe.pos.x;
          const dy = wy - pe.pos.y;
          const step = resolveGridStep(dx, dy);
          const handler = resolveRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
          handler({ type: "rules.move", payload: { dx: step.dx, dy: step.dy } });
        }
        break;
      }
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
        // Prefer items on the current tile
        let ids = itemsAt(world, p.pos.x, p.pos.y);
        if (ids.length === 0) {
          // Fallback: pick nearest reachable item (keyboard-friendly)
          const playerSettings = world.get(p.id, Settings);
          const anatomy = world.get(p.id, Anatomy);
          const reach = Math.max(0, anatomy?.reachDistance ?? 1);
          const radius = Math.max(0, world.get(p.id, BoundingCircle)?.radius ?? 0.5);
          const extraRange = Math.max(0, Number(playerSettings?.pickupRange ?? 0));
          const maxReach = reach + radius + extraRange;
          /** @type {Array<{ id:number, info:any, name:any, distance:number }>} */
          const nearby = [];
          for (const [eid, pos, info] of world.query(Position, ItemInfo)) {
            if (!pos) continue;
            if (!info || info.type === "currency") continue;
            const itemRadius = Math.max(0, world.get(eid, BoundingCircle)?.radius ?? 0);
            const dist = Math.max(0, Math.hypot(pos.x - p.pos.x, pos.y - p.pos.y) - itemRadius);
            if (dist > maxReach) continue;
            nearby.push({ id: eid, info, name: world.get(eid, NamedIdentity), distance: dist });
          }
          nearby.sort((a, b) => a.distance - b.distance);
          if (nearby.length === 0) break;
          if (nearby.length === 1) {
            rulesHandler({ type: "rules.pickupItem", payload: { itemId: nearby[0].id } });
            break;
          }
          // Multiple items nearby: open chooser with nearest-first ordering
          const items = nearby.map(({ id: eid, info, name }) => ({ id: eid, type: info?.type || "item", name: name?.name || info?.type || "item", count: info?.count || 1 }));
          window.dispatchEvent(new CustomEvent("ui:openPickupChooser", { detail: { items } }));
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
    if (id === 'meteor') {
      // Arm targeting flow for meteor when casting via button
      setActiveSpell('meteor');
      _meteorTargeting = { vx: 0, vy: -1 };
      try {
        window.dispatchEvent(new CustomEvent('ui:showSpellGestureHint', { detail: { id: 'meteor', mode: 'cast' } }));
      } catch {}
      return;
    }
    handler({ type: "rules.castActiveSpell", payload: id ? { spellId: id } : {} });
  });

  // Ranged shooting (using equipped ranged weapon)
  addEventListener("ui:shootRanged", () => {
    const handler = resolveRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
    handler({ type: "rules.shootRanged" });
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

  const knowsLightning = () => learnedSpells().some((s) => s?.id === "lightning");
  const knowsMeteor = () => learnedSpells().some((s) => s?.id === "meteor");
  const knowsBlastwave = () => learnedSpells().some((s) => s?.id === "blastwave");

  const onSpellGesture = (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const id = e?.detail?.id;
    if (id === "lightning") {
      // If player has Blast Wave and it is selected, cast that instead (same gesture)
      const activeId = typeof activeSpells.getActiveSpellId === 'function' ? activeSpells.getActiveSpellId() : null;
      const shouldBlast = (activeId === 'blastwave') && knowsBlastwave();
      const spellId = shouldBlast ? 'blastwave' : 'lightning';
      if (spellId === 'lightning' && !knowsLightning()) return;
      if (spellId === 'blastwave' && !knowsBlastwave()) return;
      setActiveSpell(spellId);
      const handler = resolveRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
      handler({ type: "rules.castActiveSpell", payload: { spellId } });
      try {
        window.dispatchEvent(new CustomEvent("ui:showSpellGestureHint", {
          detail: { id: spellId, mode: "cast", quality: e?.detail?.quality ?? null }
        }));
      } catch {}
      return;
    }

    if (id === "meteor") {
      if (!knowsMeteor()) return;
      setActiveSpell("meteor");
      // Arm targeting with direction vector approximated from worldPath (start->end)
      const wpts = Array.isArray(e?.detail?.worldPath) ? e.detail.worldPath : null;
      let vx = 0, vy = -1;
      if (wpts && wpts.length >= 2) {
        const a = wpts[0], b = wpts[wpts.length - 1];
        const dx = b.x - a.x; const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        vx = dx / len; vy = dy / len;
      }
      _meteorTargeting = { vx, vy };
      // Show a hint to tap target; reuse gesture hint UI if present
      try {
        window.dispatchEvent(new CustomEvent("ui:showSpellGestureHint", {
          detail: { id: "meteor", mode: "cast", quality: e?.detail?.quality ?? null }
        }));
      } catch {}
      return;
    }
  };

  window.addEventListener("input:spellGesture", onSpellGesture);
  inputDisposers.push(() => window.removeEventListener("input:spellGesture", onSpellGesture));

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
