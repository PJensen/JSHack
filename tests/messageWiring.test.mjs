import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Player } from "../src/rules/components/Player.js";
import { Pet } from "../src/rules/components/Pet.js";
import { Anatomy } from "../src/rules/components/Anatomy.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Owner } from "../src/rules/components/Owner.js";
import { Position } from "../src/rules/components/Position.js";
import { Devotion } from "../src/rules/components/Devotion.js";
import { HEARING_TIERS } from "../src/rules/components/Anatomy.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { evaluateSound, thresholdForTier } from "../src/rules/utils/sound.js";
import { resolveItemDisplayName } from "../src/main/wiring/itemName.js";
import { installMessageWiring } from "../src/display/ui/wiring/messageWiring.js";

function installWithDeps(world, messageLog, playerId, { isVisibleAt } = {}) {
  installMessageWiring({
    world,
    messageLog,
    playerEntity: () => ({ id: playerId, pos: { x: 0, y: 0 } }),
    bracketizeName: (s) => `[${s}]`,
    getSpell: () => null,
    resolveItemDisplayName,
    isVisibleAt,
    components: {
      Equipment,
      ItemInfo,
      NamedIdentity,
      Owner,
      Pet,
      Player,
      Position,
      Devotion,
      Anatomy,
      DungeonState,
    },
    soundApi: {
      evaluateSound,
      thresholdForTier,
      HEARING_TIERS,
    },
  });
}

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
  installWithDeps(world, messageLog, playerId);

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
  installWithDeps(world, messageLog, playerId);

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
  installWithDeps(world, messageLog, playerId);

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
  installWithDeps(world, messageLog, playerId);

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

Deno.test("messageWiring resolves ambient sound audibility by depth, hearing tier, and dB clarity", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Anatomy, { parts: [], hearing: "mid" });
  const dungeonId = world.create();
  world.add(dungeonId, DungeonState, { worldSeed: 42, currentDepth: 2, floorEntityIds: [] });

  const messageLog = createMessageLog();
  installWithDeps(world, messageLog, playerId);

  world.emit("ambient:sound", {
    source: "fountain",
    depth: 3,
    at: { x: 1, y: 1 },
    sourceDbAt1Tile: 80,
    clarity: {
      far: "you hear faint gurgling",
      mid: "you hear running water",
      near: "you hear water gushing to life",
    },
  });
  assertEquals(messageLog.entries.length, 0);

  world.emit("ambient:sound", {
    source: "fountain",
    depth: 2,
    at: { x: 1, y: 1 },
    sourceDbAt1Tile: 80,
    clarity: {
      far: "you hear faint gurgling",
      mid: "you hear running water",
      near: "you hear water gushing to life",
    },
  });
  assertEquals(messageLog.entries.length, 1);
  assertEquals(messageLog.entries[0].text, "you hear running water");

  world.emit("ambient:sound", {
    source: "fountain",
    depth: 2,
    at: { x: 32, y: 0 },
    sourceDbAt1Tile: 60,
    clarity: {
      far: "you hear faint trade chatter",
      mid: "you hear trade chatter nearby",
      near: "you hear loud trade chatter close by",
    },
  });
  assertEquals(messageLog.entries.length, 1);

  world.emit("ambient:sound", {
    source: "shop",
    depth: 2,
    at: { x: 1, y: 0 },
    sourceDbAt1Tile: 80,
    clarity: {
      far: "you hear faint market noise",
      mid: "you hear market chatter nearby",
      near: "you hear loud market clamor",
    },
  });
  assertEquals(messageLog.entries.length, 2);
  assertEquals(messageLog.entries[1].text, "YOU HEAR MARKET CHATTER NEARBY");
});

Deno.test("messageWiring only logs flying messages for visible creatures", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();
  world.add(playerId, Player, {});

  const hiddenLog = createMessageLog();
  installWithDeps(world, hiddenLog, playerId, { isVisibleAt: () => false });
  world.emit("proc:fly:takeoff", { name: "Bat", x: 10, y: 10 });
  assertEquals(hiddenLog.entries.length, 0);

  const visibleWorld = new World({ seed: 42 });
  const visiblePlayerId = visibleWorld.create();
  visibleWorld.add(visiblePlayerId, Player, {});
  const visibleLog = createMessageLog();
  installWithDeps(visibleWorld, visibleLog, visiblePlayerId, { isVisibleAt: () => true });
  visibleWorld.emit("proc:fly:takeoff", { name: "Bat", x: 10, y: 10 });
  visibleWorld.emit("proc:fly:land", { name: "Bat", x: 10, y: 10 });
  assertEquals(visibleLog.entries.length, 2);
  assert(visibleLog.entries[0].text.includes("takes to the air"));
  assert(visibleLog.entries[1].text.includes("lands"));
});

Deno.test("messageWiring scopes spell:not-known text by actor", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();
  world.add(playerId, Player, {});
  const warlockId = world.create();
  world.add(warlockId, NamedIdentity, { name: "Warlock", identity: "skeletal_agony_warlock" });
  const messageLog = createMessageLog();
  installWithDeps(world, messageLog, playerId);

  world.emit("spell:not-known", { actor: playerId, spellId: "agony" });
  world.emit("spell:not-known", { actor: warlockId, spellId: "agony" });

  const texts = messageLog.entries.map((e) => e.text);
  assert(texts.some((m) => /You don't know that spell/.test(m)), "player should get player-facing not-known text");
  assert(texts.some((m) => /tries to cast an unknown spell/.test(m)), "enemy should get enemy-facing not-known text");
});

Deno.test("messageWiring scopes spell:oom text by actor", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();
  world.add(playerId, Player, {});
  const warlockId = world.create();
  world.add(warlockId, NamedIdentity, { name: "Warlock", identity: "skeletal_agony_warlock" });
  const messageLog = createMessageLog();
  installWithDeps(world, messageLog, playerId);

  world.emit("spell:oom", { actor: playerId, spellId: "agony", need: 8, have: 0 });
  world.emit("spell:oom", { actor: warlockId, spellId: "agony", need: 8, have: 0 });

  const texts = messageLog.entries.map((e) => e.text);
  assert(texts.some((m) => /Not enough mana to cast/.test(m)), "player should get player-facing oom text");
  assert(texts.some((m) => /lacks mana/.test(m)), "enemy should get enemy-facing oom text");
});
