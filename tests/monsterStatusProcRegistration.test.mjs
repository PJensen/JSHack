import { assert } from "jsr:@std/assert";
import { MONSTER_STATUS_PROC_DEFS } from "../src/rules/data/monsterStatusProcs.js";
import { getMonster } from "../src/rules/data/monsters.js";

Deno.test("monster status proc defs declare callable behavior or data effect", () => {
  for (let i = 0; i < MONSTER_STATUS_PROC_DEFS.length; i++) {
    const def = MONSTER_STATUS_PROC_DEFS[i];
    assert(typeof def.monsterId === "string" && def.monsterId.length > 0, `expected proc def ${def.id} to declare monsterId`);
    assert(
      typeof def.apply === "function" || (def.effect && typeof def.effect === "object"),
      `expected proc def ${def.id} to have apply callback or effect payload`,
    );
  }
});

Deno.test("every monster with proc defs has corresponding hooks on its monster definition", () => {
  for (let i = 0; i < MONSTER_STATUS_PROC_DEFS.length; i++) {
    const def = MONSTER_STATUS_PROC_DEFS[i];
    const hookList = getMonster(def.monsterId)?.hooks?.[def.trigger];
    assert(Array.isArray(hookList) && hookList.length > 0, `expected hook array ${def.monsterId}.${def.trigger} to exist and be non-empty`);
  }
});
