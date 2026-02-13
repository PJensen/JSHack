import { assert, assertEquals } from "jsr:@std/assert";
import {
  mulberry32, createRng, seedFromString,
  rngFloat, rngInt, rngChoice, rngShuffle, rngShuffleInPlace,
  rngSelfTest,
} from '../src/lib/ecs-js/rng.js';
import {
  combatSeed,
  rn2, rnd, d, rollDice,
  oneIn, pct, rnl, rne,
} from '../src/rules/utils/rng.js';

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

Deno.test("mulberry32 is deterministic for the same seed", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 100; i++) {
    assertEquals(a(), b(), `mismatch at call ${i}`);
  }
});

Deno.test("different seeds produce different sequences", () => {
  const a = mulberry32(1);
  const b = mulberry32(2);
  let same = 0;
  for (let i = 0; i < 50; i++) if (a() === b()) same++;
  assert(same < 5, 'different seeds should diverge');
});

Deno.test("rngSelfTest passes", () => {
  assert(rngSelfTest());
});

// ---------------------------------------------------------------------------
// rn2  —  [0, n)
// ---------------------------------------------------------------------------

Deno.test("rn2 returns values in [0, n)", () => {
  const r = mulberry32(99);
  for (let i = 0; i < 1000; i++) {
    const v = rn2(r, 6);
    assert(v >= 0 && v < 6, `out of range: ${v}`);
  }
});

Deno.test("rn2(rng, 0) returns 0", () => {
  assertEquals(rn2(mulberry32(1), 0), 0);
});

Deno.test("rn2(rng, 1) always returns 0", () => {
  const r = mulberry32(77);
  for (let i = 0; i < 100; i++) assertEquals(rn2(r, 1), 0);
});

// ---------------------------------------------------------------------------
// rnd  —  [1, n]
// ---------------------------------------------------------------------------

Deno.test("rnd returns values in [1, n]", () => {
  const r = mulberry32(55);
  for (let i = 0; i < 1000; i++) {
    const v = rnd(r, 20);
    assert(v >= 1 && v <= 20, `out of range: ${v}`);
  }
});

Deno.test("rnd(rng, 1) always returns 1", () => {
  const r = mulberry32(88);
  for (let i = 0; i < 100; i++) assertEquals(rnd(r, 1), 1);
});

// ---------------------------------------------------------------------------
// d  —  dice rolling
// ---------------------------------------------------------------------------

Deno.test("d(rng, 1, 6) returns [1,6]", () => {
  const r = mulberry32(10);
  for (let i = 0; i < 1000; i++) {
    const v = d(r, 1, 6);
    assert(v >= 1 && v <= 6, `out of range: ${v}`);
  }
});

Deno.test("d(rng, 2, 6) returns [2,12]", () => {
  const r = mulberry32(11);
  for (let i = 0; i < 1000; i++) {
    const v = d(r, 2, 6);
    assert(v >= 2 && v <= 12, `out of range: ${v}`);
  }
});

Deno.test("d(rng, '2d6') string parsing works", () => {
  const r1 = mulberry32(42);
  const r2 = mulberry32(42);
  for (let i = 0; i < 50; i++) {
    assertEquals(d(r1, '2d6'), d(r2, 2, 6));
  }
});

Deno.test("d returns 1 for malformed spec", () => {
  assertEquals(d(mulberry32(1), 'garbage'), 1);
});

// ---------------------------------------------------------------------------
// rollDice  —  (spec, rng) arg order
// ---------------------------------------------------------------------------

Deno.test("rollDice('3d8') returns [3,24]", () => {
  const r = mulberry32(22);
  for (let i = 0; i < 1000; i++) {
    const v = rollDice('3d8', r);
    assert(v >= 3 && v <= 24, `out of range: ${v}`);
  }
});

Deno.test("rollDice matches d for same seed", () => {
  const r1 = mulberry32(7);
  const r2 = mulberry32(7);
  for (let i = 0; i < 50; i++) {
    assertEquals(rollDice('1d20', r1), d(r2, '1d20'));
  }
});

// ---------------------------------------------------------------------------
// oneIn
// ---------------------------------------------------------------------------

Deno.test("oneIn(rng, 1) always returns true", () => {
  const r = mulberry32(5);
  for (let i = 0; i < 100; i++) assert(oneIn(r, 1));
});

Deno.test("oneIn returns boolean", () => {
  const r = mulberry32(6);
  assertEquals(typeof oneIn(r, 4), 'boolean');
});

Deno.test("oneIn(rng, 1000000) is rare", () => {
  const r = mulberry32(13);
  let hits = 0;
  for (let i = 0; i < 100000; i++) if (oneIn(r, 1000000)) hits++;
  assert(hits < 5, `expected ~0 hits, got ${hits}`);
});

// ---------------------------------------------------------------------------
// pct
// ---------------------------------------------------------------------------

Deno.test("pct(rng, 100) always returns true", () => {
  const r = mulberry32(1);
  for (let i = 0; i < 100; i++) assert(pct(r, 100));
});

Deno.test("pct(rng, 0) always returns false", () => {
  const r = mulberry32(1);
  for (let i = 0; i < 100; i++) assert(!pct(r, 0));
});

Deno.test("pct(rng, 50) hits roughly half the time", () => {
  const r = mulberry32(9);
  let hits = 0;
  for (let i = 0; i < 10000; i++) if (pct(r, 50)) hits++;
  assert(hits > 4500 && hits < 5500, `expected ~5000, got ${hits}`);
});

// ---------------------------------------------------------------------------
// rnl  —  luck-adjusted
// ---------------------------------------------------------------------------

