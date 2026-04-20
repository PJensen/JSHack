import { assertEquals, assertExists } from "jsr:@std/assert";
import { resolve } from "../src/display/audio/sounds.js";

Deno.test("sounds registry exposes thrown potion impact sound", () => {
  const sound = resolve("item:impact:potion");
  assertExists(sound);
  assertEquals(sound.file, "impact_potion.wav");
  assertEquals(sound.bus, "items");
});
