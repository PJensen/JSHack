import { assertEquals, assert } from "jsr:@std/assert";
import { World, composeScheduler } from "../src/lib/ecs-js/index.js";
import { buildCatalogItem } from "../src/rules/data/itemCatalogLoader.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Player } from "../src/rules/components/Player.js";
import { QuestState } from "../src/rules/components/QuestState.js";
import { installQuestRuntime } from "../src/rules/quests/runtime.js";
import { addToInventory } from "../src/rules/utils/inventoryFacade.js";
import { inventoryHasIdentity } from "../src/rules/utils/townEconomy.js";
import "../src/rules/quests/definitions/graveyardWatch.js";
import "../src/rules/dialogues/townfolkDialogs.js";
import { installDialogRuntime } from "../src/rules/dialogues/runtime.js";
import { getQuestRecord, instantiateQuest, STARTER_PRIEST_FETCH_QUEST_ID } from "../src/rules/quests/runtime.js";

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

  const quest = getQuestRecord(world, STARTER_PRIEST_FETCH_QUEST_ID, player);
  assert(quest, "starter quest should exist");
  assertEquals(world.get(quest.id, QuestState)?.node, "recover");

  const bookId = buildCatalogItem(world, "book_dead", { count: 1 });
  addToInventory(world, player, bookId);
  world.emit("item:pickup", { actor: player, itemId: bookId, count: 1 });
  world.tick(0);
  assertEquals(world.get(quest.id, QuestState)?.node, "report");

  world.emit("dialog:openRequest", { actorId: player, targetId: priest, dialogId: "townfolk:priest" });
  assertEquals(opened.at(-1).choices.some((choice) => choice.id === "turn_in_priest_fetch"), true);
  assertEquals(opened.at(-1).choices.some((choice) => choice.id === "accept_priest_fetch"), false);
  const reportSessionId = opened.at(-1).sessionId;
  world.emit("dialog:choose", { sessionId: reportSessionId, choiceId: "turn_in_priest_fetch" });
  world.tick(0);

  assertEquals(world.get(quest.id, QuestState)?.status, "complete");
  assertEquals(inventoryHasIdentity(world, player, "book_dead", 1), false);
});
