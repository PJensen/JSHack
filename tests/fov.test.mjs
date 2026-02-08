import { assert } from "jsr:@std/assert";
import { computeFOV, computeFOVKeys, computeFOVKeys32, packKey16, packKey32 } from '../src/shared/math/fov.js';

Deno.test("origin tile is always visible", () => {
  const vis = computeFOV(5, 5, 10, () => false);
  assert(vis.has('5,5'), 'origin always visible');
});

Deno.test("open room: all tiles within radius are visible", () => {
  const vis = computeFOV(0, 0, 3, () => false);
  assert(vis.has('0,0'), 'center visible');
  assert(vis.has('1,0'), 'east visible');
  assert(vis.has('0,1'), 'south visible');
  assert(vis.has('-1,0'), 'west visible');
  assert(vis.has('0,-1'), 'north visible');
  assert(vis.has('1,1'), 'diagonal visible');
  assert(vis.has('3,0'), 'distance 3 east visible');
  assert(vis.has('0,3'), 'distance 3 south visible');
});

Deno.test("wall blocks tiles behind it", () => {
  const wallAt2 = (x, y) => (x === 2 && y === 0);
  const vis = computeFOV(0, 0, 5, wallAt2);
  assert(vis.has('0,0'), 'origin visible with wall');
  assert(vis.has('1,0'), 'pre-wall visible');
  assert(vis.has('2,0'), 'wall tile itself visible');
  assert(!vis.has('5,0'), 'far behind wall not visible');
});

Deno.test("radius limits visibility", () => {
  const vis = computeFOV(0, 0, 2, () => false);
  assert(vis.has('2,0'), 'at radius limit');
  assert(!vis.has('3,0'), 'beyond radius not visible');
});

Deno.test("reuse output set", () => {
  const out = new Set();
  computeFOV(0, 0, 1, () => false, out);
  assert(out.has('0,0'), 'reused set has origin');
  assert(out.size > 0, 'reused set populated');
});

Deno.test("computeFOVKeys uses packed integer keys", () => {
  const vis = computeFOVKeys(0, 0, 2, () => false);
  assert(vis.has(packKey16(0, 0)), 'origin packed key visible');
  assert(vis.has(packKey16(2, 0)), 'edge packed key visible');
  assert(!vis.has(packKey16(3, 0)), 'beyond radius not visible');
});

Deno.test("computeFOVKeys32 uses packed BigInt keys", () => {
  const vis = computeFOVKeys32(0, 0, 2, () => false);
  assert(vis.has(packKey32(0, 0)), 'origin packed key visible');
  assert(vis.has(packKey32(2, 0)), 'edge packed key visible');
  assert(!vis.has(packKey32(3, 0)), 'beyond radius not visible');
});
