import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Player } from "../src/rules/components/Player.js";
import {
  GUIDANCE_TIPS,
  GUIDE_STORAGE_KEY,
  readSeenTips,
  markTipSeen,
} from "../src/shared/data/spiritGuidance.js";
import { installSpiritGuideWiring } from "../src/main/wiring/spiritGuideWiring.js";

// ── Test helpers ────────────────────────────────────────────────────

function clearGuideStorage() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(GUIDE_STORAGE_KEY);
    }
  } catch { /* ok */ }
}

function makeBubbleCapture() {
  const bubbles = [];
  return {
    bubbles,
    queueSpeechBubble(opts) {
      bubbles.push(opts);
    },
  };
}

function makeWispStub() {
  let guide = false;
  return {
    setGuideMode(v) { guide = !!v; },
    get guideMode() { return guide; },
  };
}

function setup() {
  clearGuideStorage();

  const world = new World({ seed: 0xBEEF });
  const playerId = world.create();
  world.add(playerId, Position, { x: 5, y: 5 });
  world.add(playerId, Player);
  world.add(playerId, Vitality, { maxHp: 100, hp: 100 });

  const cap = makeBubbleCapture();
  const wisp = makeWispStub();

  installSpiritGuideWiring({
    world,
    sceneRuntime: cap,
    getPlayerEntity: () => (world.isAlive(playerId) ? { id: playerId } : null),
    spiritWispFx: wisp,
  });

  return { world, playerId, bubbles: cap.bubbles, wisp };
}

// ── Tip data integrity ──────────────────────────────────────────────

Deno.test("all guidance tips have unique IDs", () => {
  const ids = GUIDANCE_TIPS.map((t) => t.id);
  assertEquals(ids.length, new Set(ids).size, "duplicate tip IDs found");
});

Deno.test("all guidance tips have non-empty text", () => {
  for (const tip of GUIDANCE_TIPS) {
    assert(tip.text && tip.text.length > 0, `tip '${tip.id}' has empty text`);
  }
});

// ── readSeenTips / markTipSeen ──────────────────────────────────────

Deno.test("readSeenTips returns empty set when nothing stored", () => {
  clearGuideStorage();
  const seen = readSeenTips();
  assert(seen instanceof Set);
  assertEquals(seen.size, 0);
});

Deno.test("markTipSeen persists and round-trips", () => {
  clearGuideStorage();
  const seen = new Set();
  markTipSeen(seen, "test_tip_xyz");
  assert(seen.has("test_tip_xyz"));
  clearGuideStorage();
});

// ── Event-driven triggers ───────────────────────────────────────────

Deno.test("welcome tip fires on first player move", () => {
  const { world, playerId, bubbles } = setup();

  world.emit("moved", { id: playerId, from: { x: 5, y: 5 }, to: { x: 6, y: 5 } });
  const match = bubbles.find((b) => b.text.includes("spirit of these lands"));
  assert(match, "welcome tip should fire on first move");
  clearGuideStorage();
});

Deno.test("movement tip fires on 8th player move", () => {
  const { world, playerId, bubbles } = setup();

  for (let i = 0; i < 7; i++) {
    world.emit("moved", { id: playerId, from: { x: 5 + i, y: 5 }, to: { x: 6 + i, y: 5 } });
  }
  assertEquals(bubbles.filter((b) => b.text.includes("Tap the screen")).length, 0,
    "should not fire before 8 moves");

  world.emit("moved", { id: playerId, from: { x: 12, y: 5 }, to: { x: 13, y: 5 } });
  const match = bubbles.find((b) => b.text.includes("Tap the screen"));
  assert(match, "movement tip should fire on 8th move");
  clearGuideStorage();
});

Deno.test("pet_companion tip fires on pet:deliver", () => {
  const { world, bubbles } = setup();

  world.emit("pet:deliver", { petId: 77, itemId: 99 });
  const match = bubbles.find((b) => b.text.includes("companion"));
  assert(match, "pet_companion tip should fire when pet delivers an item");
  clearGuideStorage();
});

Deno.test("quick_items tip fires on consumable pickup", () => {
  const { world, playerId, bubbles } = setup();

  // Create a potion entity for the identity check.
  const potionId = world.create();
  world.add(potionId, NamedIdentity, { identity: "potion_heal", name: "Healing Potion" });

  world.emit("item:pickup", { actor: playerId, itemId: potionId, count: 1, itemX: 5, itemY: 5 });
  const match = bubbles.find((b) => b.text.includes("pinned items"));
  assert(match, "quick_items tip should fire on consumable pickup");
  clearGuideStorage();
});

