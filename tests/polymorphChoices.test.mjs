import "./helpers/installContentMonsters.mjs";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildMonsterChoiceOptions, buildPolymorphTargetOptions } from "../src/main/monsters/monsterChoices.js";

Deno.test("generic monster choice options expose species ids for exact selection", () => {
  const choices = buildMonsterChoiceOptions({ currentDepth: 1 });
  const goblin = choices.find((choice) => choice.id === "goblin");

  assert(goblin, "expected goblin choice");
  assertEquals(goblin.name, "Goblin");
  assertEquals(goblin.enabled, true);
});

Deno.test("polymorph target options put curated control forms first", () => {
  const choices = buildPolymorphTargetOptions({ currentDepth: 1 });
  assert(choices.length > 0, "expected monster choices");

  const ids = choices.map((choice) => choice.id);
  assertEquals(ids.slice(0, 3), ["rat", "bat", "lichen"]);
  assert(choices[0].featured, "rat should be surfaced as a common controlled target");
  assertEquals(choices[0].role, "Safe control");
});

Deno.test("polymorph target options expose display-safe policy metadata", () => {
  const choices = buildPolymorphTargetOptions({ currentDepth: 1 });
  const rustMonster = choices.find((choice) => choice.id === "rust_monster");
  const dragonWhelp = choices.find((choice) => choice.id === "dragon_whelp");

  assert(rustMonster, "expected rust monster choice");
  assert(dragonWhelp, "expected dragon whelp choice");
  assertEquals(rustMonster.enabled, true);
  assertEquals(rustMonster.role, "Dangerous utility");
  assertEquals(dragonWhelp.danger, "high");
  assert(Array.isArray(dragonWhelp.tags), "tags should be a DTO array for display filtering");
});
