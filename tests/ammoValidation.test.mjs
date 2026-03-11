import { assertThrows } from "jsr:@std/assert";
import { AMMO_DEFS } from "../src/rules/data/ammo.js";
import { validateAmmoDefs } from "../src/rules/data/validate.js";

Deno.test("ammo defs validate when projectile hooks are authored as script refs", () => {
  validateAmmoDefs(AMMO_DEFS);
});

Deno.test("ammo defs reject legacy function hooks", () => {
  assertThrows(
    () => validateAmmoDefs({
      ammo_bad: {
        id: "ammo_bad",
        name: "Bad Ammo",
        scripts: {
          onProjectileActorImpact: [() => {}],
        },
      },
    }),
    Error,
    "must be a script ref",
  );
});