Deno.test("first_pickup tip fires on item:pickup", () => {
  const { world, playerId, bubbles } = setup();

  world.emit("item:pickup", { actor: playerId, itemId: 99, count: 1, itemX: 5, itemY: 5 });
  const match = bubbles.find((b) => b.text.includes("inventory"));
  assert(match, "first_pickup tip should fire on item:pickup");
  clearGuideStorage();
});

Deno.test("first_gem tip fires on gem pickup", () => {
  const { world, playerId, bubbles } = setup();

  const gemId = world.create();
  world.add(gemId, NamedIdentity, { identity: "gem_ruby", name: "Ruby" });

  world.emit("item:pickup", { actor: playerId, itemId: gemId, count: 1, itemX: 5, itemY: 5 });
  const match = bubbles.find((b) => b.text.includes("Socket"));
  assert(match, "first_gem tip should fire on gem pickup");
  clearGuideStorage();
});

Deno.test("first_spellbook tip fires on spellbook pickup", () => {
  const { world, playerId, bubbles } = setup();

  const bookId = world.create();
  world.add(bookId, NamedIdentity, { identity: "book_lightning", name: "Book of Lightning" });

  world.emit("item:pickup", { actor: playerId, itemId: bookId, count: 1, itemX: 5, itemY: 5 });
  const match = bubbles.find((b) => b.text.includes("spellbook"));
  assert(match, "first_spellbook tip should fire on spellbook pickup");
  clearGuideStorage();
});

Deno.test("first_combat tip fires when enemy spots player", () => {
  const { world, playerId, bubbles } = setup();

  world.emit("status", { id: 42, kind: "alert", at: { x: 8, y: 5 } });
  const match = bubbles.find((b) => b.text.includes("enemy"));
  assert(match, "first_combat tip should fire on enemy alert");
  clearGuideStorage();
});

Deno.test("low_hp tip fires when player HP drops below 40%", () => {
  const { world, playerId, bubbles } = setup();

  // Fire first_combat first via enemy alert so it doesn't shadow.
  world.emit("status", { id: 42, kind: "alert", at: { x: 8, y: 5 } });

  // Bring HP low.
  const vit = world.get(playerId, Vitality);
  vit.hp = 30;
  world.emit("damaged", { target: playerId, source: 42, amount: 5, type: "physical", cause: "melee", critical: false });
  const match = bubbles.find((b) => b.text.includes("wounded"));
  assert(match, "low_hp tip should fire when HP below 40%");
  clearGuideStorage();
});

Deno.test("first_stair tip fires when player walks near stairs", () => {
  const { world, playerId, bubbles } = setup();

  const stairId = world.create();
  world.add(stairId, Position, { x: 7, y: 5 });
  world.add(stairId, NamedIdentity, { identity: "stair_down", name: "Stairs Down" });

  world.emit("moved", { id: playerId, from: { x: 5, y: 5 }, to: { x: 6, y: 5 } });
  const match = bubbles.find((b) => b.text.includes("stairs"));
  assert(match, "first_stair tip should fire when player walks near stairs");
  clearGuideStorage();
});

Deno.test("first_spell tip fires on spell:learned", () => {
  const { world, playerId, bubbles } = setup();

  world.emit("spell:learned", { actor: playerId, spellId: "frost" });
  const match = bubbles.find((b) => b.text.includes("spell"));
  assert(match, "first_spell tip should fire on spell:learned");
  clearGuideStorage();
});

Deno.test("tips do not fire twice for the same trigger", () => {
  const { world, playerId, bubbles } = setup();

  world.emit("item:pickup", { actor: playerId, itemId: 99, count: 1, itemX: 5, itemY: 5 });
  const countA = bubbles.filter((b) => b.text.includes("inventory")).length;
  world.emit("item:pickup", { actor: playerId, itemId: 100, count: 1, itemX: 6, itemY: 5 });
  const countB = bubbles.filter((b) => b.text.includes("inventory")).length;
  assertEquals(countA, countB, "same tip should not fire twice");
  clearGuideStorage();
});

Deno.test("guide mode enabled when tips remain, and emits guidance:pulse", () => {
  const { world, playerId, wisp } = setup();
  assert(wisp.guideMode, "guide mode should be enabled when unseen tips remain");

  let pulsed = false;
  world.on("guidance:pulse", () => { pulsed = true; });

  const stairId = world.create();
  world.add(stairId, Position, { x: 7, y: 5 });
  world.add(stairId, NamedIdentity, { identity: "stair_down", name: "Stairs Down" });
  world.emit("moved", { id: playerId, from: { x: 5, y: 5 }, to: { x: 6, y: 5 } });
  assert(pulsed, "guidance:pulse should be emitted when a tip fires");
  clearGuideStorage();
});

