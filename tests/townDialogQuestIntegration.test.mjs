import "./helpers/installContentCatalog.mjs";
import { assertEquals, assert } from "jsr:@std/assert";
import { World, composeScheduler } from "../src/lib/ecs-js/index.js";
import { buildCatalogItem } from "../src/rules/data/itemCatalogLoader.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { QuestState } from "../src/rules/components/QuestState.js";
import { installQuestRuntime } from "../src/rules/quests/runtime.js";
import { addToInventory } from "../src/rules/utils/inventoryFacade.js";
import { consumeInventoryIdentity, inventoryHasIdentity } from "../src/rules/utils/townEconomy.js";
import { inventoryItems } from "../src/rules/utils/inventoryFacade.js";
import "../src/rules/quests/definitions/graveyardWatch.js";
import "../src/rules/dialogues/townfolkDialogs.js";
import { installDialogRuntime } from "../src/rules/dialogues/runtime.js";
import { getQuestRecord, instantiateQuest, STARTER_PRIEST_FETCH_QUEST_ID } from "../src/rules/quests/runtime.js";
import { RAT_INFESTATION_QUEST_ID } from "../src/rules/quests/definitions/ratInfestation.js";
import { DoorKey } from "../src/rules/components/DoorKey.js";
import { RAT_CELLAR_LOCK_ID } from "../src/rules/data/questLocks.js";
import { ensureRunContractQuest, RUN_CONTRACT_QUEST_ID } from "../src/rules/quests/definitions/runContract.js";

Deno.test("mason clearly offers the authored-dungeon trophy contract", () => {
  const world = new World({ seed: 0x7a0f4 });
  world.setScheduler(composeScheduler("scripts"));
  installDialogRuntime(world);
  installQuestRuntime(world);

  const player = world.create();
  world.add(player, Player);
  world.add(player, Inventory, { capacity: 8 });
  const mason = world.create();
  world.add(mason, NamedIdentity, { name: "Mason", identity: "townfolk_mason" });
  world.add(mason, Position, { x: 4, y: 4 });

  assert(ensureRunContractQuest(world, { playerId: player }) > 0);
  const opened = [];
  world.on("dialog:opened", (payload) => opened.push(payload));
  world.emit("dialog:openRequest", { actorId: player, targetId: mason, dialogId: "townfolk:mason" });

  assert(opened.length > 0, "mason dialog should open");
  assertEquals(opened.at(-1).choices.some((choice) => choice.id === "accept_run_contract"), true);
  assert(String(opened.at(-1).text || "").includes("floor"));
  const sessionId = opened.at(-1).sessionId;
  world.emit("dialog:choose", { sessionId, choiceId: "accept_run_contract" });
  world.tick(0);

  const quest = getQuestRecord(world, RUN_CONTRACT_QUEST_ID, player);
  assertEquals(quest?.state?.node, "hunt");
  assert(String(quest?.vars?.data?.entranceTemplateId || "").length > 0);
});

Deno.test("priest dialog runs the starter fetch quest from offer to turn-in", () => {
  const world = new World({ seed: 91 });
  world.setScheduler(composeScheduler("scripts"));
  installDialogRuntime(world);
  installQuestRuntime(world);

  const player = world.create();
  world.add(player, Player);
  world.add(player, Inventory, { capacity: 8 });

  const priest = world.create();
  world.add(priest, NamedIdentity, { name: "Priest", identity: "townfolk_priest" });
  const dungeon = world.create();
  world.add(dungeon, DungeonState, {
    worldSeed: 91,
    currentDepth: 0,
    floorEntityIds: [priest],
  });

  instantiateQuest(world, STARTER_PRIEST_FETCH_QUEST_ID, {
    player,
    giver: priest,
    target: priest,
  }, {}, { node: "offer" });
  world.tick(0);

  const opened = [];
  world.on("dialog:opened", (payload) => opened.push(payload));

  world.emit("dialog:openRequest", { actorId: player, targetId: priest, dialogId: "townfolk:priest" });
  assert(opened.length > 0, "dialog should open");
  assertEquals(opened.at(-1).choices.some((choice) => choice.id === "accept_priest_fetch"), true);
  const acceptSessionId = opened.at(-1).sessionId;
  world.emit("dialog:choose", { sessionId: acceptSessionId, choiceId: "accept_priest_fetch" });
  world.tick(0);
  const ackSessionId = opened.at(-1).sessionId;
  world.emit("dialog:choose", { sessionId: ackSessionId, choiceId: "leave" });

  const quest = getQuestRecord(world, STARTER_PRIEST_FETCH_QUEST_ID, player);
  assert(quest, "starter quest should exist");
  assertEquals(world.get(quest.id, QuestState)?.node, "recover");

  const bookId = buildCatalogItem(world, "book_dead", { count: 1 });
  addToInventory(world, player, bookId);
  world.emit("item:pickup", { actor: player, itemId: bookId, count: 1 });
  world.tick(0);
  assertEquals(world.get(quest.id, QuestState)?.node, "recover");

  const returningPriest = world.create();
  world.add(returningPriest, NamedIdentity, { name: "Priest", identity: "townfolk_priest" });
  world.emit("dialog:reported", {
    questId: STARTER_PRIEST_FETCH_QUEST_ID,
    playerId: player,
    speakerId: returningPriest,
  });
  world.tick(0);

  assertEquals(world.get(quest.id, QuestState)?.status, "complete");
  assertEquals(inventoryHasIdentity(world, player, "book_dead", 1), false);

  let goldTotal = 0;
  for (const itemId of inventoryItems(world, player)) {
    const ni = world.get(itemId, NamedIdentity);
    if (String(ni?.identity || "") !== "gold") continue;
    const info = world.get(itemId, ItemInfo);
    goldTotal += Math.max(1, Number(info?.count || 1) | 0);
  }
  assert(goldTotal >= 100, "starter priest quest should award gold");
  assert(inventoryHasIdentity(world, player, "potion_holy_water", 1), "starter priest quest should award an item");
});

