import { assert } from "jsr:@std/assert";
import { MONSTER_STATUS_PROC_DEFS } from "../src/rules/data/monsterStatusProcs.js";

Deno.test("monster status proc defs declare callable behavior or data effect", () => {
  for (let i = 0; i < MONSTER_STATUS_PROC_DEFS.length; i++) {
    const def = MONSTER_STATUS_PROC_DEFS[i];
    assert(
      typeof def.apply === "function" || (def.effect && typeof def.effect === "object"),
      `expected proc def ${def.id} to have apply callback or effect payload`,
    );
  }
});
