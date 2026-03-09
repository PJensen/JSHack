import { assertEquals, assert } from "jsr:@std/assert";
import { extractSurfaceRegions, traceSurfaceHullPath } from "../src/display/fx/surfaceAreaFx.js";

function makeWorldView(cells) {
  const byKey = new Map();
  for (let i = 0; i < cells.length; i++) {
    byKey.set(`${cells[i].x},${cells[i].y}`, cells[i].tile);
  }
  return {
    tileGrid: {
      forEachTileInRect(x0, y0, x1, y1, fn) {
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const tile = byKey.get(`${x},${y}`) ?? 0;
            fn(x, y, tile);
          }
        }
      },
    },
    isVisible(x, y) {
      return byKey.has(`${x},${y}`);
    },
  };
}

function makeTraceCtx() {
  return {
    moves: 0,
    quads: 0,
    closed: 0,
    beginPath() {},
    moveTo() { this.moves++; },
    quadraticCurveTo() { this.quads++; },
    closePath() { this.closed++; },
  };
}

Deno.test("surfaceAreaFx extracts one fixed water region for contiguous tiles", () => {
  const worldView = makeWorldView([
    { x: 10, y: 4, tile: 1 },
    { x: 11, y: 4, tile: 1 },
    { x: 10, y: 5, tile: 1 },
  ]);

  const regions = extractSurfaceRegions(
    worldView,
    { vx0: 8, vy0: 2, vx1: 13, vy1: 7 },
    (tile) => tile === 1 ? { family: "water", tone: "water" } : null,
  );

  assertEquals(regions.length, 1);
  assertEquals(regions[0].family, "water");
  assertEquals(regions[0].area, 3);
  assertEquals(regions[0].bounds, { minX: 9.5, minY: 3.5, maxX: 11.5, maxY: 5.5 });
  assert(regions[0].loops.length > 0, "region should include a hull loop");
});

Deno.test("surfaceAreaFx traces hulls with quadratic curves", () => {
  const worldView = makeWorldView([
    { x: 2, y: 2, tile: 1 },
    { x: 3, y: 2, tile: 1 },
    { x: 3, y: 3, tile: 1 },
  ]);

  const regions = extractSurfaceRegions(
    worldView,
    { vx0: 0, vy0: 0, vx1: 6, vy1: 6 },
    (tile) => tile === 1 ? { family: "water", tone: "water" } : null,
  );

  assertEquals(regions.length, 1);
  const ctx = makeTraceCtx();
  traceSurfaceHullPath(ctx, regions[0].loops);
  assert(ctx.moves > 0, "path should move to start of hull");
  assert(ctx.quads > 0, "path should use quadratic curves for the hull");
  assert(ctx.closed > 0, "path should close the hull loop");
});

Deno.test("surfaceAreaFx hull coordinates are centered on tile positions", () => {
  const worldView = makeWorldView([
    { x: 7, y: 8, tile: 1 },
  ]);

  const regions = extractSurfaceRegions(
    worldView,
    { vx0: 6, vy0: 7, vx1: 8, vy1: 9 },
    (tile) => tile === 1 ? { family: "water", tone: "water" } : null,
  );

  assertEquals(regions.length, 1);
  assertEquals(regions[0].loops.length, 1);
  assertEquals(regions[0].loops[0], [
    { x: 6.5, y: 7.5 },
    { x: 7.5, y: 7.5 },
    { x: 7.5, y: 8.5 },
    { x: 6.5, y: 8.5 },
    { x: 6.5, y: 7.5 },
  ]);
});
