import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Player } from "../src/rules/components/Player.js";
import { Pet } from "../src/rules/components/Pet.js";
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

Deno.test("messageWiring logs apply coat outcomes and cryptic fallback", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();
  world.add(playerId, Player, {});

  const targetId = world.create();
  world.add(targetId, NamedIdentity, { name: "Test Dagger", identity: "dagger_quick" });
  world.add(targetId, ItemInfo, {
    type: "equip",
    slot: "weapon",
    weight: 1,
    value: 10,
    description: "Dagger",
    count: 1,
    bonuses: {},
    rarity: 1,
    rarityName: "common",
    affixes: [],
  });

  const messageLog = createMessageLog();
  installMessageWiring({
    world,
    messageLog,
    playerEntity: () => ({ id: playerId, pos: { x: 0, y: 0 } }),
    bracketizeName: (s) => `[${s}]`,
    getSpell: () => null,
  });

  world.emit("item:applied", {
    targetId,
    result: {
      type: "poison_coat",
      coating: { kind: "poison", charges: 12 },
      message: "You coat Test Dagger with poison (12 charges).",
    },
  });
  world.emit("item:applied", {
    targetId,
    result: { type: "stonecoat", acBonus: 1, message: "You harden Test Dagger into living stone (AC +1)." },
  });
  world.emit("item:applied", {
    targetId,
    result: { type: "unknown_arcana" },
  });

  assertEquals(messageLog.entries.length, 3);
  assert(messageLog.entries[0].text.includes("coat"), "poison coat message should mention coating");
  assert(messageLog.entries[0].text.includes("12"), "poison coat message should include charges");
  assert(messageLog.entries[1].text.includes("AC +1"), "stonecoat message should include AC bonus");
  assert(messageLog.entries[2].text.includes("cryptic sheen"), "unknown apply result should use cryptic fallback");
});

Deno.test("messageWiring logs pet corpse munch flavor text", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();
  world.add(playerId, Player, {});

  const petId = world.create();
  world.add(petId, Pet);
  world.add(petId, NamedIdentity, { name: "Kitty", identity: "kitty" });

  const messageLog = createMessageLog();
  installMessageWiring({
    world,
    messageLog,
    playerEntity: () => ({ id: playerId, pos: { x: 0, y: 0 } }),
    bracketizeName: (s) => `[${s}]`,
    getSpell: () => null,
  });

  world.emit("pet:corpse-munch", {
    petId,
    corpseName: "Half-eaten Orc Corpse",
    heal: 2,
    partial: true,
    resistedToxin: true,
  });

  assertEquals(messageLog.entries.length, 1);
  assertEquals(messageLog.entries[0].type, "system");
  assert(messageLog.entries[0].text.includes("bite"), "message should mention taking a bite");
  assert(messageLog.entries[0].text.includes("Crunch"), "message should include flavor text");
  assert(messageLog.entries[0].text.includes("+2 HP"), "message should include healing");
  assert(messageLog.entries[0].text.includes("Iron stomach"), "message should mention toxin resistance flavor");
});
