import { assertEquals, assert } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Player } from "../src/rules/components/Player.js";
import { QuestState } from "../src/rules/components/QuestState.js";
import "../src/rules/quests/definitions/graveyardWatch.js";
import "../src/rules/dialogues/townfolkDialogs.js";
import { installDialogRuntime } from "../src/rules/dialogues/runtime.js";
import { getQuestRecord, instantiateQuest, STARTER_GRAVEYARD_QUEST_ID } from "../src/rules/quests/runtime.js";

Deno.test("priest dialog gates choices against starter quest state", () => {
  const world = new World({ seed: 91 });
  installDialogRuntime(world);

  const player = world.create();
  world.add(player, Player);

  const priest = world.create();
  world.add(priest, NamedIdentity, { name: "Priest", identity: "townfolk_priest" });

  instantiateQuest(world, STARTER_GRAVEYARD_QUEST_ID, {
    player,
    giver: priest,
    target: priest,
  }, {}, { node: "offer" });

  const opened = [];
  world.on("dialog:opened", (payload) => opened.push(payload));

  world.emit("dialog:openRequest", { actorId: player, targetId: priest, dialogId: "townfolk:priest" });
  assert(opened.length > 0, "dialog should open");
  assertEquals(opened.at(-1).choices.some((choice) => choice.id === "accept_graveyard_watch"), true);

  const quest = getQuestRecord(world, STARTER_GRAVEYARD_QUEST_ID, player);
  assert(quest, "starter quest should exist");
  world.set(quest.id, QuestState, { ...quest.state, node: "report", status: "active" });

  world.emit("dialog:openRequest", { actorId: player, targetId: priest, dialogId: "townfolk:priest" });
  assertEquals(opened.at(-1).choices.some((choice) => choice.id === "report_graveyard_watch"), true);
  assertEquals(opened.at(-1).choices.some((choice) => choice.id === "accept_graveyard_watch"), false);
});
