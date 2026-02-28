import { assert, assertEquals } from "jsr:@std/assert";
import { evaluateSound, maxAudibleDistanceTiles, thresholdForTier } from "../src/rules/utils/sound.js";

Deno.test("thresholdForTier returns representative hearing thresholds", () => {
  assertEquals(thresholdForTier("super"), 20);
  assertEquals(thresholdForTier("far"), 30);
  assertEquals(thresholdForTier("mid"), 50);
  assertEquals(thresholdForTier("near"), 70);
  assertEquals(thresholdForTier("deaf"), 95);
});

Deno.test("maxAudibleDistanceTiles matches expected rough ranges", () => {
  assertEquals(maxAudibleDistanceTiles(60, 30), 32); // conversation vs far-tier
  assertEquals(maxAudibleDistanceTiles(80, 50), 32); // shout vs mid-tier
  assertEquals(maxAudibleDistanceTiles(30, 50), 1);  // footsteps vs mid-tier
});

Deno.test("evaluateSound uses grid-distance attenuation and audibility margin", () => {
  const heard = evaluateSound({
    origin: { x: 0, y: 0 },
    source: { x: 4, y: 0 },
    sourceDbAt1Tile: 80,
    hearingThresholdDbHL: 50,
  });
  assertEquals(heard.distance, 4);
  assert(heard.audible, "shout should be audible at 4 tiles for mid threshold");
  assert(heard.marginDb > 0, "audible margin should be positive");

  const notHeard = evaluateSound({
    origin: { x: 0, y: 0 },
    source: { x: 32, y: 0 },
    sourceDbAt1Tile: 60,
    hearingThresholdDbHL: 50,
  });
  assertEquals(notHeard.distance, 32);
  assert(!notHeard.audible, "conversation should fade out at long range for mid threshold");
});

Deno.test("evaluateSound applies wall occlusion when tile callbacks are provided", () => {
  const walls = new Set(["1,0", "2,0"]);
  const getTile = (x, y) => (walls.has(`${x},${y}`) ? "#" : ".");
  const isWall = (tile) => tile === "#";

  const withWalls = evaluateSound({
    origin: { x: 0, y: 0 },
    source: { x: 3, y: 0 },
    sourceDbAt1Tile: 80,
    hearingThresholdDbHL: 50,
    wallDbPenalty: 10,
    getTile,
    isWall,
  });
  assertEquals(withWalls.occlusionDb, 20);

  const withoutWalls = evaluateSound({
    origin: { x: 0, y: 0 },
    source: { x: 3, y: 0 },
    sourceDbAt1Tile: 80,
    hearingThresholdDbHL: 50,
  });
  assert(withWalls.perceivedDb < withoutWalls.perceivedDb, "occlusion should reduce perceived dB");
});
