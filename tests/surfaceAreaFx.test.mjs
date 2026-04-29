import { assertEquals, assert } from "jsr:@std/assert";
import { createSurfaceAreaFxController, extractSurfaceRegions, traceSurfaceHullPath } from "../src/display/fx/surfaceAreaFx.js";

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

function makeDrawCtx() {
  const ctx = {
    radii: [],
    arcs: [],
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    quadraticCurveTo() {},
    closePath() {},
    clip() {},
    stroke() {},
    fill() {},
    fillRect() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
    arc(x, y, radius) {
      this.arcs.push({ x, y, radius });
      this.radii.push(radius);
      if (radius < 0) throw new Error(`negative arc radius: ${radius}`);
    },
    ellipse(_x, _y, rx, ry) {
      this.radii.push(rx, ry);
      if (rx < 0 || ry < 0) throw new Error(`negative ellipse radius: ${rx}, ${ry}`);
    },
  };
  return ctx;
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

Deno.test("surfaceAreaFx reuses regions while turn and tile viewport are unchanged", () => {
  let scans = 0;
  const worldView = {
    turn: 10,
    currentDepth: 0,
    tileGrid: {
      forEachTileInRect(x0, y0, x1, y1, fn) {
        scans++;
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            fn(x, y, x === 1 && y === 1 ? 1 : 0);
          }
        }
      },
    },
    isVisible() {
      return true;
    },
  };
  const fx = createSurfaceAreaFxController({
    getFxTime: () => 0,
    classifySurfaceTile: (tile) => tile === 1 ? { family: "water", tone: "water" } : null,
    fx: null,
    PERF: { quality: "high" },
  });

  fx.tick(1 / 60, worldView, { vx0: 0.2, vy0: 0.2, vx1: 3.2, vy1: 3.2 }, "clear");
  fx.tick(1 / 60, worldView, { vx0: 0.3, vy0: 0.3, vx1: 3.1, vy1: 3.1 }, "clear");
  assertEquals(scans, 1);

  worldView.turn++;
  fx.tick(1 / 60, worldView, { vx0: 0.3, vy0: 0.3, vx1: 3.1, vy1: 3.1 }, "clear");
  assertEquals(scans, 2);
});

Deno.test("surfaceAreaFx rain ripples never draw negative arc radii", () => {
  const originalRandom = Math.random;
  const sequence = [
    0, // pick the only water cell
    0, // x jitter
    0, // y jitter
    1, // old code: ttl high
    0, // old code: max low, making progress negative
    0, // radius0 low
    0, // radius1 low
  ];
  let idx = 0;
  Math.random = () => sequence[idx++] ?? 0;
  try {
    const worldView = {
      turn: 1,
      currentDepth: 0,
      tileGrid: {
        forEachTileInRect(x0, y0, x1, y1, fn) {
          for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
              fn(x, y, x === 1 && y === 1 ? 1 : 0);
            }
          }
        },
      },
      isVisible() {
        return true;
      },
    };
    const fx = createSurfaceAreaFxController({
      getFxTime: () => 0,
      classifySurfaceTile: (tile) => tile === 1 ? { family: "water", tone: "water" } : null,
      fx: null,
      PERF: { quality: "high" },
    });
    fx.tick(10, worldView, { vx0: 0, vy0: 0, vx1: 2, vy1: 2 }, "heavy_rain");
    const ctx = makeDrawCtx();
    fx.draw(ctx);
    assert(ctx.radii.every((r) => r >= 0), "all canvas arc radii should be non-negative");
  } finally {
    Math.random = originalRandom;
  }
});

Deno.test("surfaceAreaFx suppresses fishery ripples from clipped viewport edge cells", () => {
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const worldView = {
      turn: 1,
      currentDepth: 0,
      fisheries: [
        { id: 10, x: 3, y: 3, ready: true, overfished: false, pressure: 0 },
      ],
      tileGrid: {
        forEachTileInRect(x0, y0, x1, y1, fn) {
          for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
              fn(x, y, x === 3 && y === 3 ? 1 : 0);
            }
          }
        },
      },
      isVisible() {
        return true;
      },
    };
    const fx = createSurfaceAreaFxController({
      getFxTime: () => 0,
      classifySurfaceTile: (tile) => tile === 1 ? { family: "water", tone: "water" } : null,
      fx: null,
      PERF: { quality: "high" },
    });
    fx.tick(1 / 60, worldView, { vx0: 0, vy0: 0, vx1: 3.2, vy1: 3.2 }, "clear");
    const ctx = makeDrawCtx();
    fx.draw(ctx);
    assertEquals(ctx.radii.length, 0, "fishery ripples should not bleed in from a clipped bottom-right cell");
  } finally {
    Math.random = originalRandom;
  }
});

Deno.test("surfaceAreaFx fishery ripples are centered within their water tile", () => {
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const worldView = {
      turn: 1,
      currentDepth: 0,
      fisheries: [
        { id: 10, x: 3, y: 3, ready: true, overfished: false, pressure: 0 },
      ],
      tileGrid: {
        forEachTileInRect(x0, y0, x1, y1, fn) {
          for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
              fn(x, y, x === 3 && y === 3 ? 1 : 0);
            }
          }
        },
      },
      isVisible() {
        return true;
      },
    };
    const fx = createSurfaceAreaFxController({
      getFxTime: () => 0,
      classifySurfaceTile: (tile) => tile === 1 ? { family: "water", tone: "water" } : null,
      fx: null,
      PERF: { quality: "high" },
    });
    fx.tick(1 / 60, worldView, { vx0: 0, vy0: 0, vx1: 4, vy1: 4 }, "clear");
    const ctx = makeDrawCtx();
    fx.draw(ctx);
    assert(ctx.arcs.length > 0, "fishery should draw ripple rings");
    assertEquals(ctx.arcs[0].x, 2.7);
    assertEquals(ctx.arcs[0].y, 2.7);
  } finally {
    Math.random = originalRandom;
  }
});
