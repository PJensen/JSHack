import { assert } from "jsr:@std/assert";

Deno.test("scheduler no longer registers legacy equipmentSystem", async () => {
  const path = new URL("../src/main/scheduler.js", import.meta.url);
  const text = await Deno.readTextFile(path);
  assert(
    !text.includes("registerSystem(equipmentSystem"),
    "configureWorld should not schedule legacy equipmentSystem anymore",
  );
  assert(
    !text.includes("installAffixTriggers("),
    "configureWorld should not install legacy affix trigger listeners anymore",
  );
});

Deno.test("scheduler wires shop ambient sound system into the rules loop", async () => {
  const path = new URL("../src/main/scheduler.js", import.meta.url);
  const text = await Deno.readTextFile(path);
  assert(
    text.includes("import { shopAmbientSoundSystem }"),
    "configureWorld should import shopAmbientSoundSystem",
  );
  assert(
    text.includes("registerSystem(shopAmbientSoundSystem, 'effects')"),
    "configureWorld should schedule shopAmbientSoundSystem in effects",
  );
});