Deno.test("priest fetch quest accepts and turns in a book already in inventory", () => {
  const world = new World({ seed: 94 });
  world.setScheduler(composeScheduler("scripts"));
  installQuestRuntime(world);

  const player = world.create();
  world.add(player, Player);
  world.add(player, Inventory, { capacity: 8 });
  const priest = world.create();
  world.add(priest, NamedIdentity, { name: "Priest", identity: "townfolk_priest" });

  const bookId = buildCatalogItem(world, "book_dead", { count: 1 });
  addToInventory(world, player, bookId);
  const questId = instantiateQuest(world, STARTER_PRIEST_FETCH_QUEST_ID, {
    player,
    giver: priest,
    target: priest,
  }, {}, { node: "offer" });

  world.emit("dialog:accepted", {
    questId: STARTER_PRIEST_FETCH_QUEST_ID,
    playerId: player,
    speakerId: priest,
  });
  assertEquals(world.get(questId, QuestState)?.node, "recover");

  consumeInventoryIdentity(world, player, "book_dead", 1);
  world.emit("dialog:reported", {
    questId: STARTER_PRIEST_FETCH_QUEST_ID,
    playerId: player,
    speakerId: priest,
  });
  assertEquals(world.get(questId, QuestState)?.status, "active", "turn-in should follow live inventory, not prior ownership");

  const replacementBookId = buildCatalogItem(world, "book_dead", { count: 1 });
  addToInventory(world, player, replacementBookId);
  world.emit("dialog:reported", {
    questId: STARTER_PRIEST_FETCH_QUEST_ID,
    playerId: player,
    speakerId: priest,
  });
  assertEquals(world.get(questId, QuestState)?.status, "complete");
  assertEquals(inventoryHasIdentity(world, player, "book_dead", 1), false);
});

Deno.test("barkeep rat quest acceptance gives starter bow + arrows and announces bats", () => {
  const world = new World({ seed: 92 });
  world.setScheduler(composeScheduler("scripts"));
  installDialogRuntime(world);
  installQuestRuntime(world);

  const player = world.create();
  world.add(player, Player);
  world.add(player, Inventory, { capacity: 8 });

  const barkeep = world.create();
  world.add(barkeep, NamedIdentity, { name: "Barkeep", identity: "townfolk_barkeep" });
  world.add(barkeep, Position, { x: 12, y: 7 });

  const dungeon = world.create();
  world.add(dungeon, DungeonState, {
    worldSeed: 92,
    currentDepth: 0,
    floorEntityIds: [player, barkeep],
  });

  instantiateQuest(world, RAT_INFESTATION_QUEST_ID, {
    player,
    giver: barkeep,
    target: barkeep,
  }, {}, { node: "offer" });
  world.tick(0);

  const opened = [];
  const chatter = [];
  world.on("dialog:opened", (payload) => opened.push(payload));
  world.on("npc:dialogue", (payload) => chatter.push(payload));

  world.emit("dialog:openRequest", { actorId: player, targetId: barkeep, dialogId: "townfolk:barkeep" });
  assert(opened.length > 0, "barkeep dialog should open");
  assertEquals(opened.at(-1).choices.some((choice) => choice.id === "accept_rat_quest"), true);
  const acceptSessionId = opened.at(-1).sessionId;
  world.emit("dialog:choose", { sessionId: acceptSessionId, choiceId: "accept_rat_quest" });
  world.tick(0);

  assert(inventoryHasIdentity(world, player, "bow_short", 1));
  assert(inventoryHasIdentity(world, player, "ammo_arrows", 20));
  const cellarKeys = inventoryItems(world, player)
    .filter((itemId) => world.get(itemId, DoorKey)?.lockId === RAT_CELLAR_LOCK_ID);
  assertEquals(cellarKeys.length, 1, "quest acceptance should grant exactly one cellar key");
  assertEquals(chatter.some((evt) => String(evt?.text || "").includes("there are bats down there too")), true);
});

