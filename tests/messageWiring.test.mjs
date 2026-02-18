import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Player } from "../src/rules/components/Player.js";
import { installMessageWiring } from "../src/main/wiring/messageWiring.js";

function createMessageLog() {
  const entries = [];
  return {
    entries,
    log(msg) {
      if (typeof msg === "string") entries.push({ text: msg, type: "default" });
      else entries.push({ text: String(msg?.text || ""), type: String(msg?.type || "default") });
    },
  };
}

Deno.test("messageWiring logs homecoming flavor text for player", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();
  world.add(playerId, Player, {});

  const messageLog = createMessageLog();
  installMessageWiring({
    world,
    messageLog,
    playerEntity: () => ({ id: playerId, pos: { x: 0, y: 0 } }),
    bracketizeName: (s) => `[${s}]`,
    getSpell: () => null,
  });

  world.emit("dungeon:teleport-depth", {
    actor: playerId,
    source: "scroll_homecoming",
    targetDepth: 0,
  });

  assertEquals(messageLog.entries.length, 1);
  assertEquals(messageLog.entries[0].type, "system");
  assert(messageLog.entries[0].text.includes("familiar pull"));
});

Deno.test("messageWiring ignores non-homecoming depth teleports", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();
  world.add(playerId, Player, {});

  const messageLog = createMessageLog();
  installMessageWiring({
    world,
    messageLog,
    playerEntity: () => ({ id: playerId, pos: { x: 0, y: 0 } }),
    bracketizeName: (s) => `[${s}]`,
    getSpell: () => null,
  });

  world.emit("dungeon:teleport-depth", {
    actor: playerId,
    source: "debug_portal",
    targetDepth: 0,
  });

  assertEquals(messageLog.entries.length, 0);
});
