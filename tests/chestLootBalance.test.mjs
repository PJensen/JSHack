import { assert } from "jsr:@std/assert";
import "./helpers/installContentCatalog.mjs";
import { resolveLootTable } from "../src/rules/data/lootResolver.js";
import { createRng } from "../src/lib/ecs-js/rng.js";
import { getCatalogItem } from "../src/rules/data/itemCatalog.js";
import { LOOT_TABLES } from "../src/rules/data/lootTables.js";

function assertChestRollBounds(tableId, depth, seeds) {
  const table = LOOT_TABLES[tableId];
  const maxRolls = Number(table?.rolls?.max ?? 0);
  for (let seed = 0; seed < seeds; seed++) {
    const drops = resolveLootTable(tableId, createRng(seed), depth);
    assert(
      drops.length >= 1 && drops.length <= maxRolls,
      `${tableId} seed ${seed}: expected 1-${maxRolls} drops, got ${drops.length}`,
    );
  }
}

function assertChestEquipEntriesResolve(tableId, depth, seeds) {
  for (let seed = 0; seed < seeds; seed++) {
    const drops = resolveLootTable(tableId, createRng(seed), depth);
    for (const drop of drops) {
      if (drop.kind !== "equip") continue;
      const equipId = String(drop?.params?.equipId || "");
      const def = getCatalogItem(equipId);
      assert(def, `${tableId} seed ${seed}: unresolved equipId ${equipId}`);
    }
  }
}

Deno.test("chest:basic drop count stays non-empty and within max roll bound", () => {
  assertChestRollBounds("chest:basic", 1, 120);
});

Deno.test("chest:magic drop count stays non-empty and within max roll bound", () => {
  assertChestRollBounds("chest:magic", 3, 120);
});

Deno.test("chest:legendary drop count stays non-empty and within max roll bound", () => {
  assertChestRollBounds("chest:legendary", 5, 80);
});

Deno.test("chest drops never emit unresolved equipment ids", () => {
  assertChestEquipEntriesResolve("chest:basic", 1, 120);
  assertChestEquipEntriesResolve("chest:magic", 3, 120);
  assertChestEquipEntriesResolve("chest:legendary", 5, 80);
});

Deno.test("chest:basic never drops more than 1 weapon", () => {
  for (let seed = 0; seed < 100; seed++) {
    const rng = createRng(seed);
    const drops = resolveLootTable("chest:basic", rng, 1);
    
    const weapons = drops.filter(drop => {
      if (drop.kind !== "equip") return false;
      const def = getCatalogItem(drop.params.equipId);
      return def && def.slot === "weapon";
    });
    
    assert(weapons.length <= 1, `seed ${seed}: got ${weapons.length} weapons, expected max 1`);
  }
});

Deno.test("chest:magic never drops more than 1 weapon", () => {
  for (let seed = 0; seed < 100; seed++) {
    const rng = createRng(seed);
    const drops = resolveLootTable("chest:magic", rng, 3);
    
    const weapons = drops.filter(drop => {
      if (drop.kind !== "equip") return false;
      const def = getCatalogItem(drop.params.equipId);
      return def && def.slot === "weapon";
    });
    
    assert(weapons.length <= 1, `seed ${seed}: got ${weapons.length} weapons, expected max 1`);
  }
});

Deno.test("chest:legendary never drops more than 1 weapon", () => {
  for (let seed = 0; seed < 50; seed++) {
    const rng = createRng(seed);
    const drops = resolveLootTable("chest:legendary", rng, 5);
    
    const weapons = drops.filter(drop => {
      if (drop.kind !== "equip") return false;
      const def = getCatalogItem(drop.params.equipId);
      return def && def.slot === "weapon";
    });
    
    assert(weapons.length <= 1, `seed ${seed}: got ${weapons.length} weapons, expected max 1`);
  }
});
