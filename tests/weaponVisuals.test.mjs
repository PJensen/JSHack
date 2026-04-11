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

Deno.test("signature weapon overrides are applied in catalog output", () => {
  const sun = ITEM_CATALOG.sunsword;
  assert(sun, "expected sunsword catalog entry");
  assertEquals(Number(sun.weaponLengthCm), 116);
  assert(typeof sun.weaponVfxProfile === "object", "expected sunsword profile object override");

  const doom = ITEM_CATALOG.doom_crossbow;
  assert(doom, "expected doom_crossbow catalog entry");
  assertEquals(Number(doom.weaponLengthCm), 98);
  assert(typeof doom.weaponVfxProfile === "object", "expected doom_crossbow object profile override");
});

Deno.test("buildCatalogItem keeps object weapon density profiles", () => {
  const world = new World({ seed: 0xCAFE });
  const id = buildCatalogItem(world, "sunsword");
  const info = world.get(id, ItemInfo);
  assert(info, "expected ItemInfo for sunsword");
  assertEquals(Number(info.weaponLengthCm), 116);
  assert(typeof info.weaponVfxProfile === "object", "expected object profile on ItemInfo");
  assert(Array.isArray(info.weaponVfxProfile.alphaStops), "expected alphaStops array on object profile");
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

Deno.test("director pass applies bespoke profiles to iconic weapons", () => {
  const ids = [
    "cataclysm_axe",
    "hungering_cleaver",
    "blood_covenant_rapier",
    "eclipse_maul",
    "warhammer_of_fury",
    "witchfire_sword",
  ];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const rec = ITEM_CATALOG[id];
    assert(rec, `missing catalog item ${id}`);
    assert(Number(rec.weaponLengthCm || 0) > 0, `${id} should have explicit weaponLengthCm`);
    assert(typeof rec.weaponVfxProfile === "object", `${id} should use bespoke object profile`);
    assert(Array.isArray(rec.weaponVfxProfile.alphaStops), `${id} should include alphaStops`);
  }
});
