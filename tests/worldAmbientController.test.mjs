import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert";
import { createWorldAmbientController, computeChurchLoopVolume, computeSmithyLoopVolume, computeTavernLoopVolume, computeTownDayFactor, computeTownLoopVolume } from "../src/display/audio/worldAmbientController.js";

Deno.test("world ambient loop curves fall to silence at their edge", () => {
  assertAlmostEquals(computeTownLoopVolume(1), 0.16, 1e-10);
  assertAlmostEquals(computeTavernLoopVolume(1), 0.22, 1e-10);
  assertAlmostEquals(computeChurchLoopVolume(1), 0.14, 1e-10);
  assertAlmostEquals(computeSmithyLoopVolume(1), 0.17, 1e-10);
  assertEquals(computeTownLoopVolume(14), 0);
  assertEquals(computeTavernLoopVolume(10), 0);
  assertEquals(computeChurchLoopVolume(12), 0);
  assertEquals(computeSmithyLoopVolume(11), 0);
  assert(computeTownLoopVolume(4) < computeTownLoopVolume(2));
  assert(computeTavernLoopVolume(4) < computeTavernLoopVolume(2));
  assert(computeChurchLoopVolume(4) < computeChurchLoopVolume(2));
  assert(computeSmithyLoopVolume(4) < computeSmithyLoopVolume(2));
  assertEquals(computeTownDayFactor(0), 1);
  assertEquals(computeTownDayFactor(0.5), 0.5);
  assertEquals(computeTownDayFactor(1), 0);
});

Deno.test("world ambient controller prioritizes tavern over town bed", () => {
  const calls = [];
  const controller = createWorldAmbientController({
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
    isOverworld: true,
    player: { pos: { x: 10, y: 10 } },
    entities: [
      { kind: "townfolk_farmer", pos: { x: 11, y: 10 } },
      { kind: "tavern_sign", pos: { x: 18, y: 10 } },
    ],
  });
  assertEquals(calls[0]?.type, "start");
  assertEquals(calls[0]?.url, "./assets/audio/ambient:tavern.mp3");
  assertEquals(calls[0]?.opts?.bus, "ambient:loop");
  assertEquals(calls[1]?.type, "start");
  assertEquals(calls[1]?.url, "./assets/audio/ambient:town.mp3");
  assertEquals(calls[1]?.opts?.bus, "ambient:loop");
  assert(calls[1]?.opts?.volume < 0.34);

  controller.syncWorldView({
    isOverworld: true,
    player: { pos: { x: 10, y: 10 } },
    entities: [
      { kind: "townfolk_farmer", pos: { x: 11, y: 10 } },
      { kind: "tavern_sign", pos: { x: 11, y: 10 } },
    ],
  });
  assertEquals(calls[2]?.type, "set");
  assertEquals(calls[2]?.url, "./assets/audio/ambient:tavern.mp3");
  assertEquals(calls[3]?.type, "set");
  assertEquals(calls[3]?.url, "./assets/audio/ambient:town.mp3");
  assert(calls[2]?.volume > calls[0]?.opts?.volume);
  assert(calls[3]?.volume <= 0.16 * 0.28);

  controller.syncWorldView({
    isOverworld: false,
    player: { pos: { x: 10, y: 10 } },
    entities: [{ kind: "townfolk_farmer", pos: { x: 11, y: 10 } }],
  });
  assertEquals(calls[4]?.type, "stop");
  assertEquals(calls[5]?.type, "stop");
});

Deno.test("world ambient controller prefers explicit audio emitters over identity-derived town noise", () => {
  const calls = [];
  const controller = createWorldAmbientController({
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
    isOverworld: true,
    player: { pos: { x: 10, y: 10 } },
    audioEmitters: [],
    entities: [{ kind: "townfolk_farmer", pos: { x: 11, y: 10 } }],
  });
  assertEquals(calls.length, 0);

  controller.syncWorldView({
    isOverworld: true,
    player: { pos: { x: 10, y: 10 } },
    audioEmitters: [{ profile: "town", pos: { x: 11, y: 10 }, interior: false }],
    entities: [],
  });
  assertEquals(calls[0]?.type, "start");
  assertEquals(calls[0]?.url, "./assets/audio/ambient:town.mp3");
});

