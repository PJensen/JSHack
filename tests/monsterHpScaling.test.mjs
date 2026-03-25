import { assertEquals } from "jsr:@std/assert";
import { getMonster, MONSTER_HP_SCALAR, resolveMonsterMaxHp } from "../src/rules/data/monsters.js";
import { pickSpecificMonster } from "../src/rules/environment/dungeon/tables.js";

Deno.test("resolveMonsterMaxHp applies global scalar to depth-scaled hp", () => {
  const rat = getMonster("rat");
  const depth = 1;
  const expected = Math.max(1, Math.floor((Number(rat.baseHp) + depth * Number(rat.hpPerLevel)) * MONSTER_HP_SCALAR));
  assertEquals(resolveMonsterMaxHp(rat, depth), expected);
});

Deno.test("pickSpecificMonster maxHp delegates to canonical hp scaling", () => {
  const depth = 6;
  const spawn = pickSpecificMonster("orc", depth);
  const orc = getMonster("orc");
  assertEquals(spawn.maxHp, resolveMonsterMaxHp(orc, depth));
});
