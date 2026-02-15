import { assert } from "jsr:@std/assert";
import { MONSTER_STATUS_PROC_DEFS } from "../src/rules/data/monsterStatusProcs.js";
import { MONSTER_COMBAT_PROC_DEFS } from "../src/rules/data/monsterCombatProcs.js";
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

Deno.test("monster status proc defs are projected into runtime monster combat proc defs", () => {
  const runtimeIds = new Set(MONSTER_COMBAT_PROC_DEFS.map((def) => String(def.id || "")));

  for (let i = 0; i < MONSTER_STATUS_PROC_DEFS.length; i++) {
    const def = MONSTER_STATUS_PROC_DEFS[i];
    assert(runtimeIds.has(def.id), `expected runtime proc defs to include ${def.id}`);
    const hook = getMonster(def.monsterId)?.hooks?.[def.trigger];
    assert(typeof hook === "function", `expected hook ${def.monsterId}.${def.trigger} to exist`);
  }
});
