import { assertEquals } from "jsr:@std/assert";
import {
  clearMessageRegistryForTests,
  defineMessage,
  getMessage,
  renderMessage,
} from "../src/display/ui/wiring/messages/messageRegistry.js";

Deno.test("message registry renders target, actor, and witness perspectives", () => {
  clearMessageRegistryForTests();
  defineMessage("test:hit", {
    target: ({ actorName }) => ({ text: `${actorName} hits you!`, type: "danger" }),
    actor: ({ targetName }) => ({ text: `You hit ${targetName}.`, type: "combat" }),
    witness: ({ actorName, targetName }) => ({ text: `${actorName} hits ${targetName}.`, type: "combat" }),
  });

  assertEquals(renderMessage("test:hit", { actorName: "Orc", targetName: "You" }), {
    text: "Orc hits you!",
    type: "danger",
  });
  assertEquals(renderMessage("test:hit", { actorName: "You", targetName: "Orc" }), {
    text: "You hit Orc.",
    type: "combat",
  });
  assertEquals(renderMessage("test:hit", { actorName: "Orc", targetName: "Rat" }), {
    text: "Orc hits Rat.",
    type: "combat",
  });
});

Deno.test("message registry supports direct function templates", () => {
  clearMessageRegistryForTests();
  defineMessage("test:direct", ({ amount }) => ({ text: `Recovered ${amount} HP.`, type: "system" }));

  assertEquals(getMessage("test:direct") !== null, true);
  assertEquals(renderMessage("test:direct", { amount: 3 }), {
    text: "Recovered 3 HP.",
    type: "system",
  });
});
