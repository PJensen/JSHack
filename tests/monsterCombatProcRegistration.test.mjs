import { assert } from "jsr:@std/assert";
import { MONSTER_COMBAT_PROC_DEFS } from "../src/rules/data/monsterCombatProcs.js";
import { listRegisteredScripts } from "../src/rules/scripting.js";
import "../src/rules/scripts/monsters.js";

Deno.test("monster combat proc defs are registered as scripts", () => {
  const registered = new Set(listRegisteredScripts());
  for (let i = 0; i < MONSTER_COMBAT_PROC_DEFS.length; i++) {
    const script = MONSTER_COMBAT_PROC_DEFS[i].script;
    assert(registered.has(script), `expected script to be registered: ${script}`);
  }
});

