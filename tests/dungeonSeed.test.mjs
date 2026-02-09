import { assert } from "jsr:@std/assert";
import { chunkSeed, floorSeed, edgeSeed } from '../src/rules/environment/dungeon/seed.js';

Deno.test("chunkSeed is deterministic", () => {
  const a = chunkSeed(42, 1, 0, 0);
  const b = chunkSeed(42, 1, 0, 0);
  assert(a === b, `same inputs produce same seed: ${a} vs ${b}`);
});

Deno.test("chunkSeed varies with coordinates", () => {
  const a = chunkSeed(42, 1, 0, 0);
  const b = chunkSeed(42, 1, 1, 0);
  const c = chunkSeed(42, 1, 0, 1);
  assert(a !== b, 'different chunkX produces different seed');
  assert(a !== c, 'different chunkY produces different seed');
  assert(b !== c, 'different coordinates produce different seeds');
});

Deno.test("chunkSeed varies with depth", () => {
  const a = chunkSeed(42, 1, 3, 5);
  const b = chunkSeed(42, 2, 3, 5);
  assert(a !== b, 'different depth produces different seed');
});

Deno.test("chunkSeed varies with worldSeed", () => {
  const a = chunkSeed(42, 1, 0, 0);
  const b = chunkSeed(99, 1, 0, 0);
  assert(a !== b, 'different worldSeed produces different seed');
});

Deno.test("chunkSeed returns unsigned 32-bit integer", () => {
  const s = chunkSeed(12345, 7, -3, 10);
  assert(Number.isInteger(s), 'seed is integer');
  assert(s >= 0, 'seed is non-negative');
  assert(s <= 0xFFFFFFFF, 'seed fits in 32 bits');
});

Deno.test("floorSeed is deterministic and varies with depth", () => {
  const a = floorSeed(42, 1);
  const b = floorSeed(42, 1);
  const c = floorSeed(42, 2);
  assert(a === b, 'deterministic');
  assert(a !== c, 'different depth different seed');
});

Deno.test("edgeSeed is symmetric (order-independent)", () => {
  const ab = edgeSeed(42, 1, 0, 0, 1, 0);
  const ba = edgeSeed(42, 1, 1, 0, 0, 0);
  assert(ab === ba, `edgeSeed(A,B) === edgeSeed(B,A): ${ab} vs ${ba}`);
});

Deno.test("edgeSeed varies between different edges", () => {
  const east = edgeSeed(42, 1, 0, 0, 1, 0);
  const south = edgeSeed(42, 1, 0, 0, 0, 1);
  assert(east !== south, 'different edges produce different seeds');
});

Deno.test("negative chunk coordinates produce valid seeds", () => {
  const s = chunkSeed(42, 1, -5, -10);
  assert(Number.isInteger(s) && s >= 0 && s <= 0xFFFFFFFF, 'valid 32-bit seed');
  const e = edgeSeed(42, 1, -1, 0, 0, 0);
  assert(Number.isInteger(e) && e >= 0 && e <= 0xFFFFFFFF, 'valid edge seed');
});
