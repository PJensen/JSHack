import { assert } from "jsr:@std/assert";

Deno.test("scheduler no longer registers legacy equipmentSystem", async () => {
  const path = new URL("../src/main/scheduler.js", import.meta.url);
  const text = await Deno.readTextFile(path);
  assert(
    !text.includes("registerSystem(equipmentSystem"),
    "configureWorld should not schedule legacy equipmentSystem anymore",
  );
});
