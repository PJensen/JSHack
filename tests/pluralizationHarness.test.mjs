import { assertEquals } from "jsr:@std/assert";

Deno.test("test harness installs pluralization string extensions", () => {
  assertEquals("wolf".pluralize(2), "wolves");
  assertEquals("knives".singularize(), "knife");
});
