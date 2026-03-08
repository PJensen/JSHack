import { assert, assertEquals } from "jsr:@std/assert";
import { createFlyingFxController } from "../src/display/fx/flyingFxController.js";

function makeWorld() {
  const listeners = new Map();
  const alive = new Set();
  return {
    listeners,
    alive,
    on(event, handler) {
      const bucket = listeners.get(event) || [];
      bucket.push(handler);
      listeners.set(event, bucket);
    },
    emit(event, payload) {
      const bucket = listeners.get(event) || [];
      for (const handler of bucket) handler(payload);
    },
    isAlive(id) {
      return alive.has(id);
    },
  };
}

Deno.test("flyingFxController seeds already-visible flyers at full presentation", () => {
  const world = makeWorld();
  const flyingFx = createFlyingFxController({ world });

  flyingFx.syncWorldView({
    entities: [{ id: 12, tags: ["flying"] }],
  });

  const present = flyingFx.getPresentation({
    id: 12,
    pos: { x: 8, y: 6 },
    tags: ["flying"],
  }, 1.25, 28);

  assertEquals(present.progress, 1);
  assert(present.glyphY < 6, "flying glyph should render above its tile");
  assert(present.glyphScale > 1.08, "flying glyph should render larger than grounded");
  assert(present.shadowX < 8, "shadow should drift off-center");
  assert(present.shadowY < 6.24, "shadow should not stay locked to a snapped tile anchor");
});

Deno.test("flyingFxController eases takeoff and landing from proc events", () => {
  const world = makeWorld();
  world.alive.add(21);
  const flyingFx = createFlyingFxController({ world });
  flyingFx.installListeners();

  world.emit("proc:fly:takeoff", { id: 21 });
  let present = flyingFx.getPresentation({
    id: 21,
    pos: { x: 4, y: 9 },
    tags: ["flying"],
  }, 0, 28);
  assert(present.progress > 0, "takeoff should create an airborne transition immediately");
  assertEquals(present.wakeKind, "takeoff");

  flyingFx.tick(0.17);
  present = flyingFx.getPresentation({
    id: 21,
    pos: { x: 4, y: 9 },
    tags: ["flying"],
  }, 0.17, 28);
  assert(present.progress > 0.5 && present.progress < 0.7, "takeoff should ease through a mid-air transition");
  assert(present.glyphY < 8.8, "takeoff should lift the glyph noticeably");

  flyingFx.tick(0.4);
  present = flyingFx.getPresentation({
    id: 21,
    pos: { x: 4, y: 9 },
    tags: ["flying"],
  }, 0.6, 28);
  assertEquals(present.progress, 1);

  world.emit("proc:fly:land", { id: 21 });
  flyingFx.tick(0.12);
  present = flyingFx.getPresentation({
    id: 21,
    pos: { x: 4, y: 9 },
    tags: [],
  }, 0.72, 28);
  assert(present.progress > 0.45 && present.progress < 0.55, "landing should spend a short beat descending");
  assertEquals(present.wakeKind, "land");

  flyingFx.tick(0.3);
  present = flyingFx.getPresentation({
    id: 21,
    pos: { x: 4, y: 9 },
    tags: [],
  }, 1.02, 28);
  assertEquals(present.progress, 0);
  assertEquals(present.glyphY, 9);
  assertEquals(present.glyphScale, 1);
});