Deno.test("barkeep rat quest turn-in grants promised Mirror Bow reward", () => {
  const world = new World({ seed: 93 });
  world.setScheduler(composeScheduler("scripts"));
  installDialogRuntime(world);
  installQuestRuntime(world);

  const player = world.create();
  world.add(player, Player);
  world.add(player, Inventory, { capacity: 12 });

  const barkeep = world.create();
  world.add(barkeep, NamedIdentity, { name: "Barkeep", identity: "townfolk_barkeep" });
  world.add(barkeep, Position, { x: 12, y: 7 });

  instantiateQuest(world, RAT_INFESTATION_QUEST_ID, {
    player,
    giver: barkeep,
    target: barkeep,
  }, {
    accepted: true,
    killCount: 5,
    reported: false,
  }, { node: "report" });
  world.tick(0);

  const opened = [];
  const completed = [];
  world.on("dialog:opened", (payload) => opened.push(payload));
  world.on("quest:completed", (payload) => completed.push(payload));

  const returningBarkeep = world.create();
  world.add(returningBarkeep, NamedIdentity, { name: "Barkeep", identity: "townfolk_barkeep" });
  world.emit("dialog:openRequest", { actorId: player, targetId: returningBarkeep, dialogId: "townfolk:barkeep" });
  assert(opened.length > 0, "barkeep dialog should open");
  assertEquals(opened.at(-1).choices.some((choice) => choice.id === "turn_in_rats"), true);
  const sessionId = opened.at(-1).sessionId;
  world.emit("dialog:choose", { sessionId, choiceId: "turn_in_rats" });
  world.tick(0);

  assert(inventoryHasIdentity(world, player, "bow_mirror", 1), "turn-in should grant the promised Mirror Bow");
  assert(inventoryHasIdentity(world, player, "gold", 150), "turn-in should grant boosted gold");
  assert(inventoryHasIdentity(world, player, "food_stew", 1), "turn-in should give the meal directly");
  assertEquals(completed.at(-1)?.rewardItemIds, ["bow_mirror"]);
});

Deno.test("barkeep rat quest genocide turn-in records the world outcome", () => {
  const world = new World({ seed: 94 });
  world.setScheduler(composeScheduler("scripts"));
  installDialogRuntime(world);
  installQuestRuntime(world);

  const player = world.create();
  world.add(player, Player);
  world.add(player, Inventory, { capacity: 12 });
  world.add(player, Position, { x: 3, y: 3 });

  const barkeep = world.create();
  world.add(barkeep, NamedIdentity, { name: "Barkeep", identity: "townfolk_barkeep" });
  world.add(barkeep, Position, { x: 12, y: 7 });

  instantiateQuest(world, RAT_INFESTATION_QUEST_ID, {
    player,
    giver: barkeep,
    target: barkeep,
  }, {
    accepted: true,
    killCount: 1,
    reported: false,
    ratsGenocided: true,
    resolution: "genocide",
    worldOutcome: "rats_erased",
    objective: "Return to the barkeep.",
    rewardItemIds: ["bow_mirror"],
    rewardGold: 150,
  }, { node: "report" });
  world.tick(0);

  const opened = [];
  const completed = [];
  world.on("dialog:opened", (payload) => opened.push(payload));
  world.on("quest:completed", (payload) => completed.push(payload));

  world.emit("dialog:openRequest", { actorId: player, targetId: barkeep, dialogId: "townfolk:barkeep" });
  assert(opened.length > 0, "barkeep dialog should open");
  assert(String(opened.at(-1).text || "").includes("whatever that silence is"));
  assertEquals(
    opened.at(-1).choices.some((choice) => choice.id === "turn_in_rats" && choice.label === "There are no rats anymore."),
    true,
  );

  const sessionId = opened.at(-1).sessionId;
  world.emit("dialog:choose", { sessionId, choiceId: "turn_in_rats" });
  world.tick(0);

  assert(inventoryHasIdentity(world, player, "bow_mirror", 1), "genocide turn-in should still grant the promised Mirror Bow");
  assertEquals(completed.at(-1)?.resolution, "genocide");
  assertEquals(completed.at(-1)?.worldOutcome, "rats_erased");

  const quest = getQuestRecord(world, RAT_INFESTATION_QUEST_ID, player);
  assertEquals(quest?.state?.status, "complete");
  assertEquals(quest?.vars?.data?.completionText, "The cellar fell silent after rat-kind was erased from the run.");
});
