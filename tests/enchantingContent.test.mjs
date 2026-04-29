import { assert, assertEquals } from "jsr:@std/assert";
import { getDialog } from "../src/rules/dialogues/registry.js";
import { LOOT_TABLES } from "../src/rules/data/lootTables.js";
import "../src/rules/dialogues/townfolkDialogs.js";

Deno.test("enchantress dialog exposes enchanting services as a dedicated NPC", () => {
  const dialog = getDialog("townfolk:enchantress");
  assert(dialog);
  const rootChoices = dialog?.nodes?.root?.choices || [];
  assert(rootChoices.some((choice) => choice.id === "open_services"));
  assert(rootChoices.some((choice) => choice.id === "ask_reagents"));
});

Deno.test("loot tables define thematic enchanting reagent families", () => {
  assert(LOOT_TABLES["drop:spider"]);
  assert(LOOT_TABLES["drop:witch"]);
  assert(LOOT_TABLES["drop:plant"]);
  const beastEntries = LOOT_TABLES["sub:reagents_beast"]?.entries || [];
  assert(beastEntries.some((entry) => entry.itemId === "reagent_beast_claw"));
  const undeadEntries = LOOT_TABLES["sub:reagents_undead"]?.entries || [];
  assert(undeadEntries.some((entry) => entry.itemId === "reagent_bone_dust"));
  assertEquals(Array.isArray(LOOT_TABLES["drop:witch"]?.entries), true);
});
