import { TOWNFOLK } from "../data/townfolk.js";
import { registerDialog } from "./registry.js";
import { STARTER_GRAVEYARD_QUEST_ID, getQuestRecord } from "../quests/runtime.js";

function priestQuest(world, actorId) {
  return getQuestRecord(world, STARTER_GRAVEYARD_QUEST_ID, actorId);
}

for (const def of Object.values(TOWNFOLK)) {
  if (def.role === "priest") continue;
  registerDialog({
    id: `townfolk:${def.role}`,
    start: "root",
    nodes: {
      root: {
        text: def.dialogue,
        choices: [
          { id: "leave", label: "Goodbye.", close: true },
        ],
      },
    },
  });
}

registerDialog({
  id: "townfolk:priest",
  start: "root",
  nodes: {
    root: {
      text: (ctx) => {
        const quest = priestQuest(ctx.world, ctx.actorId);
        const state = quest?.state;
        if (!state) return "May the gods watch over you.";
        if (String(state.status || "") === "complete") {
          return "The graves still for now. The town owes you a kindness.";
        }
        if (String(state.node || "") === "offer") {
          return "The old graveyard has not been quiet. Will you look to the crypt for me?";
        }
        if (String(state.node || "") === "survey") {
          return "Go north, past the church. See what stirs among the stones, then return.";
        }
        if (String(state.node || "") === "report") {
          return "You have seen the graves. Tell me plainly: what did you find?";
        }
        return "May the gods watch over you.";
      },
      choices: [
        {
          id: "accept_graveyard_watch",
          label: "I will inspect the crypt.",
          visible: (ctx) => {
            const quest = priestQuest(ctx.world, ctx.actorId);
            return String(quest?.state?.status || "active") === "active"
              && String(quest?.state?.node || "") === "offer";
          },
          emits: [
            {
              name: "dialog:accepted",
              payload: (ctx) => ({
                questId: STARTER_GRAVEYARD_QUEST_ID,
                playerId: ctx.actorId,
                speakerId: ctx.targetId,
              }),
            },
          ],
          to: "accept_ack",
        },
        {
          id: "report_graveyard_watch",
          label: "The graves are restless.",
          visible: (ctx) => {
            const quest = priestQuest(ctx.world, ctx.actorId);
            return String(quest?.state?.status || "active") === "active"
              && String(quest?.state?.node || "") === "report";
          },
          emits: [
            {
              name: "dialog:reported",
              payload: (ctx) => ({
                questId: STARTER_GRAVEYARD_QUEST_ID,
                playerId: ctx.actorId,
                speakerId: ctx.targetId,
              }),
            },
          ],
          to: "report_ack",
        },
        {
          id: "reminder",
          label: "Remind me what to do.",
          visible: (ctx) => {
            const quest = priestQuest(ctx.world, ctx.actorId);
            return String(quest?.state?.status || "active") === "active"
              && String(quest?.state?.node || "") === "survey";
          },
          to: "survey_reminder",
        },
        {
          id: "leave",
          label: "Goodbye.",
          close: true,
        },
      ],
    },
    accept_ack: {
      text: "Go carefully. Return once you have looked upon the old graves yourself.",
      choices: [
        { id: "leave", label: "I will return.", close: true },
      ],
    },
    survey_reminder: {
      text: "Follow the path north of the church. Look among the tombs, then come back to me.",
      choices: [
        { id: "leave", label: "Understood.", close: true },
      ],
    },
    report_ack: {
      text: "Then we will keep the lamps lit and the doors barred. You have done enough for tonight.",
      choices: [
        { id: "leave", label: "Goodbye.", close: true },
      ],
    },
  },
});
