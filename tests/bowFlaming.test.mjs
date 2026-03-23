import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { buildCatalogItem } from "../src/rules/data/itemCatalogLoader.js";
import { getTable } from "../src/rules/data/lootTables.js";
import { ITEM_CATALOG } from "../src/rules/data/itemCatalog.js";
import { LOOT_TABLES } from "../src/rules/data/lootTables.js";

Deno.test("bow_flaming has boosted damage and built-in flaming affix", () => {
  const world = new World({ seed: 0xC0FFEE });
  const shortBowId = buildCatalogItem(world, "bow_short");
  const flamingBowId = buildCatalogItem(world, "bow_flaming");
  const shortBowInfo = world.get(shortBowId, ItemInfo);
  const flamingBowInfo = world.get(flamingBowId, ItemInfo);

  assertEquals(shortBowInfo.damageDice, "1d6");
  assertEquals(flamingBowInfo.damageDice, "1d8");
  assert(
    Array.isArray(flamingBowInfo.affixes) && flamingBowInfo.affixes.includes("flaming"),
    "bow_flaming should include flaming affix",
  );
});

Deno.test("bow_flaming is present in equipment drop tables", () => {
  const subEquipMagic = getTable("sub:equip_magic");
  assert(subEquipMagic, "sub:equip_magic table should exist");
  const hasInSubMagic = subEquipMagic.entries.some((entry) =>
    entry.type === "equip" && Array.isArray(entry.pool) && entry.pool.includes("bow_flaming")
  );
  assert(hasInSubMagic, "sub:equip_magic should include bow_flaming");

  const rackMagic = getTable("rack:weapons:magic");
  assert(rackMagic, "rack:weapons:magic table should exist");
  const hasInRackMagic = rackMagic.entries.some((entry) =>
    entry.type === "equip" && Array.isArray(entry.pool) && entry.pool.includes("bow_flaming")
  );
  assert(hasInRackMagic, "rack:weapons:magic should include bow_flaming");
});

Deno.test("bow_flaming drop entries never roll extra affixes", () => {
  const tables = ["sub:equip_magic", "chest:magic", "rack:weapons:magic"];
  for (const tableId of tables) {
    const table = getTable(tableId);
    assert(table, `${tableId} should exist`);
    const flamingEntries = table.entries.filter((entry) =>
      entry.type === "equip" && Array.isArray(entry.pool) && entry.pool.includes("bow_flaming")
    );
    assert(flamingEntries.length > 0, `${tableId} should include at least one bow_flaming entry`);
    for (const entry of flamingEntries) {
      assertEquals(Number(entry.affixChance || 0), 0, `${tableId} bow_flaming should have affixChance 0`);
      assertEquals(Number(entry.affixCountMax || 0), 0, `${tableId} bow_flaming should have affixCountMax 0`);
    }
  }
});

Deno.test("loot tables: built-in affix/proc equipment never rolls extra random affixes", () => {
  const builtIn = new Set(
    Object.entries(ITEM_CATALOG)
      .filter(([, def]) =>
        def?.type === "equip" &&
        ((Array.isArray(def.affixes) && def.affixes.length > 0) ||
          (Array.isArray(def.procPackages) && def.procPackages.length > 0))
      )
      .map(([id]) => id),
  );

  for (const [tableId, table] of Object.entries(LOOT_TABLES)) {
    const entries = Array.isArray(table?.entries) ? table.entries : [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry?.type !== "equip") continue;
      if (!(Number(entry.affixChance || 0) > 0)) continue;
      const pool = Array.isArray(entry.pool) ? entry.pool : [];
      const offenders = pool.filter((equipId) => builtIn.has(equipId));
      assertEquals(
        offenders.length,
        0,
        `${tableId} entry #${i} should not roll extra affixes for built-in equipment: ${offenders.join(",")}`,
      );
    }
  }
});
