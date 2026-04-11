import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { ITEM_CATALOG } from "../src/rules/data/itemCatalog.js";
import { buildCatalogItem } from "../src/rules/data/itemCatalogLoader.js";
import {
  isWeaponCatalogItem,
  resolveWeaponVisualMeta,
} from "../src/rules/data/weaponVisuals.js";

Deno.test("every catalog weapon has canonical lengthCm and vfx profile", () => {
  const weaponEntries = Object.entries(ITEM_CATALOG)
    .filter(([, rec]) => isWeaponCatalogItem(rec));
  assert(weaponEntries.length > 0, "expected at least one weapon entry in catalog");
  for (const [id, rec] of weaponEntries) {
    const lengthCm = Number(rec.weaponLengthCm || 0);
    assert(lengthCm > 0, `weapon ${id} should have positive weaponLengthCm`);
    assertEquals(Number.isFinite(lengthCm), true, `weapon ${id} length should be finite`);
    const profile = String(rec.weaponVfxProfile || "").trim();
    assert(profile.length > 0, `weapon ${id} should have weaponVfxProfile`);
  }
});

Deno.test("buildCatalogItem propagates weapon visual metadata into ItemInfo", () => {
  const world = new World({ seed: 0xBEEF });
  const weaponId = buildCatalogItem(world, "sword_plain");
  const info = world.get(weaponId, ItemInfo);
  assert(info, "expected ItemInfo on built weapon");
  assert(Number(info.weaponLengthCm || 0) > 0, "expected propagated weaponLengthCm");
  assert(String(info.weaponVfxProfile || "").length > 0, "expected propagated weaponVfxProfile");
});

Deno.test("weapon visual overrides take priority over inferred defaults", () => {
  const meta = resolveWeaponVisualMeta({
    id: "ancient_sword",
    name: "Ancient Sword",
    slot: "weapon",
    type: "equip",
    damageType: "slash",
    weaponLengthCm: 333,
    weaponVfxProfile: "spear",
  });
  assertEquals(meta.weaponLengthCm, 333);
  assertEquals(meta.weaponVfxProfile, "spear");
  assertEquals(meta.weaponClass, "spear");
});
