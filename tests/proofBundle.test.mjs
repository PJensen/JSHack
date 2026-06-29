import { assertEquals, assert, assertThrows } from "jsr:@std/assert";
import {
  PROOF_VERSION,
  createEmptyBundle,
  canonicalizeAction,
  validateBundle,
  serializeBundle,
  deserializeBundle,
} from "../src/cloud/proof/proofBundle.js";

// ---------------------------------------------------------------------------
// createEmptyBundle
// ---------------------------------------------------------------------------
Deno.test("createEmptyBundle has correct defaults", () => {
  const b = createEmptyBundle(0xC0FFEE, "dGVzdG5vbmNl");
  assertEquals(b.version, PROOF_VERSION);
  assertEquals(b.engine, "jshack");
  assertEquals(b.seed, 0xC0FFEE);
  assertEquals(b.nonce, "dGVzdG5vbmNl");
  assertEquals(b.actions, []);
  assertEquals(b.chainHash, null);
  assertEquals(b.score, 0);
  assertEquals(b.depth, 0);
  assertEquals(b.turns, 0);
  assertEquals(b.timestamp, null);
  assertEquals(b.playerName, null);
  assertEquals(b.playerClass, null);
  assertEquals(b.engineVersion, null);
  assertEquals(b.resumedFromSave, false);
});

Deno.test("createEmptyBundle coerces seed to unsigned 32-bit", () => {
  const b = createEmptyBundle(-1, "bm9uY2U=");
  assertEquals(b.seed, 0xFFFFFFFF);
});

// ---------------------------------------------------------------------------
// canonicalizeAction
// ---------------------------------------------------------------------------
Deno.test("canonicalizeAction produces deterministic string", () => {
  const a = { turn: 42, type: "rules.move", payload: { dx: 1, dy: 0 } };
  const s = canonicalizeAction(a);
  assertEquals(s, '42|rules.move|{"dx":1,"dy":0}');
});

Deno.test("canonicalizeAction with empty payload", () => {
  const a = { turn: 0, type: "rules.wait", payload: {} };
  assertEquals(canonicalizeAction(a), "0|rules.wait|{}");
});

// ---------------------------------------------------------------------------
// validateBundle
// ---------------------------------------------------------------------------
Deno.test("validateBundle accepts a valid bundle", () => {
  const b = createEmptyBundle(42, "bm9uY2U=");
  const result = validateBundle(b);
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test("validateBundle rejects null", () => {
  const result = validateBundle(null);
  assertEquals(result.valid, false);
  assert(result.errors.length > 0);
});

Deno.test("validateBundle rejects wrong version", () => {
  const b = createEmptyBundle(42, "bm9uY2U=");
  b.version = 99;
  const result = validateBundle(b);
  assertEquals(result.valid, false);
  assert(result.errors.some(e => e.includes("version")));
});

Deno.test("validateBundle rejects wrong engine", () => {
  const b = createEmptyBundle(42, "bm9uY2U=");
  b.engine = "other";
  const result = validateBundle(b);
  assertEquals(result.valid, false);
  assert(result.errors.some(e => e.includes("engine")));
});

Deno.test("validateBundle rejects bad seed", () => {
  const b = createEmptyBundle(42, "bm9uY2U=");
  b.seed = -5;
  const result = validateBundle(b);
  assertEquals(result.valid, false);
  assert(result.errors.some(e => e.includes("seed")));
});

Deno.test("validateBundle rejects empty nonce", () => {
  const b = createEmptyBundle(42, "bm9uY2U=");
  b.nonce = "";
  const result = validateBundle(b);
  assertEquals(result.valid, false);
  assert(result.errors.some(e => e.includes("nonce")));
});

Deno.test("validateBundle rejects bad action", () => {
  const b = createEmptyBundle(42, "bm9uY2U=");
  b.actions.push({ turn: "x", type: "", payload: null });
  const result = validateBundle(b);
  assertEquals(result.valid, false);
  assert(result.errors.length >= 3);
});

Deno.test("validateBundle rejects bad chainHash", () => {
  const b = createEmptyBundle(42, "bm9uY2U=");
  b.chainHash = "ZZZZ";
  const result = validateBundle(b);
  assertEquals(result.valid, false);
  assert(result.errors.some(e => e.includes("chainHash")));
});

Deno.test("validateBundle accepts valid chainHash", () => {
  const b = createEmptyBundle(42, "bm9uY2U=");
  b.chainHash = "a".repeat(64);
  const result = validateBundle(b);
  assertEquals(result.valid, true);
});

// ---------------------------------------------------------------------------
// serializeBundle / deserializeBundle round-trip
// ---------------------------------------------------------------------------
Deno.test("serializeBundle/deserializeBundle round-trip", () => {
  const b = createEmptyBundle(0xDEADBEEF, "dGVzdA==");
  b.actions.push({ turn: 1, type: "rules.move", payload: { dx: 0, dy: 1 } });
  b.score = 100;
  b.depth = 3;
  b.turns = 50;
  const json = serializeBundle(b);
  const restored = deserializeBundle(json);
  assertEquals(restored.seed, b.seed);
  assertEquals(restored.nonce, b.nonce);
  assertEquals(restored.actions.length, 1);
  assertEquals(restored.actions[0].type, "rules.move");
  assertEquals(restored.score, 100);
});

Deno.test("deserializeBundle throws on invalid JSON", () => {
  assertThrows(() => deserializeBundle("not json {{{"), SyntaxError);
});

Deno.test("deserializeBundle throws on invalid bundle", () => {
  assertThrows(() => deserializeBundle('{"version":99}'), Error, "Invalid proof bundle");
});