Deno.test("first_equip tip fires on item:equipped", () => {
  const { world, playerId, bubbles } = setup();

  world.emit("item:equipped", { actor: playerId, itemId: 50, slot: "weapon", name: "Sword" });
  const match = bubbles.find((b) => b.text.includes("character sheet"));
  assert(match, "first_equip tip should fire on item:equipped");
  clearGuideStorage();
});

Deno.test("wait_action tip fires after first_combat is seen", () => {
  const { world, playerId, bubbles } = setup();

  // Fire first_combat via enemy alert.
  world.emit("status", { id: 42, kind: "alert", at: { x: 8, y: 5 } });
  // Now damage should trigger wait_action.
  world.emit("damaged", { target: playerId, source: 42, amount: 3, type: "physical", cause: "melee", critical: false });
  const match = bubbles.find((b) => b.text.includes("Wait"));
  assert(match, "wait_action tip should fire after first_combat is seen");
  clearGuideStorage();
});

Deno.test("spell_select tip fires on second spell learned", () => {
  const { world, playerId, bubbles } = setup();

  world.emit("spell:learned", { actor: playerId, spellId: "frost" });
  assertEquals(bubbles.filter((b) => b.text.includes("multiple spells")).length, 0,
    "should not fire on first spell");

  world.emit("spell:learned", { actor: playerId, spellId: "agony" });
  const match = bubbles.find((b) => b.text.includes("multiple spells"));
  assert(match, "spell_select tip should fire on second spell:learned");
  clearGuideStorage();
});

Deno.test("non-player events do not trigger tips", () => {
  const { world, bubbles } = setup();

  const otherId = world.create();
  world.add(otherId, Position, { x: 10, y: 10 });

  world.emit("item:pickup", { actor: otherId, itemId: 99, count: 1, itemX: 10, itemY: 10 });
  const match = bubbles.find((b) => b.text.includes("inventory"));
  assertEquals(match, undefined, "non-player pickup should not trigger tips");
  clearGuideStorage();
});

// ── Interactable tips ──────────────────────────────────────────────

Deno.test("first_fountain tip fires when player walks near fountain", () => {
  const { world, playerId, bubbles } = setup();

  const ftnId = world.create();
  world.add(ftnId, Position, { x: 8, y: 5 });
  world.add(ftnId, NamedIdentity, { identity: "fountain", name: "Fountain" });

  world.emit("moved", { id: playerId, from: { x: 5, y: 5 }, to: { x: 6, y: 5 } });
  const match = bubbles.find((b) => b.text.includes("fountain"));
  assert(match, "first_fountain tip should fire when player walks near fountain");
  clearGuideStorage();
});

Deno.test("first_door tip fires when player walks near door", () => {
  const { world, playerId, bubbles } = setup();

  const doorId = world.create();
  world.add(doorId, Position, { x: 7, y: 5 });
  world.add(doorId, NamedIdentity, { identity: "door", name: "Door" });

  world.emit("moved", { id: playerId, from: { x: 5, y: 5 }, to: { x: 6, y: 5 } });
  const match = bubbles.find((b) => b.text.includes("door"));
  assert(match, "first_door tip should fire when player walks near door");
  clearGuideStorage();
});

Deno.test("first_trap tip fires on trap:triggered", () => {
  const { world, playerId, bubbles } = setup();

  world.emit("trap:triggered", { actor: playerId, trapId: 202 });
  const match = bubbles.find((b) => b.text.includes("trap"));
  assert(match, "first_trap tip should fire on trap:triggered");
  clearGuideStorage();
});

Deno.test("first_chest tip fires when player walks near chest", () => {
  const { world, playerId, bubbles } = setup();

  const chestId = world.create();
  world.add(chestId, Position, { x: 8, y: 5 });
  world.add(chestId, NamedIdentity, { identity: "chest", name: "Chest" });

  world.emit("moved", { id: playerId, from: { x: 5, y: 5 }, to: { x: 6, y: 5 } });
  const match = bubbles.find((b) => b.text.includes("chest"));
  assert(match, "first_chest tip should fire when player walks near chest");
  clearGuideStorage();
});

Deno.test("first_shop tip fires on shop:open", () => {
  const { world, playerId, bubbles } = setup();

  world.emit("shop:open", { actor: playerId, targetId: 204, buyMarkup: 1.5, sellDiscount: 0.5 });
  const match = bubbles.find((b) => b.text.includes("shop"));
  assert(match, "first_shop tip should fire on shop:open");
  clearGuideStorage();
});

Deno.test("first_harvest tip fires on harvest:picked", () => {
  const { world, playerId, bubbles } = setup();

  world.emit("harvest:picked", { actor: playerId, targetId: 205, kind: "mushroom" });
  const match = bubbles.find((b) => b.text.includes("harvested"));
  assert(match, "first_harvest tip should fire on harvest:picked");
  clearGuideStorage();
});

