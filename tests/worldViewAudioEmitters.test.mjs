import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { buildWorldView } from "../src/bridge/schema/worldView.js";
import { Position } from "../src/rules/components/Position.js";
import { AudioEmitter } from "../src/rules/components/AudioEmitter.js";
import { TownfolkJob, TOWNFOLK_ROLES, TOWNFOLK_STATES } from "../src/rules/components/TownfolkJob.js";

Deno.test("WorldView projects explicit audio emitters", () => {
  const world = new World({ seed: 0xa11d10 });
  const id = world.create();
  world.add(id, Position, { x: 7, y: 9 });
  world.add(id, AudioEmitter, {
    emitters: [
      { profile: "town", interior: false },
      { profile: "tavern", interior: true },
    ],
  });

  const view = buildWorldView(world);
  assertEquals(view.audioEmitters, [
    { id, profile: "town", pos: { x: 7, y: 9 }, interior: false },
    { id, profile: "tavern", pos: { x: 7, y: 9 }, interior: true },
  ]);
});

Deno.test("WorldView projects active woodcutter work as an audio emitter", () => {
  const world = new World({ seed: 0xa11d10 });
  const id = world.create();
  world.add(id, Position, { x: 4, y: 6 });
  world.add(id, TownfolkJob, {
    role: TOWNFOLK_ROLES.woodcutter,
    state: TOWNFOLK_STATES.working,
    workSiteKind: "chop",
  });

  const view = buildWorldView(world);
  assertEquals(view.audioEmitters, [
    { id, profile: "woodcutter", pos: { x: 4, y: 6 }, interior: false },
  ]);
});

Deno.test("WorldView does not project idle woodcutters as audio emitters", () => {
  const world = new World({ seed: 0xa11d10 });
  const id = world.create();
  world.add(id, Position, { x: 4, y: 6 });
  world.add(id, TownfolkJob, {
    role: TOWNFOLK_ROLES.woodcutter,
    state: TOWNFOLK_STATES.idle,
    workSiteKind: "chop",
  });

  const view = buildWorldView(world);
  assertEquals(view.audioEmitters, []);
});
