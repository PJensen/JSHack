import { DungeonState } from "../../components/DungeonState.js";
import { NamedIdentity } from "../../components/NamedIdentity.js";
import { Position } from "../../components/Position.js";
import { QuestVars } from "../../components/QuestVars.js";
import { RunObjectiveTarget } from "../../components/RunObjectiveTarget.js";
import { attachEntityToCurrentFloor } from "../../utils/floorEntities.js";
import { buildCatalogItem } from "../../data/itemCatalogLoader.js";
import { createItemById } from "../../utils/itemFactory.js";
import { getCatalogItem } from "../../data/itemCatalog.js";
import { getMonster } from "../../data/monsters.js";
import { createRng } from "../../utils/rng.js";
import { spawnMonsterEntity } from "../../utils/spawnMonsterEntity.js";
import { inventoryHasIdentity } from "../../utils/townEconomy.js";
import { emitSafe } from "../../utils/emitSafe.js";
import { addToInventory } from "../../utils/inventoryFacade.js";
import { emit, setVar } from "../actions.js";
import { registerQuest } from "../registry.js";
import { ensureQuestRuntimeEventRoutes, findQuestEntity, getQuestRecord, instantiateQuest } from "../runtime.js";
import { isWalkable } from "../../environment/dungeon/tileMap.js";

export const RUN_CONTRACT_QUEST_ID = "run.contract";

const RUN_CONTRACT_HOOKS_KEY = Symbol.for("jshack:quests:runContract:installed");

const BOSS_POOL = Object.freeze([
  Object.freeze({ monsterId: "bandit_captain", minDepth: 2, maxDepth: 4, hpMult: 1.6, acc: 2, dmg: 2, evade: 1 }),
  Object.freeze({ monsterId: "orc_warchief", minDepth: 3, maxDepth: 5, hpMult: 1.7, acc: 2, dmg: 2, evade: 1 }),
  Object.freeze({ monsterId: "troll", minDepth: 4, maxDepth: 6, hpMult: 1.65, acc: 1, dmg: 3, evade: 0 }),
  Object.freeze({ monsterId: "wraith", minDepth: 4, maxDepth: 6, hpMult: 1.5, acc: 2, dmg: 2, evade: 2 }),
  Object.freeze({ monsterId: "dark_acolyte", minDepth: 4, maxDepth: 6, hpMult: 1.45, acc: 2, dmg: 2, evade: 1 }),
  Object.freeze({ monsterId: "lich", minDepth: 5, maxDepth: 7, hpMult: 1.45, acc: 3, dmg: 3, evade: 2 }),
  Object.freeze({ monsterId: "demon", minDepth: 5, maxDepth: 7, hpMult: 1.5, acc: 3, dmg: 3, evade: 1 }),
]);

const BOSS_FIRST_NAMES = Object.freeze([
  "Kharos",
  "Mournfang",
  "Vel",
  "Grimsaint",
  "Ashknot",
  "Yrsa",
  "Torvek",
  "Nerez",
]);

const BOSS_TITLES = Object.freeze([
  "the Black",
  "the Hungering",
  "the Hollow",
  "the Grave-Bound",
  "the Collector",
  "the Ash-Eyed",
  "the Red Hand",
  "the Quiet Blade",
]);

const RELIC_POOL = Object.freeze([
  Object.freeze({
    itemId: "relic_ember_censer",
    title: "Ember Censer",
    objectiveNoun: "the Ember Censer",
  }),
  Object.freeze({
    itemId: "relic_glass_heart",
    title: "Glass Heart",
    objectiveNoun: "the Glass Heart",
  }),
  Object.freeze({
    itemId: "relic_pale_idol",
    title: "Pale Idol",
    objectiveNoun: "the Pale Idol",
  }),
  Object.freeze({
    itemId: "relic_stone_tongue",
    title: "Stone Tongue",
    objectiveNoun: "the Stone Tongue",
  }),
]);

