import { assert } from "jsr:@std/assert";
import { updateFOV, isVisible, isExplored, clearExplored } from '../src/rules/environment/dungeon/exploredMap.js';

/** Never blocked — open field. */
const neverBlocked = (_x, _y) => false;

/** Blocked at (2,0) — wall right of origin. */
const wallAt2_0 = (x, y) => x === 2 && y === 0;

Deno.test("updateFOV populates visible set", () => {
  clearExplored();
  updateFOV(1, 0, 0, 5, neverBlocked);
  assert(isVisible(0, 0), 'origin is visible');
  assert(isVisible(1, 0), 'adjacent tile visible');
});

Deno.test("explored grows monotonically as player moves", () => {
  clearExplored();
  // Turn 1 at origin
  updateFOV(1, 0, 0, 3, neverBlocked);
  assert(isExplored(0, 0), 'explored non-empty after turn 1');
  assert(!isExplored(5, 0), 'far tile not explored yet');

  // Turn 2: player moves east
  updateFOV(2, 5, 0, 3, neverBlocked);

  // Old tiles still explored
  assert(isExplored(0, 0), 'origin still explored');
  // New tiles also explored
  assert(isExplored(5, 0), 'new position explored');
});

Deno.test("clearExplored resets both sets", () => {
  clearExplored();
  updateFOV(1, 0, 0, 5, neverBlocked);
  assert(isVisible(0, 0), 'visible before clear');
  assert(isExplored(0, 0), 'explored before clear');

  clearExplored();
  assert(!isVisible(0, 0), 'visible empty after clear');
  assert(!isExplored(0, 0), 'explored empty after clear');
});

Deno.test("updateFOV is idempotent within same step", () => {
  clearExplored();
  updateFOV(5, 0, 0, 3, neverBlocked);
  const wasVisible = isVisible(0, 0);

  // Call again with different position but same step — should not recompute
  updateFOV(5, 10, 10, 3, neverBlocked);
  assert(wasVisible, 'still centered on first call position');
  assert(!isVisible(10, 10), 'did not recompute to new position');
});

Deno.test("wall blocks vision behind it", () => {
  clearExplored();
  // Wall at (2,0), player at origin, radius 5
  updateFOV(1, 0, 0, 5, wallAt2_0);
  assert(isVisible(0, 0), 'origin visible');
  assert(isVisible(1, 0), 'tile before wall visible');
  // The wall tile itself is visible
  assert(isVisible(2, 0), 'wall tile visible');
  // Tile behind wall should be blocked along this axis
  assert(!isVisible(3, 0), 'tile behind wall not visible');
});

Deno.test("visible resets each turn, explored persists", () => {
  clearExplored();
  updateFOV(1, 0, 0, 3, neverBlocked);
  assert(isVisible(0, 0), 'origin visible turn 1');

  // Move far away on turn 2
  updateFOV(2, 50, 50, 3, neverBlocked);
  assert(!isVisible(0, 0), 'origin no longer in visible');
  assert(isExplored(0, 0), 'origin still explored');
  assert(isVisible(50, 50), 'new position is visible');
});
