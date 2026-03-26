import { assertEquals } from "jsr:@std/assert";

Deno.test("ui:itemUsed is dispatched from exactly one runtime source", async () => {
  const mainText = await Deno.readTextFile(new URL("../src/main.js", import.meta.url));
  const eventUiText = await Deno.readTextFile(new URL("../src/display/ui/wiring/eventUiWiring.js", import.meta.url));

  const mainDispatches = (mainText.match(/CustomEvent\('ui:itemUsed'/g) || []).length;
  const eventUiDispatches = (eventUiText.match(/CustomEvent\('ui:itemUsed'/g) || []).length;

  assertEquals(mainDispatches, 1, "main should dispatch ui:itemUsed once");
  assertEquals(eventUiDispatches, 0, "eventUiWiring should not dispatch ui:itemUsed");
});