const SPAWN_OFFSETS = Object.freeze([
  Object.freeze([0, 0]),
  Object.freeze([1, 0]),
  Object.freeze([-1, 0]),
  Object.freeze([0, 1]),
  Object.freeze([0, -1]),
  Object.freeze([2, 0]),
  Object.freeze([-2, 0]),
  Object.freeze([0, 2]),
  Object.freeze([0, -2]),
  Object.freeze([1, 1]),
  Object.freeze([1, -1]),
  Object.freeze([-1, 1]),
  Object.freeze([-1, -1]),
  Object.freeze([2, 1]),
  Object.freeze([2, -1]),
  Object.freeze([-2, 1]),
  Object.freeze([-2, -1]),
]);

function clampInt(value, min, max) {
  const n = Number(value) | 0;
  return Math.max(min, Math.min(max, n));
}

function buildChecklist(spec, state = {}) {
  const bossDone = !!state.bossKilled;
  const relicDone = !!state.relicDelivered;
  return Object.freeze([
    Object.freeze({
      text: `Kill ${spec.bossName} on floor ${spec.bossDepth}.`,
      done: bossDone,
    }),
    Object.freeze({
      text: `Bring ${spec.relicTitle} back to town.`,
      done: relicDone,
    }),
  ]);
}

function buildObjectiveText(spec, state = {}) {
  if (!state.bossKilled) {
    return `Kill ${spec.bossName} on floor ${spec.bossDepth}, then recover ${spec.relicTitle}.`;
  }
  if (!state.relicRecovered) {
    return `Recover ${spec.relicTitle} from ${spec.bossName}'s remains.`;
  }
  if (!state.relicDelivered) {
    return `Return to town with ${spec.relicTitle}.`;
  }
  return `The town has reclaimed ${spec.relicTitle}.`;
}

