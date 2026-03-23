import { assert, assertEquals } from "jsr:@std/assert";
import { getMonster, getMonsterLootTable } from "../src/rules/data/monsters.js";
import { resolveLootTable } from "../src/rules/data/lootResolver.js";
import { createRng } from "../src/lib/ecs-js/rng.js";

Deno.test("bat uses dedicated non-weapon loot table", () => {
  const bat = getMonster("bat");
  assert(bat, "bat should exist");
  assertEquals(getMonsterLootTable(bat), "drop:bat");
});

Deno.test("bat loot table does not emit equipment drops", () => {
  for (let seed = 1; seed <= 500; seed++) {
    const rng = createRng(seed);
    const drops = resolveLootTable("drop:bat", rng, 1);
    for (const drop of drops) {
      assert(drop.kind !== "equip", `unexpected equip drop for seed ${seed}`);
    }
  }
});
