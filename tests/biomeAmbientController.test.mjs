import { assert, assertEquals } from "jsr:@std/assert";
import {
  computeDayBiomeFactor,
  computeNightBiomeVolume,
  createBiomeAmbientController,
} from "../src/display/audio/biomeAmbientController.js";
import { TILE_PINE_FOREST } from "../src/shared/terrainTiles.js";

Deno.test("biome ambient crossfades daytime overworld beds into nighttime bed", () => {
  assertEquals(computeDayBiomeFactor(0), 1);
  assertEquals(computeDayBiomeFactor(1), 0);
  assert(computeNightBiomeVolume(0) === 0);
  assert(computeNightBiomeVolume(1) > 0);

  const calls = [];
  const controller = createBiomeAmbientController({
    resolveFn(id) {
      return { url: `./assets/audio/${id}.mp3`, bus: "ambient" };
    },
    startLoopFn(url, opts) {
      calls.push({ type: "start", url, opts });
    },
    stopLoopFn(url, opts) {
      calls.push({ type: "stop", url, opts });
    },
    setLoopVolumeFn(url, volume, opts) {
      calls.push({ type: "set", url, volume, opts });
    },
  });

  const view = {
    isOverworld: true,
    nightAlpha: 0,
    player: { pos: { x: 0, y: 0 } },
    tileGrid: { getTile: () => TILE_PINE_FOREST },
  };

  controller.syncWorldView(view);
  assertEquals(calls[0]?.type, "start");
  assertEquals(calls[0]?.url, "./assets/audio/ambient:forest.mp3");
  assert(calls[0]?.opts?.volume > 0);

  controller.syncWorldView({ ...view, nightAlpha: 1 });
  assertEquals(calls[1]?.type, "stop");
  assertEquals(calls[1]?.url, "./assets/audio/ambient:forest.mp3");
  assertEquals(calls[2]?.type, "start");
  assertEquals(calls[2]?.url, "./assets/audio/ambient:nighttime.mp3");
  assert(calls[2]?.opts?.volume > 0);
});
