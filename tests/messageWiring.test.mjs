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
import { Status } from "../src/rules/components/Status.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
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
      Status,
      ActiveEffects,
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
  assert(messageLog.entries[0].text.includes("home"), "homecoming should mention home");
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
  assert(messageLog.entries[0].text.includes("chunk") || messageLog.entries[0].text.includes("bite"), "message should mention eating");
  assert(messageLog.entries[0].text.includes("Crunch") || messageLog.entries[0].text.includes("crunch"), "message should include flavor text");
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
  assert(visibleLog.entries[0].text.includes("air") || visibleLog.entries[0].text.includes("wings"), "takeoff should describe flying");
  assert(visibleLog.entries[1].text.includes("ground") || visibleLog.entries[1].text.includes("lands") || visibleLog.entries[1].text.includes("folds"), "land should describe landing");
});

Deno.test("messageWiring suppresses non-player door toggle messages when door is not visible", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();
  world.add(playerId, Player, {});

  const npcId = world.create();
  world.add(npcId, NamedIdentity, { name: "Vendor", identity: "town_vendor" });

  const doorId = world.create();
  world.add(doorId, Position, { x: 10, y: 10 });

  const messageLog = createMessageLog();
  installWithDeps(world, messageLog, playerId, { isVisibleAt: () => false });

  world.emit("interaction", {
    actor: npcId,
    action: "toggleDoor",
    result: "closed",
    targetId: doorId,
  });

  assertEquals(messageLog.entries.length, 0);
});

Deno.test("messageWiring logs non-player door toggle messages when door is visible", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();
  world.add(playerId, Player, {});

  const npcId = world.create();
  world.add(npcId, NamedIdentity, { name: "Vendor", identity: "town_vendor" });

  const doorId = world.create();
  world.add(doorId, Position, { x: 10, y: 10 });

  const messageLog = createMessageLog();
  installWithDeps(world, messageLog, playerId, { isVisibleAt: () => true });

  world.emit("interaction", {
    actor: npcId,
    action: "toggleDoor",
    result: "closed",
    targetId: doorId,
  });

  assertEquals(messageLog.entries.length, 1);
  assert(messageLog.entries[0].text.includes("door"), "visible door toggle should be logged");
});

Deno.test("messageWiring always logs player door toggles even without visibility probe", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();
  world.add(playerId, Player, {});

  const doorId = world.create();
  world.add(doorId, Position, { x: 10, y: 10 });

  const messageLog = createMessageLog();
  installWithDeps(world, messageLog, playerId, { isVisibleAt: () => false });

  world.emit("interaction", {
    actor: playerId,
    action: "toggleDoor",
    result: "opened",
    targetId: doorId,
  });

  assertEquals(messageLog.entries.length, 1);
  assert(messageLog.entries[0].text.includes("door"), "player door toggle should always be logged");
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
  assert(texts.some((m) => /don't know/.test(m) || /nothing happens/.test(m)), "player should get player-facing not-known text");
  assert(texts.some((m) => /fumble/.test(m) || /gibberish/.test(m) || /unknown/.test(m)), "enemy should get enemy-facing not-known text");
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
  assert(texts.some((m) => /mana/.test(m) && /need/.test(m)), "player should get player-facing oom text with resource info");
  assert(texts.some((m) => /falter/.test(m) || /lacks/.test(m) || /drained/.test(m) || /empty/.test(m)), "enemy should get enemy-facing oom text");
});

Deno.test("messageWiring uses ranged slot weapon name for ranged damage logs", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Equipment, {});

  const targetId = world.create();
  world.add(targetId, NamedIdentity, { name: "Training Dummy", identity: "dummy" });

  const daggerId = world.create();
  world.add(daggerId, NamedIdentity, { name: "Dagger", identity: "dagger_quick" });
  world.add(daggerId, ItemInfo, { type: "equip", slot: "weapon", count: 1, bonuses: {}, affixes: [] });

  const bowId = world.create();
  world.add(bowId, NamedIdentity, { name: "Short Bow", identity: "bow_short" });
  world.add(bowId, ItemInfo, { type: "equip", slot: "ranged", subtype: "bow", count: 1, bonuses: {}, affixes: [] });

  world.mutate(playerId, Equipment, (eq) => {
    eq.weapon = daggerId;
    eq.ranged = bowId;
  });

  const messageLog = createMessageLog();
  installWithDeps(world, messageLog, playerId);

  world.emit("damaged", {
    source: playerId,
    target: targetId,
    amount: 4,
    cause: "ranged",
  });

  assertEquals(messageLog.entries.length, 1);
  const text = String(messageLog.entries[0].text || "");
  assert(text.includes("[Short Bow]"), "ranged combat log should use ranged weapon name");
  assert(!text.includes("[Dagger]"), "ranged combat log should not use melee weapon name");
});

