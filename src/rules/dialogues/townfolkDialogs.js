import { TOWNFOLK } from "../data/townfolk.js";
import { inventoryHasIdentity } from "../utils/townEconomy.js";
import { getDistrictBulletin } from "../utils/townInterpretationVirtuals.js";
import { registerDialog } from "./registry.js";
import { STARTER_PRIEST_FETCH_QUEST_ID, getQuestRecord } from "../quests/runtime.js";
import { RAT_INFESTATION_QUEST_ID, REQUIRED_RAT_KILLS } from "../quests/definitions/ratInfestation.js";

const PRIEST_FETCH_ITEM_ID = "book_dead";

function priestQuest(world, actorId) {
  return getQuestRecord(world, STARTER_PRIEST_FETCH_QUEST_ID, actorId);
}

function smithAmbientText(ctx, fallback) {
  const bulletin = getDistrictBulletin(ctx.world, "workshop_row");
  if (!bulletin) return fallback;
  if (bulletin.shortageBand === "scarce" || bulletin.shortageBand === "panic") {
    return "Repair queue's gone ugly. No iron worth the name and too many hands asking for steel.";
  }
  if (bulletin.pressureBand === "active" || bulletin.pressureBand === "bleeding") {
    return "Every hammer stroke lands on somebody's worry these days.";
  }
  return fallback;
}

function barkeepAmbientText(ctx, fallback) {
  const bulletin = getDistrictBulletin(ctx.world, "market_green");
  if (!bulletin) return fallback;
  if (bulletin.dangerBand === "dangerous" || bulletin.dangerBand === "closed") {
    return "Travelers are drinking fast and leaving faster. Escort work is all anyone asks after.";
  }
  if (bulletin.shortageBand === "strained" || bulletin.shortageBand === "scarce" || bulletin.shortageBand === "panic") {
    return "Kitchen's running tight tonight. If the stew gets any thinner, it'll learn to walk off on its own.";
  }
  return fallback;
}

function masonAmbientText(ctx, fallback) {
  const bulletin = getDistrictBulletin(ctx.world, "civic_core");
  if (!bulletin) return fallback;
  if (bulletin.opportunities.includes("mason_repairs")) {
    return "Cellars are settling wrong again. Give me dry stone and a free afternoon and I'll keep the town standing.";
  }
  if (bulletin.dangerBand === "dangerous" || bulletin.dangerBand === "closed") {
    return "When the drains groan, walls follow. That's when everyone remembers my name.";
  }
  return fallback;
}

function priestAmbientText(ctx, fallback) {
  const bulletin = getDistrictBulletin(ctx.world, "churchyard");
  if (!bulletin) return fallback;
  if (bulletin.pressureBand === "active" || bulletin.pressureBand === "bleeding") {
    return "The churchyard feels wrong tonight. Keep your prayers short and your lamp trimmed.";
  }
  if (bulletin.shortageBand === "scarce" || bulletin.shortageBand === "panic") {
    return "We are burning incense faster than the market can replace it.";
  }
  return fallback;
}

function ambientTownfolkText(def, ctx) {
  const fallback = String(def?.dialogue || "Good day.");
  switch (String(def?.role || "")) {
    case "smith":
      return smithAmbientText(ctx, fallback);
    case "barkeep":
      return barkeepAmbientText(ctx, fallback);
    case "mason":
      return masonAmbientText(ctx, fallback);
    case "priest":
      return priestAmbientText(ctx, fallback);
    default:
      return fallback;
  }
}

function barkeepQuest(world, actorId) {
  return getQuestRecord(world, RAT_INFESTATION_QUEST_ID, actorId);
}

for (const def of Object.values(TOWNFOLK)) {
  if (def.role === "priest" || def.role === "barkeep") continue;
  registerDialog({
    id: `townfolk:${def.role}`,
    start: "root",
    nodes: {
      root: {
        text: (ctx) => ambientTownfolkText(def, ctx),
        choices: [
          { id: "leave", label: "Goodbye.", close: true },
        ],
      },
    },
  });
}

