import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert";
import { createLocalEmitterAmbientController, computeCookingFireLoopVolume, computeHolySiteLoopVolume, computeTorchLoopVolume } from "../src/display/audio/localEmitterAmbientController.js";

Deno.test("local emitter loop curves fall off by radius", () => {
  assertAlmostEquals(computeCookingFireLoopVolume(1), 0.14, 1e-10);
  assertAlmostEquals(computeHolySiteLoopVolume(1), 0.1, 1e-10);
  assertAlmostEquals(computeTorchLoopVolume(1), 0.12, 1e-10);
  assertEquals(computeCookingFireLoopVolume(8), 0);
  assertEquals(computeHolySiteLoopVolume(7), 0);
  assertEquals(computeTorchLoopVolume(6), 0);
  assert(computeCookingFireLoopVolume(3) < computeCookingFireLoopVolume(2));
  assert(computeHolySiteLoopVolume(3) < computeHolySiteLoopVolume(2));
  assert(computeTorchLoopVolume(3) < computeTorchLoopVolume(2));
});

Deno.test("local emitter controller follows nearest cooking fire and torch sources", () => {
  const calls = [];
  const controller = createLocalEmitterAmbientController({
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

  controller.syncWorldView({
    player: { pos: { x: 10, y: 10 } },
    entities: [
      { kind: "cooking_fire", pos: { x: 11, y: 10 } },
      { kind: "shrine", pos: { x: 11, y: 11 } },
      { kind: "torch", pos: { x: 12, y: 10 } },
    ],
  });
  assertEquals(calls[0]?.type, "start");
  assertEquals(calls[0]?.url, "./assets/audio/ambient:cooking_fire.mp3");
  assertEquals(calls[0]?.opts?.bus, "ambient:loop");
  assertEquals(calls[1]?.type, "start");
  assertEquals(calls[1]?.url, "./assets/audio/ambient:holy_site.mp3");
  assertEquals(calls[1]?.opts?.bus, "ambient:loop");
  assertEquals(calls[2]?.type, "start");
  assertEquals(calls[2]?.url, "./assets/audio/ambient:torch_flames.mp3");
  assertEquals(calls[2]?.opts?.bus, "ambient:loop");

  controller.syncWorldView({
    player: { pos: { x: 10, y: 10 } },
    entities: [
      { kind: "furnace", pos: { x: 13, y: 10 } },
      { kind: "altar", pos: { x: 10, y: 12 } },
    ],
  });
  assertEquals(calls[3]?.type, "set");
  assertEquals(calls[3]?.url, "./assets/audio/ambient:cooking_fire.mp3");
  assertEquals(calls[4]?.type, "set");
  assertEquals(calls[4]?.url, "./assets/audio/ambient:holy_site.mp3");
  assertEquals(calls[5]?.type, "stop");
  assertEquals(calls[5]?.url, "./assets/audio/ambient:torch_flames.mp3");
  assert(calls[3]?.volume < calls[0]?.opts?.volume);
  assert(calls[4]?.volume < calls[1]?.opts?.volume);

  controller.syncWorldView({
    player: { pos: { x: 10, y: 10 } },
    entities: [],
  });
  assertEquals(calls[6]?.type, "stop");
  assertEquals(calls[7]?.type, "stop");
});

Deno.test("local emitter controller prefers explicit audio emitters over identities", () => {
  const calls = [];
  const controller = createLocalEmitterAmbientController({
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

  controller.syncWorldView({
    player: { pos: { x: 10, y: 10 } },
    audioEmitters: [],
    entities: [{ kind: "torch", pos: { x: 11, y: 10 } }],
  });
  assertEquals(calls.length, 0);

  controller.syncWorldView({
    player: { pos: { x: 10, y: 10 } },
    audioEmitters: [{ profile: "torch", pos: { x: 11, y: 10 }, interior: false }],
    entities: [],
  });
  assertEquals(calls[0]?.type, "start");
  assertEquals(calls[0]?.url, "./assets/audio/ambient:torch_flames.mp3");
});

Deno.test("local emitter controller keeps church holy-site loop inside shelter and LOS", () => {
  const calls = [];
  const controller = createLocalEmitterAmbientController({
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

  controller.syncWorldView({
    player: { pos: { x: 10, y: 10 } },
    playerSheltered: false,
    isBlockedVision: () => false,
    entities: [{ kind: "church_altar", pos: { x: 12, y: 10 } }],
  });
  assertEquals(calls.length, 0);

  controller.syncWorldView({
    player: { pos: { x: 10, y: 10 } },
    playerSheltered: true,
    isBlockedVision: (x, y) => x === 11 && y === 10,
    entities: [{ kind: "church_altar", pos: { x: 12, y: 10 } }],
  });
  assertEquals(calls.length, 0);

  controller.syncWorldView({
    player: { pos: { x: 10, y: 10 } },
    playerSheltered: true,
    isBlockedVision: () => false,
    entities: [{ kind: "church_altar", pos: { x: 12, y: 10 } }],
  });
  assertEquals(calls[0]?.type, "start");
  assertEquals(calls[0]?.url, "./assets/audio/ambient:holy_site.mp3");

  controller.syncWorldView({
    player: { pos: { x: 10, y: 10 } },
    playerSheltered: false,
    isBlockedVision: () => false,
    entities: [{ kind: "church_altar", pos: { x: 12, y: 10 } }],
  });
  assertEquals(calls[1]?.type, "stop");
  assertEquals(calls[1]?.url, "./assets/audio/ambient:holy_site.mp3");
});
