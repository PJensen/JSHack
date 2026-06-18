import "./helpers/installContentMonsters.mjs";
import { assert } from "jsr:@std/assert";
import { LOOT_TABLES } from "../src/rules/data/lootTables.js";
import { getMonster, getMonsterLootTable } from "../src/rules/data/monsters.js";

function tableItemIds(tableId) {
  const table = LOOT_TABLES[tableId];
  const entries = Array.isArray(table?.entries) ? table.entries : [];
  const ids = new Set();
  for (const entry of entries) {
    if (entry?.type === "item" && typeof entry.itemId === "string") ids.add(entry.itemId);
  }
  return ids;
}

function tableGemIds(tableId) {
  const table = LOOT_TABLES[tableId];
  const entries = Array.isArray(table?.entries) ? table.entries : [];
  const ids = new Set();
  for (const entry of entries) {
    if (entry?.type === "gem" && typeof entry.gemId === "string") ids.add(entry.gemId);
  }
  return ids;
}

Deno.test("drop:undead includes explicit anti-undead/curse counter items", () => {
  const ids = tableItemIds("drop:undead");
  assert(ids.has("potion_holy_water"), "drop:undead should include potion_holy_water");
  assert(ids.has("scroll_remove_curse"), "drop:undead should include scroll_remove_curse");
});

Deno.test("drop:caster includes practical resistance and cleanse counters", () => {
  const ids = tableItemIds("drop:caster");
  assert(ids.has("potion_anti_venom"), "drop:caster should include potion_anti_venom");
  assert(ids.has("potion_resist_poison"), "drop:caster should include potion_resist_poison");
  assert(ids.has("potion_resist_electric"), "drop:caster should include potion_resist_electric");
  assert(ids.has("potion_resist_fire"), "drop:caster should include potion_resist_fire");
  assert(ids.has("scroll_remove_curse"), "drop:caster should include scroll_remove_curse");
});

Deno.test("venomous monsters route to drop:venomous and can drop poison resistance", () => {
  const snake = getMonster("snake");
  const spider = getMonster("spider");
  assert(getMonsterLootTable(snake) === "drop:venomous", "snake should use drop:venomous");
  // Spiders now have dedicated drop:spider table (added OVERWORLD: spawns commit).
  assert(getMonsterLootTable(spider) === "drop:spider", "spider uses dedicated drop:spider table");

  const ids = tableItemIds("drop:venomous");
  assert(ids.has("potion_resist_poison"), "drop:venomous should include potion_resist_poison");
});

Deno.test("stone taunter routes to stone drops including flint", () => {
  const def = getMonster("stone_taunter");
  assert(getMonsterLootTable(def) === "drop:stone_taunter", "stone_taunter should use its stone drop table");

  const ids = tableGemIds("drop:stone_taunter");
  assert(ids.has("stone_flint"), "drop:stone_taunter should include stone_flint");
});
