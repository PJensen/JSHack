import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { clearDialogRegistry, registerDialog } from "../src/rules/dialogues/registry.js";
import { installDialogRuntime } from "../src/rules/dialogues/runtime.js";

Deno.test("dialog runtime opens nodes, respects visible gates, and closes sessions", () => {
  clearDialogRegistry();
  const world = new World({ seed: 41 });
  installDialogRuntime(world);

  registerDialog({
    id: "test:dialog_runtime",
    start: "root",
    nodes: {
      root: {
        text: "Hello there.",
        choices: [
          { id: "hidden", label: "Hidden", visible: () => false, close: true },
          { id: "next", label: "Continue", to: "followup" },
        ],
      },
      followup: {
        text: "Safe travels.",
        choices: [
          { id: "done", label: "Done", close: true },
        ],
      },
    },
  });

  const speaker = world.create();
  world.add(speaker, NamedIdentity, { name: "Guide", identity: "guide" });

  const opened = [];
  const closed = [];
  world.on("dialog:opened", (payload) => opened.push(payload));
  world.on("dialog:closed", (payload) => closed.push(payload));

  world.emit("dialog:openRequest", { actorId: 1, targetId: speaker, dialogId: "test:dialog_runtime" });

  assertEquals(opened.length, 1);
  assertEquals(opened[0].speakerName, "Guide");
  assertEquals(opened[0].choices.map((choice) => choice.id), ["next"]);

  world.emit("dialog:choose", { sessionId: opened[0].sessionId, choiceId: "next" });
  assertEquals(opened.length, 2);
  assertEquals(opened[1].text, "Safe travels.");

  world.emit("dialog:choose", { sessionId: opened[0].sessionId, choiceId: "done" });
  assertEquals(closed.length, 1);
  assertEquals(closed[0].reason, "choice");
});

Deno.test("dialog runtime carries presentation metadata and replaces existing actor sessions", () => {
  clearDialogRegistry();
  const world = new World({ seed: 42 });
  installDialogRuntime(world);
  const actorId = world.create();

  registerDialog({
    id: "test:dialog_metadata",
    start: "root",
    presentation: "overlay",
    maxDistance: 3,
    nodes: {
      root: {
        text: "Choose quickly.",
        choices: [{ id: "leave", label: "Leave", close: true }],
      },
    },
  });

  const firstSpeaker = world.create();
  world.add(firstSpeaker, NamedIdentity, { name: "Priest", identity: "priest" });
  const secondSpeaker = world.create();
  world.add(secondSpeaker, NamedIdentity, { name: "Smith", identity: "smith" });

  const opened = [];
  const closed = [];
  world.on("dialog:opened", (payload) => opened.push(payload));
  world.on("dialog:closed", (payload) => closed.push(payload));

  world.emit("dialog:openRequest", { actorId, targetId: firstSpeaker, dialogId: "test:dialog_metadata" });
  world.emit("dialog:openRequest", { actorId, targetId: secondSpeaker, dialogId: "test:dialog_metadata" });

  assertEquals(opened.length, 2);
  assertEquals(opened[0].presentation, "overlay");
  assertEquals(opened[0].maxDistance, 3);
  assertEquals(opened[1].speakerName, "Smith");
  assertEquals(closed.length, 1);
  assertEquals(closed[0].reason, "replaced");
});
