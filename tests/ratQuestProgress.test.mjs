import { assertEquals } from "jsr:@std/assert";
import { World, composeScheduler } from "../src/lib/ecs-js/index.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { QuestVars } from "../src/rules/components/QuestVars.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { installQuestRuntime, instantiateQuest } from "../src/rules/quests/runtime.js";
import { ratInfestationDeathSystem, RAT_INFESTATION_QUEST_ID } from "../src/rules/quests/definitions/ratInfestation.js";
import { recordDeathApplied } from "../src/rules/utils/deathApplied.js";
import "../src/rules/quests/definitions/ratInfestation.js";

Deno.test("rat quest emits progress payload as kills advance", () => {
  const world = new World({ seed: 17 });
  world.setScheduler(composeScheduler("scripts"));
  installQuestRuntime(world);

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 9, y: 4 });

  const questId = instantiateQuest(world, RAT_INFESTATION_QUEST_ID, {
    player,
    giver: 99,
    target: 99,
  }, { killCount: 1 }, { node: "hunt" });
  world.tick(0);

  const seen = [];
  world.on("quest:progress", (payload) => seen.push(payload));

  world.emit("rat:killed", { playerId: player, victimId: 123 });
  world.tick(0);

  assertEquals(seen.length, 1);
  assertEquals(seen[0].questId, RAT_INFESTATION_QUEST_ID);
  assertEquals(seen[0].playerId, player);
  assertEquals(seen[0].progress, 2);
  assertEquals(seen[0].target, 5);
  assertEquals(seen[0].label, "RATS");
  assertEquals(seen[0].at, { x: 9, y: 4 });
  assertEquals(world.get(questId, QuestVars)?.data?.killCount, 2);
});

Deno.test("rat quest death system converts player rat deaths into quest progress", () => {
  const world = new World({ seed: 18 });
  world.setScheduler(composeScheduler("scripts"));
  installQuestRuntime(world);

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 2, y: 3 });

  const rat = world.create();
  world.add(rat, NamedIdentity, { name: "Rat", identity: "rat" });

  const questId = instantiateQuest(world, RAT_INFESTATION_QUEST_ID, {
    player,
    giver: 99,
    target: 99,
  }, { accepted: true, killCount: 1 }, { node: "hunt" });
  world.tick(0);

  const seen = [];
  world.on("quest:progress", (payload) => seen.push(payload));

  recordDeathApplied(world, { target: rat, killer: player });
  ratInfestationDeathSystem(world);
  world.tick(0);

  assertEquals(seen.length, 1);
  assertEquals(seen[0].questId, RAT_INFESTATION_QUEST_ID);
  assertEquals(seen[0].playerId, player);
  assertEquals(world.get(questId, QuestVars)?.data?.killCount, 2);
});
