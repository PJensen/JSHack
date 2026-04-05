import { createFrom } from "../../../lib/ecs-js/archetype.js";
import { GoldStack } from "../../archetypes/Items.js";
import { ItemInfo } from "../../components/ItemInfo.js";
import { NamedIdentity } from "../../components/NamedIdentity.js";
import { Player } from "../../components/Player.js";
import { Position } from "../../components/Position.js";
import { QuestVars } from "../../components/QuestVars.js";
import { createItemById } from "../../utils/itemFactory.js";
import { emitSafe } from "../../utils/emitSafe.js";
import { emit, incVar, setVar } from "../actions.js";
import { registerQuest } from "../registry.js";
import { getQuestRecord } from "../runtime.js";

export const RAT_INFESTATION_QUEST_ID = "starter.rat_infestation";
export const REQUIRED_RAT_KILLS = 5;
const REWARD_GOLD = 75;

const RAT_HOOKS_KEY = Symbol.for("jshack:quests:ratInfestation:installed");

function firstPlayerId(world) {
  for (const [id] of world.query(Player)) return id;
  return 0;
}

function isRat(world, entityId) {
  const ni = world.get(entityId, NamedIdentity);
  return String(ni?.identity || "") === "rat";
}

function killCount(world, qid) {
  const rec = world.get(qid, QuestVars);
  return Number(rec?.data?.killCount || 0);
}

export function installRatQuestHooks(world) {
  if (world[RAT_HOOKS_KEY]) return;
  world[RAT_HOOKS_KEY] = true;
  world.on("died", (payload) => {
    const killerId = Number(payload?.killer || 0) | 0;
    const victimId = Number(payload?.id || 0) | 0;
    if (!(killerId > 0) || !(victimId > 0)) return;
    if (!isRat(world, victimId)) return;

    const playerId = firstPlayerId(world);
    if (killerId !== playerId) return;

    const quest = getQuestRecord(world, RAT_INFESTATION_QUEST_ID, playerId);
    if (!quest) return;
    if (String(quest.state?.status || "active") !== "active") return;
    if (String(quest.state?.node || "") !== "hunt") return;

    world.emit("rat:killed", { playerId, victimId });
  });
}

export const RatInfestationQuest = registerQuest({
  id: RAT_INFESTATION_QUEST_ID,
  title: "Rat Infestation",
  version: 1,
  vars: {
    accepted: false,
    killCount: 0,
    reported: false,
  },
  nodes: {
    offer: {
      on: {
        "dialog:accepted": [
          {
            guard: (ctx) => {
              return Number(ctx.payload?.playerId || 0) === Number(ctx.bind.player || 0)
                && String(ctx.payload?.questId || "") === RAT_INFESTATION_QUEST_ID;
            },
            actions: [
              setVar("accepted", true),
              setVar("killCount", 0),
              emit("quest:started", (ctx) => ({
                questId: RAT_INFESTATION_QUEST_ID,
                playerId: ctx.bind.player,
                giverId: ctx.bind.giver,
                title: "Rat Infestation",
              })),
            ],
            to: "hunt",
          },
        ],
      },
    },
    hunt: {
      on: {
        "rat:killed": [
          // Threshold reached — transition to report
          {
            guard: (ctx) => {
              return Number(ctx.payload?.playerId || 0) === Number(ctx.bind.player || 0)
                && killCount(ctx.world, ctx.qid) >= REQUIRED_RAT_KILLS - 1;
            },
            actions: [
              incVar("killCount", 1),
              emit("quest:advanced", (ctx) => ({
                questId: RAT_INFESTATION_QUEST_ID,
                playerId: ctx.bind.player,
                giverId: ctx.bind.giver,
                objective: "Return to the barkeep.",
              })),
            ],
            to: "report",
          },
          // Not enough yet — stay in hunt
          {
            guard: (ctx) => {
              return Number(ctx.payload?.playerId || 0) === Number(ctx.bind.player || 0);
            },
            actions: [
              incVar("killCount", 1),
            ],
            to: "hunt",
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
                && String(ctx.payload?.questId || "") === RAT_INFESTATION_QUEST_ID
                && Number(ctx.payload?.speakerId || 0) === Number(ctx.bind.giver || 0);
            },
            actions: [
              setVar("reported", true),
              (ctx) => {
                const giverId = Number(ctx.bind.giver || 0);
                const giverPos = giverId > 0 ? ctx.world.get(giverId, Position) : null;
                const x = giverPos?.x ?? 0;
                const y = giverPos?.y ?? 0;
                // Drop gold at the giver's feet
                const gid = createFrom(ctx.world, GoldStack, {});
                ctx.world.mutate(gid, ItemInfo, (r) => { r.count = REWARD_GOLD; });
                ctx.world.add(gid, Position, { x, y });
                emitSafe(ctx.world, 'item:dropped', { itemId: gid, count: REWARD_GOLD, at: { x, y } });
                // Drop a hot meal
                const stewId = createItemById(ctx.world, "food_stew");
                if (stewId > 0) {
                  ctx.world.add(stewId, Position, { x, y });
                  emitSafe(ctx.world, 'item:dropped', { itemId: stewId, count: 1, at: { x, y } });
                }
              },
              emit("quest:completed", (ctx) => ({
                questId: RAT_INFESTATION_QUEST_ID,
                playerId: ctx.bind.player,
                giverId: ctx.bind.giver,
                title: "Rat Infestation",
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
