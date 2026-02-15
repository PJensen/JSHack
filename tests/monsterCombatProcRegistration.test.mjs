import { assert } from "jsr:@std/assert";
import { MONSTERS } from "../src/rules/data/monsters.js";

Deno.test("monster hooks are first-class callbacks on monster defs", () => {
  for (let i = 0; i < MONSTERS.length; i++) {
    const hooks = MONSTERS[i].hooks;
    if (!hooks) continue;
    if (hooks.onBeforeHit != null) assert(typeof hooks.onBeforeHit === "function");
    if (hooks.onHit != null) assert(typeof hooks.onHit === "function");
    if (hooks.onDamaged != null) assert(typeof hooks.onDamaged === "function");
  }
});
