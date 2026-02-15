import { assert } from "jsr:@std/assert";
import { MONSTERS } from "../src/rules/data/monsters.js";

Deno.test("monster hooks are first-class callbacks on monster defs", () => {
  for (let i = 0; i < MONSTERS.length; i++) {
    const hooks = MONSTERS[i].hooks;
    if (!hooks) continue;
    for (const [key, list] of Object.entries(hooks)) {
      assert(Array.isArray(list), `${MONSTERS[i].id}.hooks.${key} should be an array`);
      for (const fn of list) {
        assert(typeof fn === "function", `${MONSTERS[i].id}.hooks.${key} entry should be a function`);
      }
    }
  }
});

Deno.test("monster hooks remain combat-only", () => {
  for (let i = 0; i < MONSTERS.length; i++) {
    const hooks = MONSTERS[i].hooks;
    if (!hooks) continue;
    assert(!("eat" in hooks), `${MONSTERS[i].id} should not define hooks.eat`);
  }
});
