import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createPolymorphSmokeExtension } from "../src/display/fx/polymorphSmokeFx.js";

Deno.test("polymorph smoke emits only for successful scroll transformations", () => {
  const world = new World({ seed: 2 });
  const particles = [];
  const fx = { pool: { spawn: (particle) => particles.push(particle) } };
  world.install(createPolymorphSmokeExtension({ fx }));

  world.emit("polymorph:failed", { at: { x: 2, y: 3 }, reason: "resisted" });
  world.emit("polymorph:after", { at: { x: 2, y: 3 }, trigger: "touch", reason: "mimic_touch" });
  assertEquals(particles.length, 0);

  world.emit("polymorph:after", { at: { x: 2, y: 3 }, trigger: "scroll", reason: "scroll_polymorph" });
  assertEquals(particles.length, 16);
  for (const particle of particles) {
    if (particle.x < 1.89 || particle.x > 2.11) throw new Error(`particle x ${particle.x} is not centered on tile 2`);
    if (particle.y < 2.91 || particle.y > 3.09) throw new Error(`particle y ${particle.y} is not centered on tile 3`);
  }
});
