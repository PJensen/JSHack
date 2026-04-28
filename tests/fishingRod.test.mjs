import { assertEquals } from "jsr:@std/assert";
import { getCatalogItem } from "../src/rules/data/itemCatalog.js";
import { getItemHooksByIdentity } from "../src/rules/content/items/itemHooks.js";
import "../src/content/items/fishingRod.js";
import { installContent } from "../src/content/install.js";
installContent();

Deno.test("fishing_rod is a content DSL item with a cast_line ability", () => {
  const def = getCatalogItem("fishing_rod");
  assertEquals(def?._contentAbilities?.cast_line?.name, "Cast Line");
});

Deno.test("fishing_rod on_use requests a fishing cast", () => {
  const hooks = getItemHooksByIdentity("fishing_rod");
  const emits = [];
  const result = hooks.onUse({
    actor: 1,
    query: {
      worldStep() { return 0; },
      get() { return null; },
    },
    io: {
      emit(name, payload) { emits.push({ name, payload }); },
      message() {},
    },
  }, {
    actor: 1,
    itemId: 42,
    identity: "fishing_rod",
  });

  assertEquals(result?.consumed, false);
  assertEquals(emits.length, 1);
  assertEquals(emits[0].name, "fishing:cast:request");
  assertEquals(emits[0].payload.itemId, 42);
  assertEquals(emits[0].payload.turns, 4);
});