Deno.test("messageWiring includes hit severity and hp context when provided", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Equipment, {});

  const targetId = world.create();
  world.add(targetId, NamedIdentity, { name: "Grid Bug", identity: "grid_bug" });

  const pickaxeId = world.create();
  world.add(pickaxeId, NamedIdentity, { name: "Iron Pickaxe", identity: "iron_pickaxe" });
  world.add(pickaxeId, ItemInfo, { type: "equip", slot: "weapon", combatFlavor: "brutal", count: 1, bonuses: {}, affixes: [] });
  world.mutate(playerId, Equipment, (eq) => { eq.weapon = pickaxeId; });

  const messageLog = createMessageLog();
  installWithDeps(world, messageLog, playerId);

  world.emit("damaged", {
    source: playerId,
    target: targetId,
    amount: 16,
    cause: "melee",
    hpAfter: 2,
    maxHp: 18,
  });

  assertEquals(messageLog.entries.length, 1);
  const text = String(messageLog.entries[0].text || "");
  assert(text.includes("brutally"), "weapon flavor should modify the attack verb");
  assert(!text.includes("(brutal)"), "weapon flavor should not be appended as parenthetical");
  assert(text.includes("devastating"), "damage log should include severity flavor");
  assert(text.includes("barely standing"), "damage log should include wound-state flavor");
  assert(!text.includes("HP"), "damage log should avoid readout-style HP telemetry");
});

Deno.test("messageWiring wound flavor does not claim bleeding without bleed status", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Equipment, {});

  const targetId = world.create();
  world.add(targetId, NamedIdentity, { name: "Target Dummy", identity: "dummy" });

  const messageLog = createMessageLog();
  installWithDeps(world, messageLog, playerId);

  world.emit("damaged", {
    source: playerId,
    target: targetId,
    amount: 3,
    cause: "melee",
    hpAfter: 6,
    maxHp: 12,
  });

  assertEquals(messageLog.entries.length, 1);
  const text = String(messageLog.entries[0].text || "").toLowerCase();
  assert(text.includes("wounded"), "expected wounded flavor at 50% hp");
  assert(!text.includes("bleeding"), "should not claim bleeding when target has no bleed status");
});

Deno.test("messageWiring wound flavor mentions bleeding when bleed status is present", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Equipment, {});

  const targetId = world.create();
  world.add(targetId, NamedIdentity, { name: "Bleeding Dummy", identity: "dummy" });
  world.add(targetId, Status, {
    statuses: [{ type: "bleeding", duration: 3, potency: 1 }],
  });

  const messageLog = createMessageLog();
  installWithDeps(world, messageLog, playerId);

  world.emit("damaged", {
    source: playerId,
    target: targetId,
    amount: 3,
    cause: "melee",
    hpAfter: 6,
    maxHp: 12,
  });

  assertEquals(messageLog.entries.length, 1);
  const text = String(messageLog.entries[0].text || "").toLowerCase();
  assert(text.includes("wounded and bleeding"), "should mention bleeding when bleed status is present");
});

Deno.test("messageWiring wound flavor recognizes bleeding from ActiveEffects", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Equipment, {});

  const targetId = world.create();
  world.add(targetId, NamedIdentity, { name: "Bleeding by Effect", identity: "dummy" });
  world.add(targetId, ActiveEffects, {
    effects: [{ key: "bleed", turnsLeft: 2, potency: 1 }],
  });

  const messageLog = createMessageLog();
  installWithDeps(world, messageLog, playerId);

  world.emit("damaged", {
    source: playerId,
    target: targetId,
    amount: 3,
    cause: "melee",
    hpAfter: 6,
    maxHp: 12,
  });

  assertEquals(messageLog.entries.length, 1);
  const text = String(messageLog.entries[0].text || "").toLowerCase();
  assert(text.includes("bleeding"), "active bleed effect should produce bleeding wound prose");
});

