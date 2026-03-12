import { emit, setVar } from "../actions.js";
import { registerQuest } from "../registry.js";
import { STARTER_GRAVEYARD_QUEST_ID, isPlayerNearIdentity } from "../runtime.js";

export const GraveyardWatchQuest = registerQuest({
  id: STARTER_GRAVEYARD_QUEST_ID,
  title: "Quiet the Graveyard",
  version: 1,
  vars: {
    seenGraves: false,
    reported: false,
  },
  nodes: {
    offer: {
      on: {
        "dialog:accepted": [
          {
            guard: (ctx) => {
              return Number(ctx.payload?.playerId || 0) === Number(ctx.bind.player || 0)
                && String(ctx.payload?.questId || "") === STARTER_GRAVEYARD_QUEST_ID;
            },
            actions: [
              setVar("seenGraves", false),
              setVar("reported", false),
              emit("quest:started", (ctx) => ({
                questId: STARTER_GRAVEYARD_QUEST_ID,
                playerId: ctx.bind.player,
                giverId: ctx.bind.giver,
                title: "Quiet the Graveyard",
              })),
            ],
            to: "survey",
          },
        ],
      },
    },
    survey: {
      on: {
        moved: [
          {
            guard: (ctx) => {
              return Number(ctx.payload?.id || 0) === Number(ctx.bind.player || 0)
                && isPlayerNearIdentity(ctx.world, ctx.bind.player, "grave_tombstone", 2);
            },
            actions: [
              setVar("seenGraves", true),
              emit("quest:advanced", (ctx) => ({
                questId: STARTER_GRAVEYARD_QUEST_ID,
                playerId: ctx.bind.player,
                giverId: ctx.bind.giver,
                objective: "Report back to the priest.",
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
                && String(ctx.payload?.questId || "") === STARTER_GRAVEYARD_QUEST_ID
                && Number(ctx.payload?.speakerId || 0) === Number(ctx.bind.giver || 0);
            },
            actions: [
              setVar("reported", true),
              emit("quest:completed", (ctx) => ({
                questId: STARTER_GRAVEYARD_QUEST_ID,
                playerId: ctx.bind.player,
                giverId: ctx.bind.giver,
                title: "Quiet the Graveyard",
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