Deno.test("world ambient controller replaces town loop with owl ambience at night", () => {
  const calls = [];
  const controller = createWorldAmbientController({
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
    isOverworld: true,
    nightAlpha: 0,
    player: { pos: { x: 10, y: 10 } },
    audioEmitters: [{ profile: "town", pos: { x: 11, y: 10 }, interior: false }],
  });
  assertEquals(calls[0]?.type, "start");
  assertEquals(calls[0]?.url, "./assets/audio/ambient:town.mp3");

  controller.syncWorldView({
    isOverworld: true,
    nightAlpha: 1,
    player: { pos: { x: 10, y: 10 } },
    audioEmitters: [{ profile: "town", pos: { x: 11, y: 10 }, interior: false }],
  });
  assertEquals(calls[1]?.type, "stop");
  assertEquals(calls[1]?.url, "./assets/audio/ambient:town.mp3");
  assertEquals(calls[2]?.type, "start");
  assertEquals(calls[2]?.url, "./assets/audio/ambient:town:night.mp3");
});

Deno.test("world ambient controller silences outdoor town activity loops at night", () => {
  const calls = [];
  const controller = createWorldAmbientController({
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
    player: { pos: { x: 10, y: 10 } },
    audioEmitters: [
      { profile: "town", pos: { x: 11, y: 10 }, interior: false },
      { profile: "tavern", pos: { x: 11, y: 10 }, interior: false },
      { profile: "smithy", pos: { x: 11, y: 10 }, interior: false },
    ],
  };

  controller.syncWorldView(view);
  controller.syncWorldView({ ...view, nightAlpha: 1 });

  assert(calls.some((call) => call.type === "stop" && call.url === "./assets/audio/ambient:town.mp3"));
  assert(calls.some((call) => call.type === "stop" && call.url === "./assets/audio/ambient:tavern.mp3"));
  assert(calls.some((call) => call.type === "stop" && call.url === "./assets/audio/ambient:smithy.mp3"));
  assert(calls.some((call) => call.type === "start" && call.url === "./assets/audio/ambient:town:night.mp3"));
});

Deno.test("world ambient controller stops explicit town emitters at audible edge", () => {
  const calls = [];
  const controller = createWorldAmbientController({
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
    isOverworld: true,
    player: { pos: { x: 10, y: 10 } },
    audioEmitters: [{ profile: "town", pos: { x: 11, y: 10 }, interior: false }],
  });
  assertEquals(calls[0]?.type, "start");

  controller.syncWorldView({
    isOverworld: true,
    player: { pos: { x: 40, y: 10 } },
    audioEmitters: [{ profile: "town", pos: { x: 11, y: 10 }, interior: false }],
  });
  assertEquals(calls[1]?.type, "stop");
  assertEquals(calls[1]?.url, "./assets/audio/ambient:town.mp3");
});

Deno.test("world ambient controller uses tavern interior anchors and mutes town when sheltered", () => {
  const calls = [];
  const controller = createWorldAmbientController({
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
    isOverworld: true,
    playerSheltered: true,
    player: { pos: { x: 10, y: 10 } },
    isBlockedVision: () => false,
    entities: [
      { kind: "townfolk_farmer", pos: { x: 11, y: 10 } },
      { kind: "tavern_sign", pos: { x: 10, y: 8 } },
      { kind: "tavern_table", pos: { x: 12, y: 10 } },
    ],
  });
  assertEquals(calls[0]?.type, "start");
  assertEquals(calls[0]?.url, "./assets/audio/ambient:tavern.mp3");
  assertEquals(calls.length, 1);

  controller.syncWorldView({
    isOverworld: true,
    playerSheltered: true,
    player: { pos: { x: 10, y: 10 } },
    isBlockedVision: (x, y) => x === 11 && y === 10,
    entities: [
      { kind: "townfolk_farmer", pos: { x: 11, y: 10 } },
      { kind: "tavern_sign", pos: { x: 10, y: 8 } },
      { kind: "tavern_table", pos: { x: 12, y: 10 } },
    ],
  });
  assertEquals(calls[1]?.type, "stop");
  assertEquals(calls[1]?.url, "./assets/audio/ambient:tavern.mp3");
});

Deno.test("world ambient controller keeps church interior loop inside LOS and shelter", () => {
  const calls = [];
  const controller = createWorldAmbientController({
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
    isOverworld: true,
    playerSheltered: false,
    player: { pos: { x: 10, y: 10 } },
    isBlockedVision: () => false,
    entities: [{ kind: "church_altar", pos: { x: 12, y: 10 } }],
  });
  assertEquals(calls.length, 0);

  controller.syncWorldView({
    isOverworld: true,
    playerSheltered: true,
    player: { pos: { x: 10, y: 10 } },
    isBlockedVision: (x, y) => x === 11 && y === 10,
    entities: [{ kind: "church_altar", pos: { x: 12, y: 10 } }],
  });
  assertEquals(calls.length, 0);

  controller.syncWorldView({
    isOverworld: true,
    playerSheltered: true,
    player: { pos: { x: 10, y: 10 } },
    isBlockedVision: () => false,
    entities: [{ kind: "church_altar", pos: { x: 12, y: 10 } }],
  });
  assertEquals(calls[0]?.type, "start");
  assertEquals(calls[0]?.url, "./assets/audio/ambient:church.mp3");

  controller.syncWorldView({
    isOverworld: true,
    playerSheltered: false,
    player: { pos: { x: 10, y: 10 } },
    isBlockedVision: () => false,
    entities: [{ kind: "church_altar", pos: { x: 12, y: 10 } }],
  });
  assertEquals(calls[1]?.type, "stop");
  assertEquals(calls[1]?.url, "./assets/audio/ambient:church.mp3");
});

Deno.test("world ambient controller layers smithy ambience and contains it indoors", () => {
  const calls = [];
  const controller = createWorldAmbientController({
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
    isOverworld: true,
    player: { pos: { x: 10, y: 10 } },
    entities: [
      { kind: "townfolk_farmer", pos: { x: 11, y: 10 } },
      { kind: "smithy_sign", pos: { x: 12, y: 10 } },
    ],
  });
  assertEquals(calls[0]?.type, "start");
  assertEquals(calls[0]?.url, "./assets/audio/ambient:town.mp3");
  assertEquals(calls[1]?.type, "start");
  assertEquals(calls[1]?.url, "./assets/audio/ambient:smithy.mp3");

  controller.syncWorldView({
    isOverworld: true,
    playerSheltered: true,
    player: { pos: { x: 10, y: 10 } },
    isBlockedVision: () => false,
    entities: [
      { kind: "smithy_sign", pos: { x: 9, y: 10 } },
      { kind: "anvil", pos: { x: 12, y: 10 } },
    ],
  });
  assertEquals(calls[2]?.type, "stop");
  assertEquals(calls[2]?.url, "./assets/audio/ambient:town.mp3");
  assertEquals(calls[3]?.type, "set");
  assertEquals(calls[3]?.url, "./assets/audio/ambient:smithy.mp3");

  controller.syncWorldView({
    isOverworld: true,
    playerSheltered: true,
    player: { pos: { x: 10, y: 10 } },
    isBlockedVision: (x, y) => x === 11 && y === 10,
    entities: [
      { kind: "smithy_sign", pos: { x: 9, y: 10 } },
      { kind: "anvil", pos: { x: 12, y: 10 } },
    ],
  });
  assertEquals(calls[4]?.type, "stop");
  assertEquals(calls[4]?.url, "./assets/audio/ambient:smithy.mp3");
});