function currentDepth(world, fallback = 0) {
  for (const [, ds] of world.query(DungeonState)) return Number(ds?.currentDepth ?? fallback) | 0;
  return fallback;
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

function currentPlayerId(world) {
  for (const [id, ni] of world.query(NamedIdentity)) {
    if (String(ni?.identity || "") === "player") return id;
  }
  return 0;
}

function rewardGoldForDepth(depth) {
  return clampInt(140 + (Number(depth || 1) | 0) * 28, 180, 420);
}

export function buildRunContractSpec(world, opts = {}) {
  const worldSeed = Number(opts.worldSeed ?? world?.seed ?? 0) >>> 0;
  const playerId = Number(opts.playerId || 1) | 0;
  const rng = createRng((worldSeed ^ ((playerId * 0x9e3779b9) >>> 0) ^ 0x72756e71) >>> 0);
  const bossBase = BOSS_POOL[rng.int(0, BOSS_POOL.length - 1)] || BOSS_POOL[0];
  const monster = getMonster(bossBase.monsterId) || { id: bossBase.monsterId, name: bossBase.monsterId };
  const relic = RELIC_POOL[rng.int(0, RELIC_POOL.length - 1)] || RELIC_POOL[0];
  const bossDepth = rng.int(bossBase.minDepth, bossBase.maxDepth);
  const bossName = `${String(rng.choice(BOSS_FIRST_NAMES) || "Kharos")} ${String(rng.choice(BOSS_TITLES) || "the Black")}`;
  return Object.freeze({
    questId: RUN_CONTRACT_QUEST_ID,
    bossMonsterId: String(monster.id || bossBase.monsterId),
    bossMonsterName: String(monster.name || bossBase.monsterId),
    bossName,
    bossDepth,
    relicItemId: String(relic.itemId),
    relicTitle: String(relic.title),
    relicObjectiveNoun: String(relic.objectiveNoun || relic.title),
    rewardGold: rewardGoldForDepth(bossDepth),
    bossHpMult: Number(bossBase.hpMult || 1.5),
    bossAcc: Number(bossBase.acc || 0),
    bossDmg: Number(bossBase.dmg || 0),
    bossEvade: Number(bossBase.evade || 0),
  });
}

function findObjectiveEntity(world, role) {
  const wantRole = String(role || "");
  for (const [id, target] of world.query(RunObjectiveTarget)) {
    if (String(target?.questId || "") !== RUN_CONTRACT_QUEST_ID) continue;
    if (String(target?.role || "") !== wantRole) continue;
    return id;
  }
  return 0;
}

function relicInInventory(world, playerId, spec) {
  return inventoryHasIdentity(world, playerId, String(spec?.relicItemId || ""), 1);
}

function findOpenSpawnPosition(world, seed) {
  const anchor = currentDownStairPos(world);
  if (!anchor) return null;
  const rng = createRng((Number(seed || 0) ^ 0x9e3779b9) >>> 0);
  const start = rng.int(0, SPAWN_OFFSETS.length - 1);
  for (let i = 0; i < SPAWN_OFFSETS.length; i++) {
    const [dx, dy] = SPAWN_OFFSETS[(start + i) % SPAWN_OFFSETS.length];
    const x = (anchor.x | 0) + (dx | 0);
    const y = (anchor.y | 0) + (dy | 0);
    if (!isWalkable(x, y)) continue;
    let blocked = false;
    for (const [, pos] of world.query(Position)) {
      if ((pos.x | 0) === x && (pos.y | 0) === y) { blocked = true; break; }
    }
    if (!blocked) return { x, y };
  }
  return anchor;
}

function createRelicDrop(world, spec, at) {
  const relicId = buildCatalogItem(world, spec.relicItemId, { count: 1 });
  if (!(relicId > 0)) return 0;
  world.add(relicId, Position, { x: Number(at?.x || 0) | 0, y: Number(at?.y || 0) | 0 });
  world.add(relicId, RunObjectiveTarget, { questId: RUN_CONTRACT_QUEST_ID, role: "relic" });
  attachEntityToCurrentFloor(world, relicId);
  emitSafe(world, "item:dropped", {
    itemId: relicId,
    count: 1,
    at: { x: Number(at?.x || 0) | 0, y: Number(at?.y || 0) | 0 },
  });
  return relicId;
}

function createBoss(world, spec) {
  const monster = getMonster(spec.bossMonsterId);
  if (!monster) return 0;
  const depth = Math.max(1, Number(spec.bossDepth || 1) | 0);
  const at = findOpenSpawnPosition(world, ((world.seed >>> 0) ^ ((depth * 0x85ebca6b) >>> 0)) >>> 0);
  if (!at) return 0;
  const scaledHp = Math.max(
    monster.baseHp + Math.round(Math.max(0, depth - 1) * Number(monster.hpPerLevel || 0)),
    Math.round(monster.baseHp * Number(spec.bossHpMult || 1.5)),
  );
  const bossId = spawnMonsterEntity(world, {
    x: at.x,
    y: at.y,
    name: spec.bossName,
    identity: spec.bossMonsterId,
    maxHp: scaledHp,
    hp: scaledHp,
    faction: "enemy",
    accuracyDerived: Number(monster.attack || 0) + Number(spec.bossAcc || 0),
    damagePowerDerived: Number(monster.attack || 0) + Number(spec.bossDmg || 0),
    evadeDerived: Number(monster.defense || 0) + Number(spec.bossEvade || 0),
    naturalDamageDice: monster.damageDice,
    sizeClass: monster.sizeClass,
    massKg: monster.massKg,
    resistances: monster.resistances,
    speed: monster.speed,
    creatureType: monster.creatureType,
    learnedSpellIds: Array.isArray(monster.learnedSpellIds) ? monster.learnedSpellIds.slice() : undefined,
    equipment: monster.equipment ? { ...monster.equipment } : null,
    wielding: Array.isArray(monster.wielding) ? monster.wielding.slice() : undefined,
    equipped: Array.isArray(monster.equipped) ? monster.equipped.slice() : undefined,
    inventory: Array.isArray(monster.inventory) ? monster.inventory.slice() : undefined,
    maxMana: Number.isFinite(monster.maxMana) ? Number(monster.maxMana) : undefined,
    manaRegen: Number.isFinite(monster.manaRegen) ? Number(monster.manaRegen) : undefined,
  });
  if (!(bossId > 0)) return 0;
  world.add(bossId, RunObjectiveTarget, { questId: RUN_CONTRACT_QUEST_ID, role: "boss" });
  attachEntityToCurrentFloor(world, bossId);
  emitSafe(world, "spawned", {
    id: bossId,
    at: { x: at.x | 0, y: at.y | 0 },
    kind: "run-contract-boss",
  });
  return bossId;
}

export function ensureRunContractTargets(world) {
  const quest = getQuestRecord(world, RUN_CONTRACT_QUEST_ID, 0);
  if (!quest || String(quest.state?.status || "") === "complete") return 0;
  const spec = quest.vars?.data || {};
  if ((currentDepth(world, 0) | 0) !== (Number(spec.bossDepth || 0) | 0)) return 0;
  if (quest.vars?.data?.bossKilled) return 0;
  const existing = findObjectiveEntity(world, "boss");
  if (existing > 0) return existing;
  return createBoss(world, spec);
}

export function installRunContractHooks(world) {
  if (world[RUN_CONTRACT_HOOKS_KEY]) return;
  world[RUN_CONTRACT_HOOKS_KEY] = true;

  world.on("died", (payload) => {
    const bossId = Number(payload?.id || 0) | 0;
    if (!(bossId > 0)) return;
    const marker = world.get(bossId, RunObjectiveTarget);
    if (!marker || String(marker.questId || "") !== RUN_CONTRACT_QUEST_ID || String(marker.role || "") !== "boss") return;
    const quest = getQuestRecord(world, RUN_CONTRACT_QUEST_ID, 0);
    if (!quest || quest.vars?.data?.bossKilled) return;
    const spec = quest.vars?.data || {};
    const playerId = Number(quest.bindings?.player || 0) | 0;
    if (findObjectiveEntity(world, "relic") <= 0 && !relicInInventory(world, playerId, spec)) {
      createRelicDrop(world, spec, payload?.at || world.get(bossId, Position) || null);
    }
    world.emit?.("runContract:bossKilled", {
      questId: RUN_CONTRACT_QUEST_ID,
      playerId,
      bossId,
    });
  });

  world.on("dungeon:transitioned", ({ depth }) => {
    const q = getQuestRecord(world, RUN_CONTRACT_QUEST_ID, 0);
    if (!q || String(q.state?.status || "") === "complete") return;
    const spec = q.vars?.data || {};
    if ((Number(depth || 0) | 0) === (Number(spec.bossDepth || 0) | 0)) ensureRunContractTargets(world);
    if ((Number(depth || 0) | 0) === 0 && q.vars?.data?.bossKilled && relicInInventory(world, Number(q.bindings?.player || 0) | 0, spec)) {
      world.emit?.("runContract:returned", {
        questId: RUN_CONTRACT_QUEST_ID,
        playerId: Number(q.bindings?.player || 0) | 0,
      });
    }
  });
}

export const RunContractQuest = registerQuest({
  id: RUN_CONTRACT_QUEST_ID,
  title: "The Town Wants a Trophy",
  version: 1,
  journal: {
    flavorText: "A standing contract from town leadership: kill the marked threat, recover its relic, and bring home something the whole settlement can point to.",
  },
  vars: {
    accepted: true,
    progress: 0,
    target: 2,
    bossKilled: false,
    relicRecovered: false,
    relicDelivered: false,
    objective: "",
    checklist: [],
  },
  nodes: {
    hunt: {
      on: {
        "runContract:bossKilled": [
          {
            guard: (ctx) => (
              Number(ctx.payload?.playerId || 0) === Number(ctx.bind.player || 0)
              && String(ctx.payload?.questId || "") === RUN_CONTRACT_QUEST_ID
            ),
            actions: [
              setVar("bossKilled", true),
              setVar("progress", 1),
              setVar("objective", (ctx) => buildObjectiveText(ctx.vars, { ...ctx.vars, bossKilled: true })),
              setVar("checklist", (ctx) => buildChecklist(ctx.vars, { ...ctx.vars, bossKilled: true })),
              emit("quest:advanced", (ctx) => ({
                questId: RUN_CONTRACT_QUEST_ID,
                playerId: ctx.bind.player,
                objective: `Recover ${String(ctx.vars?.relicTitle || "the relic")} and bring it back to town.`,
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
              const itemId = Number(ctx.payload?.itemId || 0) | 0;
              const marker = itemId > 0 ? ctx.world.get(itemId, RunObjectiveTarget) : null;
              return Number(ctx.payload?.actor || 0) === Number(ctx.bind.player || 0)
                && String(marker?.questId || "") === RUN_CONTRACT_QUEST_ID
                && String(marker?.role || "") === "relic";
            },
            actions: [
              setVar("relicRecovered", true),
              setVar("objective", (ctx) => buildObjectiveText(ctx.vars, { ...ctx.vars, bossKilled: true, relicRecovered: true })),
              setVar("checklist", (ctx) => buildChecklist(ctx.vars, { ...ctx.vars, bossKilled: true, relicRecovered: true })),
              emit("quest:advanced", (ctx) => ({
                questId: RUN_CONTRACT_QUEST_ID,
                playerId: ctx.bind.player,
                objective: `Return to town with ${String(ctx.vars?.relicTitle || "the relic")}.`,
              })),
            ],
            to: "return",
          },
        ],
      },
    },
    return: {
      on: {
        "runContract:returned": [
          {
            guard: (ctx) => (
              Number(ctx.payload?.playerId || 0) === Number(ctx.bind.player || 0)
              && String(ctx.payload?.questId || "") === RUN_CONTRACT_QUEST_ID
              && inventoryHasIdentity(ctx.world, Number(ctx.bind.player || 0) | 0, String(ctx.vars?.relicItemId || ""), 1)
            ),
            actions: [
              setVar("relicDelivered", true),
              setVar("progress", 2),
              setVar("objective", (ctx) => buildObjectiveText(ctx.vars, {
                ...ctx.vars,
                bossKilled: true,
                relicRecovered: true,
                relicDelivered: true,
              })),
              setVar("checklist", (ctx) => buildChecklist(ctx.vars, {
                ...ctx.vars,
                bossKilled: true,
                relicRecovered: true,
                relicDelivered: true,
              })),
              (ctx) => {
                const reward = Math.max(0, Number(ctx.vars?.rewardGold || 0) | 0);
                if (!(reward > 0)) return;
                const goldId = createItemById(ctx.world, "gold", { count: reward });
                if (!(goldId > 0)) return;
                if (addToInventory(ctx.world, Number(ctx.bind.player || 0) | 0, goldId)) return;
                const pos = ctx.world.get(Number(ctx.bind.player || 0) | 0, Position);
                if (!pos) return;
                ctx.world.add(goldId, Position, { x: pos.x | 0, y: pos.y | 0 });
                emitSafe(ctx.world, "item:dropped", { itemId: goldId, count: reward, at: { x: pos.x | 0, y: pos.y | 0 } });
              },
              emit("quest:completed", (ctx) => ({
                questId: RUN_CONTRACT_QUEST_ID,
                playerId: ctx.bind.player,
                title: "The Town Wants a Trophy",
                rewardGold: Math.max(0, Number(ctx.vars?.rewardGold || 0) | 0),
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

export function ensureRunContractQuest(world, opts = {}) {
  const playerId = Number(opts.playerId || currentPlayerId(world) || 1) | 0;
  if (!(playerId > 0)) return 0;

  const existing = findQuestEntity(world, RUN_CONTRACT_QUEST_ID, playerId);
  if (existing > 0) return existing;

  const spec = buildRunContractSpec(world, { ...opts, playerId });
  ensureQuestRuntimeEventRoutes(world, ["runContract:bossKilled", "item:pickup", "runContract:returned"]);

  const qid = instantiateQuest(
    world,
    RUN_CONTRACT_QUEST_ID,
    { player: playerId, giver: 0, target: 0 },
    {
      ...spec,
      progress: 0,
      target: 2,
      bossKilled: false,
      relicRecovered: false,
      relicDelivered: false,
      objective: buildObjectiveText(spec, {}),
      checklist: buildChecklist(spec, {}),
    },
    { node: "hunt", status: "active" },
  );

  if (qid > 0) {
    world.emit?.("quest:started", {
      questId: RUN_CONTRACT_QUEST_ID,
      playerId,
      giverId: 0,
      title: "The Town Wants a Trophy",
    });
    ensureRunContractTargets(world);
  }

  return qid;
}