registerDialog({
  id: "townfolk:barkeep",
  start: "root",
  nodes: {
    root: {
      text: (ctx) => {
        const quest = barkeepQuest(ctx.world, ctx.actorId);
        const state = quest?.state;
        if (!state) return barkeepAmbientText(ctx, "What'll it be?");
        if (String(state.status || "") === "complete") {
          return "Cellar's been quiet since you cleared those rats. Drinks are on me.";
        }
        if (String(state.node || "") === "offer") {
          return "Damn rats have been crawling up from the cellar. " +
            `Kill ${REQUIRED_RAT_KILLS} of the wretches down there and I'll make it worth your while.`;
        }
        if (String(state.node || "") === "hunt") {
          const kills = Number(quest.vars?.data?.killCount || 0);
          return `You've got ${kills} of ${REQUIRED_RAT_KILLS} so far. Keep at it.`;
        }
        if (String(state.node || "") === "report") {
          return "You got them all? Good. I owe you one.";
        }
        return barkeepAmbientText(ctx, "What'll it be?");
      },
      choices: [
        {
          id: "accept_rat_quest",
          label: "I'll clear them out.",
          visible: (ctx) => {
            const quest = barkeepQuest(ctx.world, ctx.actorId);
            return String(quest?.state?.status || "active") === "active"
              && String(quest?.state?.node || "") === "offer";
          },
          emits: [
            {
              name: "dialog:accepted",
              payload: (ctx) => ({
                questId: RAT_INFESTATION_QUEST_ID,
                playerId: ctx.actorId,
                speakerId: ctx.targetId,
              }),
            },
          ],
          to: "accept_ack",
        },
        {
          id: "turn_in_rats",
          label: "The rats are dead.",
          visible: (ctx) => {
            const quest = barkeepQuest(ctx.world, ctx.actorId);
            return String(quest?.state?.status || "active") === "active"
              && String(quest?.state?.node || "") === "report";
          },
          emits: [
            {
              name: "dialog:reported",
              payload: (ctx) => ({
                questId: RAT_INFESTATION_QUEST_ID,
                playerId: ctx.actorId,
                speakerId: ctx.targetId,
              }),
            },
          ],
          to: "report_ack",
        },
        {
          id: "progress",
          label: "How many more?",
          visible: (ctx) => {
            const quest = barkeepQuest(ctx.world, ctx.actorId);
            return String(quest?.state?.status || "active") === "active"
              && String(quest?.state?.node || "") === "hunt";
          },
          to: "progress_reminder",
        },
        {
          id: "leave",
          label: "Goodbye.",
          close: true,
        },
      ],
    },
    accept_ack: {
      text: "Head down through the hatch in the back. Take this bow and arrows — there are bats down there too.",
      choices: [
        { id: "leave", label: "I'll be back.", close: true },
      ],
    },
    progress_reminder: {
      text: (ctx) => {
        const quest = barkeepQuest(ctx.world, ctx.actorId);
        const kills = Number(quest?.vars?.data?.killCount || 0);
        const remaining = REQUIRED_RAT_KILLS - kills;
        return `${remaining} more to go. The cellar hatch is right here in the tavern.`;
      },
      choices: [
        { id: "leave", label: "On it.", close: true },
      ],
    },
    report_ack: {
      text: "That's a load off my mind. Here — 75 gold and a hot meal on the house.",
      choices: [
        { id: "leave", label: "Cheers.", close: true },
      ],
    },
  },
});

registerDialog({
  id: "townfolk:priest",
  start: "root",
  nodes: {
    root: {
      text: (ctx) => {
        const quest = priestQuest(ctx.world, ctx.actorId);
        const state = quest?.state;
        if (!state) return priestAmbientText(ctx, "May the gods watch over you.");
        if (String(state.status || "") === "complete") {
          return "You brought back the old volume. I will keep it out of hungry hands.";
        }
        if (String(state.node || "") === "offer") {
          const prefix = priestAmbientText(ctx, "");
          const base = "There is an old book below the church stairs. Bring me the Book of the Dead, and do not linger with it.";
          return prefix ? `${prefix} ${base}` : base;
        }
        if (String(state.node || "") === "recover") {
          return "Go below and search the first dungeon level. The book should lie near the deeper stair.";
        }
        if (String(state.node || "") === "report") {
          if (inventoryHasIdentity(ctx.world, ctx.actorId, PRIEST_FETCH_ITEM_ID, 1)) {
            return "You found it. Hand it here, and I will see it warded.";
          }
          return "You had the book in hand once. Find it again and bring it directly to me.";
        }
        return "May the gods watch over you.";
      },
      choices: [
        {
          id: "accept_priest_fetch",
          label: "I will bring it back.",
          visible: (ctx) => {
            const quest = priestQuest(ctx.world, ctx.actorId);
            return String(quest?.state?.status || "active") === "active"
              && String(quest?.state?.node || "") === "offer";
          },
          emits: [
            {
              name: "dialog:accepted",
              payload: (ctx) => ({
                questId: STARTER_PRIEST_FETCH_QUEST_ID,
                playerId: ctx.actorId,
                speakerId: ctx.targetId,
              }),
            },
          ],
          to: "accept_ack",
        },
        {
          id: "turn_in_priest_fetch",
          label: "Here is the book.",
          visible: (ctx) => {
            const quest = priestQuest(ctx.world, ctx.actorId);
            return String(quest?.state?.status || "active") === "active"
              && String(quest?.state?.node || "") === "report"
              && inventoryHasIdentity(ctx.world, ctx.actorId, PRIEST_FETCH_ITEM_ID, 1);
          },
          emits: [
            {
              name: "dialog:reported",
              payload: (ctx) => ({
                questId: STARTER_PRIEST_FETCH_QUEST_ID,
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
              && String(quest?.state?.node || "") === "recover";
          },
          to: "recover_reminder",
        },
        {
          id: "lost_book",
          label: "I still need to find it.",
          visible: (ctx) => {
            const quest = priestQuest(ctx.world, ctx.actorId);
            return String(quest?.state?.status || "active") === "active"
              && String(quest?.state?.node || "") === "report"
              && !inventoryHasIdentity(ctx.world, ctx.actorId, PRIEST_FETCH_ITEM_ID, 1);
          },
          to: "lost_reminder",
        },
        {
          id: "leave",
          label: "Goodbye.",
          close: true,
        },
      ],
    },
    accept_ack: {
      text: "The stair below the church will take you there. Bring the book back intact.",
      choices: [
        { id: "leave", label: "I will return.", close: true },
      ],
    },
    recover_reminder: {
      text: "Go below the church and search the first dungeon floor. The deeper stair is the likeliest place for it.",
      choices: [
        { id: "leave", label: "Understood.", close: true },
      ],
    },
    lost_reminder: {
      text: "Do not come back empty-handed. Find the book and put it into my hands.",
      choices: [
        { id: "leave", label: "Understood.", close: true },
      ],
    },
    report_ack: {
      text: "Good. I will lock it away before sunset. Here — 100 gold from the parish coffers. You have earned it.",
      choices: [
        { id: "leave", label: "Goodbye.", close: true },
      ],
    },
  },
});
