import { NamedIdentity } from "../../components/NamedIdentity.js";
import { Position } from "../../components/Position.js";
import { QuestVars } from "../../components/QuestVars.js";
import { getMonster } from "../../data/monsters.js";
import { createItemById } from "../../utils/itemFactory.js";
import { addToInventory } from "../../utils/inventoryFacade.js";
import { spawnMonsterEntity } from "../../utils/spawnMonsterEntity.js";
import { emitSafe } from "../../utils/emitSafe.js";
import { firstPlayerId } from "../../utils/worldAccess.js";
import { isWalkable } from "../../environment/dungeon/tileMap.js";
import { emit, incVar, setVar } from "../actions.js";
import { registerQuest } from "../registry.js";
import { getQuestRecord } from "../runtime.js";

export const RAT_INFESTATION_QUEST_ID = "starter.rat_infestation";
export const REQUIRED_RAT_KILLS = 5;
const REWARD_GOLD = 75;

const RAT_HOOKS_KEY = Symbol.for("jshack:quests:ratInfestation:installed");

function isRat(world, entityId) {
  const ni = world.get(entityId, NamedIdentity);
  return String(ni?.identity || "") === "rat";
}

function killCount(world, qid) {
  const rec = world.get(qid, QuestVars);
  return Number(rec?.data?.killCount || 0);
}

function ratProgressPayload(ctx) {
  const playerId = Number(ctx.bind.player || 0) | 0;
  const pos = playerId > 0 ? ctx.world.get(playerId, Position) : null;
  return {
    questId: RAT_INFESTATION_QUEST_ID,
    playerId,
    progress: killCount(ctx.world, ctx.qid),
    target: REQUIRED_RAT_KILLS,
    label: "RATS",
    at: pos ? { x: Number(pos.x) | 0, y: Number(pos.y) | 0 } : null,
  };
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
  journal: {
    flavorText: "The barkeep is tired of hearing claws in the cellar walls. He wants the infestation culled before the tavern loses its stores.",
    rewardItems: [
      { label: "a hot stew from the barkeep", count: 1 },
    ],
  },
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
              (ctx) => {
                const giverId = Number(ctx.bind.giver || 0);
                if (!(giverId > 0)) return;
                const giverPos = ctx.world.get(giverId, Position);
                if (!giverPos) return;
                if (!Number.isFinite(giverPos.x) || !Number.isFinite(giverPos.y)) return;
                const x = giverPos.x | 0;
                const y = giverPos.y | 0;

                const bowId = createItemById(ctx.world, "bow_short");
                if (bowId > 0) {
                  ctx.world.add(bowId, Position, { x, y });
                  emitSafe(ctx.world, "item:dropped", { itemId: bowId, count: 1, at: { x, y } });
                }

                const arrowsId = createItemById(ctx.world, "ammo_arrows", { count: 20 });
                if (arrowsId > 0) {
                  ctx.world.add(arrowsId, Position, { x, y });
                  emitSafe(ctx.world, "item:dropped", { itemId: arrowsId, count: 20, at: { x, y } });
                }

                // Beat 1: hand over the gear
                emitSafe(ctx.world, "npc:dialogue", {
                  actor: giverId,
                  targetId: Number(ctx.bind.player || 0) | 0,
                  text: "take this — there are bats down there too.",
                });

                // Spawn a rat inside the tavern near the barkeep
                if (Number.isFinite(x) && Number.isFinite(y)) {
                  const offsets = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
                  for (const [dx, dy] of offsets) {
                    const rx = x + dx;
                    const ry = y + dy;
                    if (isWalkable(rx, ry)) {
                      const def = getMonster("rat");
                      if (def) {
                        spawnMonsterEntity(ctx.world, {
                          x: rx, y: ry,
                          name: def.name,
                          identity: def.id,
                          maxHp: def.baseHp,
                          faction: "enemy",
                          naturalDamageDice: def.damageDice,
                          sizeClass: def.sizeClass,
                          massKg: def.massKg,
                          resistances: def.resistances,
                          speed: def.speed,
                        });
                      }
                      break;
                    }
                  }
                }

                // Beat 2: react to the rat
                if (Number.isFinite(x) && Number.isFinite(y)) {
                  emitSafe(ctx.world, "npc:dialogue", {
                    actor: giverId,
                    targetId: Number(ctx.bind.player || 0) | 0,
                    text: "there's one! Kill it!",
                  });
                }
              },
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
              emit("quest:progress", ratProgressPayload),
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
              emit("quest:progress", ratProgressPayload),
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
                const playerId = Number(ctx.bind.player || 0) | 0;
                if (playerId > 0) {
                  const goldId = createItemById(ctx.world, "gold", { count: REWARD_GOLD });
                  if (goldId > 0) addToInventory(ctx.world, playerId, goldId);
                }
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
