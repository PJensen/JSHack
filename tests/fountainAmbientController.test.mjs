import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert";
import { createFountainAmbientController, computeFountainLoopVolume } from "../src/display/audio/fountainAmbientController.js";

Deno.test("computeFountainLoopVolume fades from the basin to silence", () => {
  assertAlmostEquals(computeFountainLoopVolume(0), 0.24, 1e-10);
  assertAlmostEquals(computeFountainLoopVolume(1), 0.24, 1e-10);
  assert(computeFountainLoopVolume(3) < computeFountainLoopVolume(2));
  assertEquals(computeFountainLoopVolume(7), 0);
  assertEquals(computeFountainLoopVolume(99), 0);
});

Deno.test("fountain ambient controller starts, updates, and stops the loop around active fountains", () => {
  const handlers = new Map();
  const calls = [];
  const controller = createFountainAmbientController({
    world: {
      on(event, cb) {
        handlers.set(event, cb);
      },
    },
    resolveFn(id) {
      assertEquals(id, "fountain");
      return { url: "./assets/audio/ambient_fountain.mp3", bus: "ambient" };
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

  controller.installListeners();

  controller.syncWorldView({
    player: { pos: { x: 10, y: 10 } },
    entities: [{ id: 7, kind: "fountain", pos: { x: 11, y: 10 } }],
  });
  assertEquals(calls[0]?.type, "start");
  assertEquals(calls[0]?.url, "./assets/audio/ambient_fountain.mp3");
  assertAlmostEquals(calls[0]?.opts?.volume, 0.24, 1e-10);

  controller.syncWorldView({
    player: { pos: { x: 10, y: 10 } },
    entities: [{ id: 7, kind: "fountain", pos: { x: 14, y: 10 } }],
  });
  assertEquals(calls[1]?.type, "set");
  assert(calls[1]?.volume < 0.72);

  handlers.get("fountain:dry")?.({ targetId: 7 });
  controller.syncWorldView({
    player: { pos: { x: 10, y: 10 } },
    entities: [{ id: 7, kind: "fountain", pos: { x: 11, y: 10 } }],
  });
  assertEquals(calls[2]?.type, "stop");

  handlers.get("fountain:refilled")?.({ targetId: 7 });
  controller.syncWorldView({
    player: { pos: { x: 10, y: 10 } },
    entities: [{ id: 7, kind: "fountain", pos: { x: 11, y: 10 } }],
  });
  assertEquals(calls[3]?.type, "start");
});

Deno.test("fountain ambient controller ignores inactive fountains from world view state", () => {
  const handlers = new Map();
  const calls = [];
  const controller = createFountainAmbientController({
    world: {
      on(event, cb) {
        handlers.set(event, cb);
      },
    },
    resolveFn() {
      return { url: "./assets/audio/ambient_fountain.mp3", bus: "ambient" };
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

  controller.installListeners();
  controller.syncWorldView({
    player: { pos: { x: 10, y: 10 } },
    entities: [{ id: 7, kind: "fountain", tags: ["inactive"], pos: { x: 11, y: 10 } }],
  });

  assertEquals(calls.length, 0, "inactive fountains should not start ambient audio");
});
