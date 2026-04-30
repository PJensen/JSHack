import { assert, assertEquals, assertStrictEquals } from "jsr:@std/assert";
import "./helpers/installContentCatalog.mjs";
import { allContentItems } from "../src/content/registry.js";
import { getCatalogItem } from "../src/rules/data/itemCatalog.js";
import { EQUIPMENT_ITEMS } from "../src/rules/data/itemCatalogEquipment.js";
import { MAGIC_ITEMS } from "../src/rules/data/itemCatalogMagic.js";
import { getItemHooksByIdentity } from "../src/rules/content/items/itemHooks.js";

const CATALOG_PARITY_FIELDS = Object.freeze([
  "id",
  "catalogKind",
  "name",
  "type",
  "slot",
  "material",
  "rarity",
  "rarityName",
  "weight",
  "value",
  "description",
]);

function assertInstalledFromContent(id) {
  const contentDef = allContentItems().get(id);
  assert(contentDef, `content item ${id} should be registered`);

  const catalogDef = getCatalogItem(id);
  assert(catalogDef, `catalog item ${id} should exist after installContent()`);
  assertStrictEquals(
    catalogDef,
    contentDef,
    `catalog item ${id} should be the DSL-compiled definition, not a static shadow`,
  );

  return { contentDef, catalogDef };
}

function assertCatalogParityFields(id, fields = CATALOG_PARITY_FIELDS) {
  const { contentDef, catalogDef } = assertInstalledFromContent(id);
  for (const field of fields) {
    assertEquals(
      catalogDef[field],
      contentDef[field],
      `catalog item ${id} should preserve DSL field ${field}`,
    );
  }
}

Deno.test("content DSL items are canonical catalog entries after installContent", () => {
  const contentItems = allContentItems();
  assert(contentItems.size > 0, "content item registry should not be empty");

  for (const id of contentItems.keys()) {
    assertCatalogParityFields(id);
  }
});

Deno.test("content DSL items do not have static catalog shadows", () => {
  const contentItems = allContentItems();
  for (const id of contentItems.keys()) {
    assert(!EQUIPMENT_ITEMS[id], `content item ${id} must not also live in itemCatalogEquipment.js`);
    assert(!MAGIC_ITEMS[id], `content item ${id} must not also live in itemCatalogMagic.js`);
  }
});

Deno.test("fishing_rod canonical entry keeps its authored use behavior", () => {
  const { catalogDef } = assertInstalledFromContent("fishing_rod");
  assert(catalogDef._contentAbilities?.cast_line, "fishing_rod should expose cast_line from the DSL");

  const hooks = getItemHooksByIdentity("fishing_rod");
  assert(typeof hooks.onUse === "function", "fishing_rod should expose its DSL onUse hook");

  const emits = [];
  const result = hooks.onUse({
    actor: 7,
    query: {
      worldStep() { return 0; },
      get() { return null; },
    },
    io: {
      emit(name, payload) { emits.push({ name, payload }); },
      message() {},
    },
  }, {
    actor: 7,
    itemId: 99,
    identity: "fishing_rod",
  });

  assertEquals(result?.consumed, false);
  assertEquals(emits, [{
    name: "fishing:cast:request",
    payload: {
      actor: 7,
      itemId: 99,
      turns: 12,
    },
  }]);
});
