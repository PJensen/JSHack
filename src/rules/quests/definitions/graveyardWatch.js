import { buildCatalogItem } from "../../data/itemCatalogLoader.js";
import { DungeonState } from "../../components/DungeonState.js";
import { NamedIdentity } from "../../components/NamedIdentity.js";
import { Position } from "../../components/Position.js";
import { consumeInventoryIdentity, inventoryHasIdentity } from "../../utils/townEconomy.js";
import { attachEntityToCurrentFloor } from "../../utils/floorEntities.js";
import { addToInventory } from "../../utils/inventoryFacade.js";
import { createItemById } from "../../utils/itemFactory.js";
import { currentDepth, firstPlayerId } from "../../utils/worldAccess.js";
import { emit, setVar } from "../actions.js";
import { registerQuest } from "../registry.js";
import { STARTER_PRIEST_FETCH_QUEST_ID, getQuestRecord } from "../runtime.js";

const STARTER_FETCH_ITEM_ID = "book_dead";
const STARTER_FETCH_HOOKS_KEY = Symbol.for("jshack:quests:starterFetch:installed");
const REWARD_GOLD = 100;

function playerHasBook(world, playerId) {
  return inventoryHasIdentity(world, playerId, STARTER_FETCH_ITEM_ID, 1);
}

function pickedUpBook(world, itemId) {
  const ni = world.get(itemId, NamedIdentity);
  return String(ni?.identity || "") === STARTER_FETCH_ITEM_ID;
}

function currentDownStairPos(world) {
  for (const [, pos, ni] of world.query(Position, NamedIdentity)) {
    if (String(ni?.identity || "") !== "stair_down") continue;
    return { x: pos.x | 0, y: pos.y | 0 };
  }
  for (const [, ds] of world.query(DungeonState)) {
    if (!Array.isArray(ds?.downStairPositions) || ds.downStairPositions.length <= 0) break;
    const first = ds.downStairPositions[0];
    return { x: Number(first?.x || 0) | 0, y: Number(first?.y || 0) | 0 };
  }
  return null;
}

function findBookEntity(world) {
  for (const [id, ni] of world.query(NamedIdentity)) {
    if (String(ni?.identity || "") === STARTER_FETCH_ITEM_ID) return id;
  }
  return 0;
}

export function ensureStarterFetchQuestItem(world) {
  if (currentDepth(world, 0) !== 1) return 0;

  const playerId = firstPlayerId(world);
  if (!(playerId > 0)) return 0;

  const quest = getQuestRecord(world, STARTER_PRIEST_FETCH_QUEST_ID, playerId);
  if (!quest) return 0;
  if (String(quest.state?.status || "active") === "complete") return 0;

  const existing = findBookEntity(world);
  if (existing > 0) return existing;
  if (playerHasBook(world, playerId)) return 0;

  const at = currentDownStairPos(world);
  if (!at) return 0;

  const itemId = buildCatalogItem(world, STARTER_FETCH_ITEM_ID, { count: 1 });
  world.add(itemId, Position, at);
  attachEntityToCurrentFloor(world, itemId);
  return itemId;
}

export function installStarterFetchQuestHooks(world) {
  if (world[STARTER_FETCH_HOOKS_KEY]) return;
  world[STARTER_FETCH_HOOKS_KEY] = true;
  world.on("dungeon:transitioned", ({ depth }) => {
    if ((Number(depth || 0) | 0) !== 1) return;
    ensureStarterFetchQuestItem(world);
  });
}

export const GraveyardWatchQuest = registerQuest({
  id: STARTER_PRIEST_FETCH_QUEST_ID,
  title: "The Book Below",
  version: 1,
  journal: {
    flavorText: "Father Tovin sent you below the graveyard chapel after a funerary volume that should never have been left in the dark this long.",
  },
  vars: {
    accepted: false,
    recovered: false,
    delivered: false,
  },
  nodes: {
    offer: {
      on: {
        "dialog:accepted": [
          {
            guard: (ctx) => {
              return Number(ctx.payload?.playerId || 0) === Number(ctx.bind.player || 0)
                && String(ctx.payload?.questId || "") === STARTER_PRIEST_FETCH_QUEST_ID
                && playerHasBook(ctx.world, ctx.bind.player);
            },
            actions: [
              setVar("accepted", true),
              setVar("recovered", true),
              setVar("delivered", false),
              emit("quest:started", (ctx) => ({
                questId: STARTER_PRIEST_FETCH_QUEST_ID,
                playerId: ctx.bind.player,
                giverId: ctx.bind.giver,
                title: "The Book Below",
              })),
            ],
            to: "report",
          },
          {
            guard: (ctx) => {
              return Number(ctx.payload?.playerId || 0) === Number(ctx.bind.player || 0)
                && String(ctx.payload?.questId || "") === STARTER_PRIEST_FETCH_QUEST_ID;
            },
            actions: [
              setVar("accepted", true),
              setVar("recovered", false),
              setVar("delivered", false),
              emit("quest:started", (ctx) => ({
                questId: STARTER_PRIEST_FETCH_QUEST_ID,
                playerId: ctx.bind.player,
                giverId: ctx.bind.giver,
                title: "The Book Below",
              })),
            ],
            to: "recover",
          },
        ],
      },
    },
    recover: {
      on: {
        "item:pickup": [
          {
            guard: (ctx) => {
              return Number(ctx.payload?.actor || 0) === Number(ctx.bind.player || 0)
                && pickedUpBook(ctx.world, Number(ctx.payload?.itemId || 0) | 0);
            },
            actions: [
              setVar("recovered", true),
              emit("quest:advanced", (ctx) => ({
                questId: STARTER_PRIEST_FETCH_QUEST_ID,
                playerId: ctx.bind.player,
                giverId: ctx.bind.giver,
                objective: "Bring the Book of the Dead back to the priest.",
              })),
            ],
            to: "report",
          },
        ],
      },
    },
    report: {
      on: {
        "dialog:reported": [
          {
            guard: (ctx) => {
              return Number(ctx.payload?.playerId || 0) === Number(ctx.bind.player || 0)
                && String(ctx.payload?.questId || "") === STARTER_PRIEST_FETCH_QUEST_ID
                && Number(ctx.payload?.speakerId || 0) === Number(ctx.bind.giver || 0)
                && playerHasBook(ctx.world, ctx.bind.player);
            },
            actions: [
              (ctx) => {
                consumeInventoryIdentity(ctx.world, ctx.bind.player, STARTER_FETCH_ITEM_ID, 1);
              },
              setVar("delivered", true),
              (ctx) => {
                const playerId = Number(ctx.bind.player || 0) | 0;
                if (playerId > 0) {
                  const goldId = createItemById(ctx.world, "gold", { count: REWARD_GOLD });
                  if (goldId > 0) addToInventory(ctx.world, playerId, goldId);
                }
              },
              emit("quest:completed", (ctx) => ({
                questId: STARTER_PRIEST_FETCH_QUEST_ID,
                playerId: ctx.bind.player,
                giverId: ctx.bind.giver,
                title: "The Book Below",
                rewardGold: REWARD_GOLD,
                at: (() => {
                  const p = ctx.world.get(Number(ctx.bind.player || 0) | 0, Position);
                  return p ? { x: Number(p.x) | 0, y: Number(p.y) | 0 } : null;
                })(),
              })),
            ],
            to: "complete",
          },
        ],
      },
    },
    complete: {
      terminal: true,
    },
  },
});
