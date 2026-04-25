import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { buildWorldView } from "../src/bridge/schema/worldView.js";
import { Position } from "../src/rules/components/Position.js";
import { AudioEmitter } from "../src/rules/components/AudioEmitter.js";

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
