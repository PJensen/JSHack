import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert";

import {
  createLockPickingResult,
  LockPickingMiniGame,
  normalizeLockDifficulty,
  notifyLockPickingResult,
  resolvePolarLockInput,
} from "../src/display/ui/lockPickingOverlay.js";

Deno.test("lock picking constructor injects pin count and named difficulty", () => {
  const game = new LockPickingMiniGame(7, "hard");

  assertEquals(game.pinCount, 7);
  assertEquals(game.difficulty.id, "hard");
  assertEquals(game.state.pins.length, 7);
  assert(game.difficulty.angleTolerance < normalizeLockDifficulty("normal").angleTolerance);
});

Deno.test("lock picking constructor clamps pins and accepts numeric difficulty ratings", () => {
  const game = new LockPickingMiniGame(20, "9");

  assertEquals(game.pinCount, 9);
  assertEquals(game.difficulty.id, "rating:9");
  assertEquals(game.state.pins.length, 9);
  assert(game.difficulty.setHoldMs > normalizeLockDifficulty("easy").setHoldMs);
});

Deno.test("lock picking polar drag maps direction to angle and radius to force", () => {
  const center = resolvePolarLockInput(0, 0, 100);
  assertEquals(center.active, false);
  assertEquals(center.force, 0);

  const right = resolvePolarLockInput(96, 0, 100);
  assertEquals(right.active, true);
  assertAlmostEquals(right.angle, 0);
  assertEquals(right.force, 1);

  const down = resolvePolarLockInput(0, 57, 100);
  assertEquals(down.active, true);
  assertAlmostEquals(down.angle, Math.PI / 2);
  assertAlmostEquals(down.force, 0.5);
});

Deno.test("lock picking result notifies finished and success listeners", () => {
  const game = new LockPickingMiniGame(4, "easy");
  const calls = [];
  const result = createLockPickingResult(game, true, "unlocked");

  notifyLockPickingResult({
    finishedPickedListener(detail) {
      calls.push(["finished", detail]);
    },
    successPickedListener(detail) {
      calls.push(["success", detail]);
    },
    failedPickedListener(detail) {
      calls.push(["failed", detail]);
    },
  }, result);

  assertEquals(calls, [
    ["finished", result],
    ["success", result],
  ]);
  assertEquals(result, {
    success: true,
    reason: "unlocked",
    pins: 4,
    difficulty: "easy",
  });
});

Deno.test("lock picking result notifies finished and failure listeners", () => {
  const game = new LockPickingMiniGame(5, "hard");
  const calls = [];
  const result = createLockPickingResult(game, false, "cancelled");

  notifyLockPickingResult({
    finishedPickedListener(detail) {
      calls.push(["finished", detail]);
    },
    successPickedListener(detail) {
      calls.push(["success", detail]);
    },
    failedPickedListener(detail) {
      calls.push(["failed", detail]);
    },
  }, result);

  assertEquals(calls, [
    ["finished", result],
    ["failed", result],
  ]);
  assertEquals(result, {
    success: false,
    reason: "cancelled",
    pins: 5,
    difficulty: "hard",
  });
});
