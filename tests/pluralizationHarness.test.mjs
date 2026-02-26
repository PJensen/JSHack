import { assertEquals } from "jsr:@std/assert";
import "./00_testHarness.test.mjs";

Deno.test("test harness installs pluralization string extensions", () => {
  assertEquals("wolf".pluralize(2), "wolves");
  assertEquals("knives".singularize(), "knife");
});
