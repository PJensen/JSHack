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

Deno.test("movement tip fires after 4 player moves", () => {
  const { world, playerId, bubbles } = setup();

  for (let i = 0; i < 3; i++) {
    world.emit("moved", { id: playerId, from: { x: 5 + i, y: 5 }, to: { x: 6 + i, y: 5 } });
  }
  assertEquals(bubbles.filter((b) => b.text.includes("Tap the screen")).length, 0,
    "should not fire before 4 moves");

  world.emit("moved", { id: playerId, from: { x: 8, y: 5 }, to: { x: 9, y: 5 } });
  const match = bubbles.find((b) => b.text.includes("Tap the screen"));
  assert(match, "movement tip should fire on 4th move");
  clearGuideStorage();
});

Deno.test("first_pickup tip fires on item:pickup", () => {
  const { world, playerId, bubbles } = setup();

  world.emit("item:pickup", { actor: playerId, itemId: 99, count: 1, itemX: 5, itemY: 5 });
  const match = bubbles.find((b) => b.text.includes("inventory"));
  assert(match, "first_pickup tip should fire on item:pickup");
  clearGuideStorage();
});

Deno.test("first_combat tip fires when player takes damage", () => {
  const { world, playerId, bubbles } = setup();

  world.emit("damaged", { target: playerId, source: 42, amount: 5, type: "physical", cause: "melee", critical: false });
  const match = bubbles.find((b) => b.text.includes("enemy"));
  assert(match, "first_combat tip should fire when player is damaged");
  clearGuideStorage();
});

Deno.test("low_hp tip fires when player HP drops below 40%", () => {
  const { world, playerId, bubbles } = setup();

  // Fire first_combat first so it doesn't shadow.
  world.emit("damaged", { target: playerId, source: 42, amount: 5, type: "physical", cause: "melee", critical: false });

  // Bring HP low.
  const vit = world.get(playerId, Vitality);
  vit.hp = 30;
  world.emit("damaged", { target: playerId, source: 42, amount: 5, type: "physical", cause: "melee", critical: false });
  const match = bubbles.find((b) => b.text.includes("wounded"));
  assert(match, "low_hp tip should fire when HP below 40%");
  clearGuideStorage();
});

Deno.test("first_stair tip fires on dungeon:transitioned", () => {
  const { world, bubbles } = setup();

  world.emit("dungeon:transitioned", { depth: 1, pos: { x: 5, y: 5 } });
  const match = bubbles.find((b) => b.text.includes("Stairs"));
  assert(match, "first_stair tip should fire on dungeon transition");
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
  const { world, wisp } = setup();
  assert(wisp.guideMode, "guide mode should be enabled when unseen tips remain");

  let pulsed = false;
  world.on("guidance:pulse", () => { pulsed = true; });

  world.emit("dungeon:transitioned", { depth: 1, pos: { x: 5, y: 5 } });
  assert(pulsed, "guidance:pulse should be emitted when a tip fires");
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