Deno.test("messageWiring varies repeated wound prose in same combat context", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Equipment, {});

  const targetId = world.create();
  world.add(targetId, NamedIdentity, { name: "Skeleton Guard", identity: "skeleton_guard" });
  world.add(targetId, Status, {
    statuses: [{ type: "bleeding", duration: 3, potency: 1 }],
  });

  const messageLog = createMessageLog();
  installWithDeps(world, messageLog, playerId);

  world.emit("damaged", {
    source: playerId,
    target: targetId,
    amount: 3,
    cause: "melee",
    hpAfter: 6,
    maxHp: 12,
  });
  world.emit("damaged", {
    source: playerId,
    target: targetId,
    amount: 3,
    cause: "melee",
    hpAfter: 6,
    maxHp: 12,
  });

  assertEquals(messageLog.entries.length, 2);
  const first = String(messageLog.entries[0].text || "");
  const second = String(messageLog.entries[1].text || "");
  assert(first !== second, "repeated same-context hits should rotate wound prose");
});

Deno.test("messageWiring logs spell-proc gear messages for player events", () => {
  const world = new World({ seed: 99 });
  const playerId = world.create();
  world.add(playerId, Player, {});

  const targetId = world.create();
  world.add(targetId, NamedIdentity, { name: "Goblin", identity: "goblin" });
  world.add(targetId, Position, { x: 4, y: 4 });

  const messageLog = createMessageLog();
  installWithDeps(world, messageLog, playerId, { isVisibleAt: () => true });

  world.emit("proc:glacierSigil", { actor: playerId, targetId });
  world.emit("proc:conductionLens", { actor: playerId, extraChains: 1 });
  world.emit("proc:echoGrimoire:echo", { actor: playerId, spellId: "frost", powerScale: 0.8 });

  assertEquals(messageLog.entries.length, 3);
  assert(messageLog.entries[0].text.toLowerCase().includes("sigil") || messageLog.entries[0].text.includes("ice"), "glacier sigil should mention sigil or ice");
  assert(messageLog.entries[1].text.toLowerCase().includes("lens") || messageLog.entries[1].text.includes("lightning") || messageLog.entries[1].text.includes("fork"), "conduction lens should mention lens or lightning");
  assert(messageLog.entries[2].text.toLowerCase().includes("grimoire") || messageLog.entries[2].text.includes("echo"), "echo grimoire should mention grimoire or echo");
  assert(messageLog.entries[2].text.includes("80%"), "echo grimoire should include power percentage");
});

Deno.test("messageWiring logs explicit bleeding proc sources", () => {
  const world = new World({ seed: 55 });
  const playerId = world.create();
  world.add(playerId, Player, {});

  const enemyId = world.create();
  world.add(enemyId, NamedIdentity, { name: "Wolf", identity: "wolf" });

  const messageLog = createMessageLog();
  installWithDeps(world, messageLog, playerId, { isVisibleAt: () => true });

  world.emit("proc:bleeding", { actor: enemyId, target: playerId });
  world.emit("proc:hemorrhage", { actor: playerId, target: enemyId });

  assertEquals(messageLog.entries.length, 2);
  assert(messageLog.entries[0].text.includes("wound"), "bleeding proc should mention the wound");
  assert(messageLog.entries[1].text.includes("wound") || messageLog.entries[1].text.includes("rips"), "hemorrhage proc should describe the wound worsening");
});

Deno.test("messageWiring logs player item:pickup events", () => {
  const world = new World({ seed: 321 });
  const playerId = world.create();
  world.add(playerId, Player, {});

  const itemId = world.create();
  world.add(itemId, NamedIdentity, { name: "Apple", identity: "apple" });
  world.add(itemId, ItemInfo, { type: "food", count: 1, weight: 0.2, bonuses: {}, affixes: [] });

  const messageLog = createMessageLog();
  installWithDeps(world, messageLog, playerId);

  world.emit("item:pickup", { actor: playerId, itemId, count: 1, itemX: 1, itemY: 1 });

  assertEquals(messageLog.entries.length, 1);
  assert(messageLog.entries[0].text.includes("You pick up"), "pickup should be logged");
  assert(messageLog.entries[0].text.includes("[Apple]"), "pickup message should include item name");
});

Deno.test("messageWiring logs legacy pickup events", () => {
  const world = new World({ seed: 654 });
  const playerId = world.create();
  world.add(playerId, Player, {});

  const itemId = world.create();
  world.add(itemId, NamedIdentity, { name: "Apple", identity: "apple" });
  world.add(itemId, ItemInfo, { type: "food", count: 1, weight: 0.2, bonuses: {}, affixes: [] });

  const messageLog = createMessageLog();
  installWithDeps(world, messageLog, playerId);

  world.emit("pickup", { id: playerId, itemId, at: { x: 1, y: 1 } });

  assertEquals(messageLog.entries.length, 1);
  assert(messageLog.entries[0].text.includes("You pick up"), "legacy pickup should be logged");
  assert(messageLog.entries[0].text.includes("[Apple]"), "legacy pickup message should include item name");
});
