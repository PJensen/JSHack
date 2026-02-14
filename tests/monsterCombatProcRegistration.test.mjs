import { assert } from "jsr:@std/assert";
import { MONSTERS } from "../src/rules/data/monsters.js";
import { listRegisteredScripts } from "../src/rules/scripting.js";
import "../src/rules/scripts/monsters.js";

Deno.test("monster scripts with hooks are registered", () => {
  const registered = new Set(listRegisteredScripts());
  for (let i = 0; i < MONSTERS.length; i++) {
    const script = MONSTERS[i].script;
    if (!script || !MONSTERS[i].hooks) continue;
    assert(registered.has(script), `expected script to be registered: ${script}`);
  }
});
