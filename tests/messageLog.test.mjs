import { assertEquals } from "jsr:@std/assert";
import { createMessageLog } from "../src/main/ui/messageLog.js";

Deno.test("messageLog consolidates consecutive duplicate messages", () => {
  const updates = [];
  const messageLog = createMessageLog({
    maxEntries: 10,
    onUpdate: (entries) => updates.push(entries),
  });

  messageLog.log({ text: "You wait.", type: "system" });
  messageLog.log({ text: "You wait.", type: "system" });
  messageLog.log({ text: "You wait.", type: "system" });

  const entries = messageLog.getEntries();
  assertEquals(entries.length, 1);
  assertEquals(entries[0].text, "You wait.");
  assertEquals(entries[0].type, "system");
  assertEquals(entries[0].repeat, 3);
  assertEquals(updates.length, 3);
});

Deno.test("messageLog does not merge non-consecutive duplicate messages", () => {
  const messageLog = createMessageLog({ maxEntries: 10 });

  messageLog.log({ text: "You wait.", type: "system" });
  messageLog.log({ text: "The goblin moves.", type: "combat" });
  messageLog.log({ text: "You wait.", type: "system" });

  const entries = messageLog.getEntries();
  assertEquals(entries.length, 3);
  assertEquals(entries[0].repeat, 1);
  assertEquals(entries[1].repeat, 1);
  assertEquals(entries[2].repeat, 1);
});

