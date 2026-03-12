import { assertEquals, assert } from "jsr:@std/assert";
import { World, composeScheduler } from "../src/lib/ecs-js/index.js";
import { QuestDefRef } from "../src/rules/components/QuestDefRef.js";
import { emit, setVar } from "../src/rules/quests/actions.js";
import { registerQuest } from "../src/rules/quests/registry.js";
import { getQuestRecord, installQuestRuntime, instantiateQuest } from "../src/rules/quests/runtime.js";

Deno.test("quest runtime compiles event edges and advances quest entities through scripts", () => {
  const world = new World({ seed: 77 });
  world.setScheduler(composeScheduler("scripts"));

  registerQuest({
    id: "test:quest_runtime",
    title: "Test Quest",
    version: 1,
    vars: { accepted: false },
    nodes: {
      offer: {
        on: {
          "dialog:accepted": [
            {
              guard: (ctx) => {
                return Number(ctx.payload?.playerId || 0) === Number(ctx.bind.player || 0)
                  && String(ctx.payload?.questId || "") === "test:quest_runtime";
              },
              actions: [
                setVar("accepted", true),
                emit("quest:started", () => ({ title: "Test Quest" })),
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
                  && Number(ctx.payload?.to?.x || 0) === 3;
              },
              actions: [
                emit("quest:completed", () => ({ title: "Test Quest" })),
              ],
              to: "complete",
            },
          ],
        },
      },
      complete: { terminal: true },
    },
  });

  installQuestRuntime(world);

  const started = [];
  const completed = [];
  world.on("quest:started", (payload) => started.push(payload));
  world.on("quest:completed", (payload) => completed.push(payload));

  const qid = instantiateQuest(world, "test:quest_runtime", {
    player: 17,
    giver: 22,
  }, {}, { node: "offer" });

  world.tick(0);

  world.emit("dialog:accepted", { questId: "test:quest_runtime", playerId: 17 });
  let record = getQuestRecord(world, "test:quest_runtime", 17);
  assert(record, "quest record should exist");
  assertEquals(record.state.node, "survey");
  assertEquals(record.vars.data.accepted, true);
  assertEquals(started.length, 1);

  world.emit("moved", { id: 17, from: { x: 2, y: 0 }, to: { x: 3, y: 0 } });
  record = getQuestRecord(world, "test:quest_runtime", 17);
  assert(record, "quest record should still exist after completion");
  assertEquals(record.state.node, "complete");
  assertEquals(record.state.status, "complete");
  assertEquals(completed.length, 1);
  assertEquals(qid > 0, true);
});

Deno.test("instantiateQuest deduplicates matching quest instances for the same bindings", () => {
  const world = new World({ seed: 88 });
  world.setScheduler(composeScheduler("scripts"));

  registerQuest({
    id: "test:quest_dedupe",
    title: "Deduped Quest",
    version: 1,
    nodes: {
      offer: { on: {} },
    },
  });

  installQuestRuntime(world);

  const first = instantiateQuest(world, "test:quest_dedupe", { player: 3, giver: 7, target: 7 });
  const second = instantiateQuest(world, "test:quest_dedupe", { player: 3, giver: 7, target: 7 });

  assertEquals(second, first);
  const questIds = [...world.query(QuestDefRef)]
    .filter(([, def]) => String(def.id || "") === "test:quest_dedupe")
    .map(([id]) => id);
  assertEquals(questIds, [first]);
  assertEquals(getQuestRecord(world, "test:quest_dedupe", 3)?.id, first);
});
