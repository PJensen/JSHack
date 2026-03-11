import { assert } from "jsr:@std/assert";

Deno.test("ranged attack system dispatches ammo projectile scripts through shared helper", async () => {
  const path = new URL("../src/rules/systems/rangedAttackSystem.js", import.meta.url);
  const text = await Deno.readTextFile(path);
  assert(
    text.includes("runAmmoScripts("),
    "rangedAttackSystem should dispatch projectile content through runAmmoScripts",
  );
  assert(
    !text.includes("getAmmoHooks("),
    "rangedAttackSystem should not read legacy ammo callback lists directly",
  );
  assert(
    !text.includes("runCallbackList("),
    "rangedAttackSystem should not execute projectile callback lists directly",
  );
});
