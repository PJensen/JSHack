import { assert } from "jsr:@std/assert";
import { resolveLootTable } from "../src/rules/data/lootResolver.js";
import { createRng } from "../src/lib/ecs-js/rng.js";
import { getCatalogItem } from "../src/rules/data/itemCatalog.js";

Deno.test("chest:basic drops at most 1-2 total items", () => {
  const rng = createRng(42);
  const drops = resolveLootTable("chest:basic", rng, 1);
  assert(drops.length >= 1 && drops.length <= 2, `expected 1-2 items, got ${drops.length}`);
});

Deno.test("chest:magic drops at most 2-3 total items", () => {
  const rng = createRng(42);
  const drops = resolveLootTable("chest:magic", rng, 3);
  assert(drops.length >= 2 && drops.length <= 3, `expected 2-3 items, got ${drops.length}`);
});

Deno.test("chest:legendary drops at most 2-4 total items", () => {
  const rng = createRng(42);
  const drops = resolveLootTable("chest:legendary", rng, 5);
  assert(drops.length >= 2 && drops.length <= 4, `expected 2-4 items, got ${drops.length}`);
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
