import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { PuffSpawned } from "../src/events/PuffSpawned.js";
import { createPuffFxExtension } from "../src/display/fx/puffFx.js";

Deno.test("puff fx emits for successful scroll transformations and explicit puffs", () => {
  const world = new World({ seed: 2 });
  const particles = [];
  const fx = { pool: { spawn: (particle) => particles.push(particle) } };
  world.install(createPuffFxExtension({ fx }));

  world.emit("polymorph:failed", { at: { x: 2, y: 3 }, reason: "resisted" });
  world.emit("polymorph:after", { at: { x: 2, y: 3 }, trigger: "touch", reason: "mimic_touch" });
  assertEquals(particles.length, 0);

  world.emit("polymorph:after", { at: { x: 2, y: 3 }, trigger: "scroll", reason: "scroll_polymorph" });
  assertEquals(particles.length, 16);
  world.emit(new PuffSpawned({ at: { x: 4, y: 5 }, source: "ratatoskr", kind: "smoke" }));
  assertEquals(particles.length, 32);
  for (const particle of particles) {
    if (particle.x < 1.89 || particle.x > 4.11) throw new Error(`particle x ${particle.x} is not centered on a puff tile`);
    if (particle.y < 2.91 || particle.y > 5.09) throw new Error(`particle y ${particle.y} is not centered on a puff tile`);
  }
});