Deno.test("rnl(rng, 1, 0) always returns true", () => {
  const r = mulberry32(3);
  for (let i = 0; i < 100; i++) assert(rnl(r, 1, 0));
});

Deno.test("positive luck decreases trigger rate", () => {
  const N = 10000;
  const r1 = mulberry32(50);
  let hitsNoLuck = 0;
  for (let i = 0; i < N; i++) if (rnl(r1, 5, 0)) hitsNoLuck++;

  const r2 = mulberry32(50);
  let hitsLucky = 0;
  for (let i = 0; i < N; i++) if (rnl(r2, 5, 10)) hitsLucky++;

  assert(hitsLucky < hitsNoLuck, `luck should reduce hits: ${hitsLucky} vs ${hitsNoLuck}`);
});

// ---------------------------------------------------------------------------
// rne  —  exponential
// ---------------------------------------------------------------------------

Deno.test("rne always returns >= 1", () => {
  const r = mulberry32(77);
  for (let i = 0; i < 1000; i++) {
    assert(rne(r, 3) >= 1);
  }
});

Deno.test("rne(rng, 100) almost always returns 1", () => {
  const r = mulberry32(44);
  let ones = 0;
  for (let i = 0; i < 1000; i++) if (rne(r, 100) === 1) ones++;
  assert(ones > 980, `expected nearly all 1s, got ${ones}/1000`);
});

Deno.test("rne(rng, 2) has geometric distribution (mean near 2)", () => {
  const r = mulberry32(33);
  let sum = 0;
  const N = 10000;
  for (let i = 0; i < N; i++) sum += rne(r, 2);
  const mean = sum / N;
  assert(mean > 1.7 && mean < 2.3, `expected mean ~2, got ${mean}`);
});

// ---------------------------------------------------------------------------
// combatSeed
// ---------------------------------------------------------------------------

Deno.test("combatSeed is deterministic", () => {
  const a = combatSeed(42, 7, 3, 5);
  const b = combatSeed(42, 7, 3, 5);
  assertEquals(a, b);
});

Deno.test("combatSeed varies with step", () => {
  assert(combatSeed(42, 1, 3, 5) !== combatSeed(42, 2, 3, 5));
});

Deno.test("combatSeed varies with entities", () => {
  assert(combatSeed(42, 1, 3, 5) !== combatSeed(42, 1, 4, 5));
  assert(combatSeed(42, 1, 3, 5) !== combatSeed(42, 1, 3, 6));
});

Deno.test("combatSeed salt changes result", () => {
  assert(combatSeed(42, 1, 3, 5, 0) !== combatSeed(42, 1, 3, 5, 0xdead0001));
});

Deno.test("combatSeed returns unsigned 32-bit", () => {
  const s = combatSeed(0xFFFFFFFF, 999, 50, 100, 0xc0ffee01);
  assert(Number.isInteger(s) && s >= 0 && s <= 0xFFFFFFFF);
});

Deno.test("combatSeed matches legacy inline pattern", () => {
  // Verify exact equivalence with the hand-rolled XOR from combatSystem.js
  const worldSeed = 0xa77a77;
  const step = 12;
  const attacker = 3;
  const defender = 5;
  const legacy = ((worldSeed >>> 0) ^ ((step * 0x9e3779b9) >>> 0) ^ (attacker >>> 0) ^ ((defender << 16) >>> 0)) >>> 0;
  assertEquals(combatSeed(worldSeed, step, attacker, defender), legacy);
});

Deno.test("combatSeed with salt matches legacy affix pattern", () => {
  const worldSeed = 0xa77a77;
  const step = 5;
  const attacker = 2;
  const defender = 8;
  const salt = 0xc0ffee01;
  const legacy = ((worldSeed >>> 0) ^ ((step * 0x9e3779b9) >>> 0) ^ (attacker >>> 0) ^ ((defender << 16) >>> 0) ^ salt) >>> 0;
  assertEquals(combatSeed(worldSeed, step, attacker, defender, salt), legacy);
});

// ---------------------------------------------------------------------------
// Distribution sanity
// ---------------------------------------------------------------------------

Deno.test("rn2(rng, 6) is roughly uniform", () => {
  const r = mulberry32(123);
  const buckets = [0, 0, 0, 0, 0, 0];
  const N = 12000;
  for (let i = 0; i < N; i++) buckets[rn2(r, 6)]++;
  const expected = N / 6;
  for (let b = 0; b < 6; b++) {
    assert(
      Math.abs(buckets[b] - expected) < expected * 0.15,
      `bucket ${b}: ${buckets[b]} (expected ~${expected})`
    );
  }
});

// ---------------------------------------------------------------------------
// seedFromString
// ---------------------------------------------------------------------------

Deno.test("seedFromString is deterministic", () => {
  assertEquals(seedFromString("hello"), seedFromString("hello"));
});

Deno.test("seedFromString varies for different strings", () => {
  assert(seedFromString("a") !== seedFromString("b"));
});

Deno.test("seedFromString returns unsigned 32-bit", () => {
  const s = seedFromString("test string 123");
  assert(Number.isInteger(s) && s >= 0 && s <= 0xFFFFFFFF);
});

// ---------------------------------------------------------------------------
// createRng extended object (re-exported from ecs-js)
// ---------------------------------------------------------------------------

Deno.test("createRng basic helpers work", () => {
  const rng = createRng(42);
  const f = rng.float(1, 10);
  assert(f >= 1 && f <= 10);
  const i = rng.int(1, 6);
  assert(i >= 1 && i <= 6);
  const c = rng.choice(['a', 'b', 'c']);
  assert(['a', 'b', 'c'].includes(c));
});