Deno.test("first_craft tip fires on alchemy:open", () => {
  const { world, playerId, bubbles } = setup();

  world.emit("alchemy:open", { actor: playerId, targetId: 206, ingredients: [], recipes: [] });
  const match = bubbles.find((b) => b.text.includes("crafting station"));
  assert(match, "first_craft tip should fire on alchemy:open");
  clearGuideStorage();
});

Deno.test("first_craft tip fires on cooking:open", () => {
  const { world, playerId, bubbles } = setup();

  world.emit("cooking:open", { actor: playerId, targetId: 207, corpses: [], herbs: [] });
  const match = bubbles.find((b) => b.text.includes("crafting station"));
  assert(match, "first_craft tip should fire on cooking:open");
  clearGuideStorage();
});

Deno.test("first_craft tip fires on smithy:open", () => {
  const { world, playerId, bubbles } = setup();

  world.emit("smithy:open", { actor: playerId, targetId: 208, station: "anvil", materials: [], recipes: [] });
  const match = bubbles.find((b) => b.text.includes("crafting station"));
  assert(match, "first_craft tip should fire on smithy:open");
  clearGuideStorage();
});

Deno.test("first_shrine tip fires when player walks near shrine", () => {
  const { world, playerId, bubbles } = setup();

  const shrineId = world.create();
  world.add(shrineId, Position, { x: 8, y: 5 });
  world.add(shrineId, NamedIdentity, { identity: "shrine", name: "Shrine" });

  world.emit("moved", { id: playerId, from: { x: 5, y: 5 }, to: { x: 6, y: 5 } });
  const match = bubbles.find((b) => b.text.includes("shrine"));
  assert(match, "first_shrine tip should fire when player walks near shrine");
  clearGuideStorage();
});

Deno.test("first_weapon_rack tip fires when player walks near rack", () => {
  const { world, playerId, bubbles } = setup();

  const rackId = world.create();
  world.add(rackId, Position, { x: 7, y: 5 });
  world.add(rackId, NamedIdentity, { identity: "weapon_rack", name: "Weapon Rack" });

  world.emit("moved", { id: playerId, from: { x: 5, y: 5 }, to: { x: 6, y: 5 } });
  const match = bubbles.find((b) => b.text.includes("weapon rack"));
  assert(match, "first_weapon_rack tip should fire when player walks near rack");
  clearGuideStorage();
});

Deno.test("first_sarcophagus tip fires when player walks near sarcophagus", () => {
  const { world, playerId, bubbles } = setup();

  const sarcId = world.create();
  world.add(sarcId, Position, { x: 9, y: 5 });
  world.add(sarcId, NamedIdentity, { identity: "sarcophagus", name: "Sarcophagus" });

  world.emit("moved", { id: playerId, from: { x: 5, y: 5 }, to: { x: 6, y: 5 } });
  const match = bubbles.find((b) => b.text.includes("sarcophagus"));
  assert(match, "first_sarcophagus tip should fire when player walks near sarcophagus");
  clearGuideStorage();
});

Deno.test("first_weather tip fires on rain weather:changed", () => {
  const { world, bubbles } = setup();

  world.emit("weather:changed", { weather: "rain", prev: "clear" });
  const match = bubbles.find((b) => b.text.includes("Rain"));
  assert(match, "first_weather tip should fire on rain weather:changed");
  clearGuideStorage();
});

Deno.test("first_weather tip does not fire on clear weather", () => {
  const { world, bubbles } = setup();

  world.emit("weather:changed", { weather: "clear", prev: "rain" });
  const match = bubbles.find((b) => b.text.includes("Rain"));
  assertEquals(match, undefined, "first_weather tip should not fire on clear weather");
  clearGuideStorage();
});

Deno.test("first_dual_wield tip fires on offhand equip", () => {
  const { world, playerId, bubbles } = setup();

  world.emit("item:equipped", { actor: playerId, itemId: 212, slot: "offhand", name: "Dagger" });
  const match = bubbles.find((b) => b.text.includes("off-hand"));
  assert(match, "first_dual_wield tip should fire on offhand equip");
  clearGuideStorage();
});

Deno.test("first_dual_wield tip does not fire on weapon slot equip", () => {
  const { world, playerId, bubbles } = setup();

  world.emit("item:equipped", { actor: playerId, itemId: 213, slot: "weapon", name: "Sword" });
  // Should fire first_equip, not first_dual_wield
  const match = bubbles.find((b) => b.text.includes("off-hand"));
  assertEquals(match, undefined, "first_dual_wield should not fire on weapon slot equip");
  clearGuideStorage();
});
