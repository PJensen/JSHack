import { assert, assertEquals } from "jsr:@std/assert";

import {
  LockPickingMiniGame,
  normalizeLockDifficulty,
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
