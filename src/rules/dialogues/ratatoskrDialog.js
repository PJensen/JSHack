import { createRng } from "../../lib/ecs-js/rng.js";
import { Beatitude } from "../components/Beatitude.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Position } from "../components/Position.js";
import { ShopInventory } from "../components/ShopInventory.js";
import { Unpaid } from "../components/Unpaid.js";
import { getTile, isWalkable } from "../environment/dungeon/tileMap.js";
import { applyStatusEffect } from "../utils/effects.js";
import { addToInventory, inventoryItems } from "../utils/inventoryFacade.js";
import { appraiseItemValue } from "../utils/shopAppraisal.js";
import { currentDepth } from "../utils/worldAccess.js";
import * as shopStock from "../data/shopStock.js";
import { registerDialog } from "./registry.js";

const CACHE_COUNT = 4;
const CACHE_OFFSETS = Object.freeze([
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: -1 },
]);

function seedFor(world, targetId, salt = 0) {
  return (
    (world.seed >>> 0)
    ^ (((world.step | 0) * 0x9e3779b9) >>> 0)
    ^ (((targetId | 0) * 0x85ebca6b) >>> 0)
    ^ (salt >>> 0)
  ) >>> 0;
}

function clearFloorCache(world, shopkeeperId) {
  const dead = [];
  for (const [itemId, unpaid] of world.query(Unpaid)) {
    if ((unpaid.shopkeeperId | 0) === (shopkeeperId | 0) && world.has(itemId, Position)) dead.push(itemId);
  }
  for (const itemId of inventoryItems(world, shopkeeperId)) {
    const unpaid = world.get(itemId, Unpaid);
    if ((unpaid?.shopkeeperId | 0) === (shopkeeperId | 0)) dead.push(itemId);
  }
  for (const itemId of dead) {
    if (world.isAlive(itemId)) world.destroy(itemId);
  }
}

function placementSlots(world, origin) {
  const out = [];
  const ox = Number(origin?.x || 0) | 0;
  const oy = Number(origin?.y || 0) | 0;
  for (const off of CACHE_OFFSETS) {
    const x = ox + off.x;
    const y = oy + off.y;
    if (!isWalkable(x, y)) continue;
    const tile = getTile(x, y);
    if (!(tile >= 0)) continue;
    out.push({ x, y });
  }
  return out.length > 0 ? out : [{ x: ox, y: oy }];
}

export function openRatatoskrCache(world, actorId, targetId) {
  const ratPos = world.get(targetId, Position);
  if (!ratPos) return false;
  if (!world.has(targetId, ShopInventory)) {
    try { world.add(targetId, ShopInventory, { buyMarkup: 3.0, sellDiscount: 0.15 }); } catch {}
  }
  if (!world.has(targetId, Inventory)) {
    try { world.add(targetId, Inventory, { capacity: 12 }); } catch {}
  }

  clearFloorCache(world, targetId);
  const depth = Math.max(8, currentDepth(world, 0) || 8);
  const rng = createRng(seedFor(world, targetId, 0x5a17cafe));
  const slots = placementSlots(world, ratPos);
  let made = 0;

  for (let i = 0; i < CACHE_COUNT; i++) {
    const itemId = shopStock.generateRatatoskrLegendaryItem(world, depth, rng);
    if (!(itemId > 0)) continue;
    const value = appraiseItemValue(world, itemId);
    const price = Math.max(777, Math.ceil(value * 3.0) + (rng.int(0, 6) * 111));
    try { world.add(itemId, Unpaid, { shopkeeperId: targetId, price }); } catch {}
    if (!addToInventory(world, targetId, itemId, { mergeCompatible: false, silent: true })) {
      const slot = slots[i % slots.length];
      world.add(itemId, Position, { x: slot.x, y: slot.y });
    }
    made++;
  }

  if (made <= 0) return false;
  world.emit?.("npc:dialogue", {
    actor: targetId,
    targetId: actorId,
    text: "Ratatoskr shakes impossible treasure out of his tail.",
  });
  world.emit?.("shop:open", {
    actor: actorId,
    targetId,
    buyMarkup: 3.0,
    sellDiscount: 0.15,
    vendorKind: "travellingVendor",
    vendorLabel: "Ratatoskr",
  });
  return true;
}

export function acceptRatatoskrBargain(world, actorId, targetId) {
  const ratPos = world.get(targetId, Position);
  const actorPos = world.get(actorId, Position);
  const depth = Math.max(8, currentDepth(world, 0) || 8);
  const rng = createRng(seedFor(world, targetId, 0xbadf00d));
  const itemId = shopStock.generateRatatoskrLegendaryItem(world, depth, rng);
  if (!(itemId > 0)) return false;

  try {
    world.add(itemId, Beatitude, { state: "cursed" });
  } catch {
    const beat = world.get(itemId, Beatitude);
    if (beat) beat.state = "cursed";
  }

  const info = world.get(itemId, ItemInfo);
  if (info) {
    world.mutate(itemId, ItemInfo, rec => {
      rec.identified = true;
      rec.value = Math.max(Number(rec.value || 0) | 0, 1);
    });
  }

  applyStatusEffect(world, actorId, {
    key: "cursed",
    turnsLeft: 666,
    potency: 2,
    stacks: 1,
    sourceId: targetId,
    sourceKind: "ratatoskr",
    sourceKey: "branch_bargain",
  });

  if (!addToInventory(world, actorId, itemId, { mergeCompatible: false })) {
    const drop = actorPos || ratPos || { x: 0, y: 0 };
    world.add(itemId, Position, { x: drop.x | 0, y: drop.y | 0 });
  }

  world.emit?.("npc:dialogue", {
    actor: targetId,
    targetId: actorId,
    text: "Done. One root remembers your name now. Try not to dream downward.",
  });
  world.emit?.("status", {
    id: actorId,
    kind: "curse",
    effect: "cursed",
    text: "A bargain takes root under your skin.",
  });
  return true;
}

export function registerRatatoskrDialog() {
  registerDialog({
    id: "norse:ratatoskr",
    start: "root",
    presentation: "overlay",
    maxDistance: 2,
    nodes: {
      root: {
        text: "Ratatoskr chatters in three directions at once. 'Up-root news, down-root slander, middle-root bargains. Choose quickly; I owe an eagle an insult.'",
        choices: [
          {
            id: "open_cache",
            label: "Show me the impossible cache.",
            onSelect: (ctx) => openRatatoskrCache(ctx.world, ctx.actorId, ctx.targetId),
            close: true,
          },
          {
            id: "branch_bargain",
            label: "I accept a curse for a legend.",
            onSelect: (ctx) => acceptRatatoskrBargain(ctx.world, ctx.actorId, ctx.targetId),
            close: true,
          },
          {
            id: "insane_errand",
            label: "Give me the worst errand.",
            to: "errand",
          },
          {
            id: "leave",
            label: "Not today.",
            close: true,
          },
        ],
      },
      errand: {
        text: "He leans close. 'Bring me a lie told by a dead king, a door opened by drowning, and the left footprint of someone who never existed. Payment: probably thunder.'",
        choices: [
          {
            id: "accept_errand",
            label: "That sounds actionable.",
            onSelect(ctx) {
              ctx.world.emit?.("npc:dialogue", {
                actor: ctx.targetId,
                targetId: ctx.actorId,
                text: "Excellent. You already failed the first step by believing me.",
              });
            },
            close: true,
          },
          {
            id: "back",
            label: "Back to real bargains.",
            to: "root",
          },
        ],
      },
    },
  });
}

registerRatatoskrDialog();
