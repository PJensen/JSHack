import { assert } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { createProjectileFxController } from "../src/display/fx/projectileFx.js";

function addWeapon(world, identity, affixes = []) {
  const id = world.create();
  world.add(id, NamedIdentity, { name: identity, identity });
  world.add(id, ItemInfo, {
    type: "weapon",
    subtype: "bow",
    slot: "",
    weight: 1,
    value: 1,
    description: "",
    count: 1,
    bonuses: {},
    twoHanded: false,
    rarity: 1,
    rarityName: "common",
    affixes: Array.isArray(affixes) ? affixes.slice() : [],
  });
  return id;
}

Deno.test("projectile FX can inherit ranged-shot style from weapon VFX profile while preserving arrow/spell pathways", () => {
  const world = new World({ seed: 91 });
  const attacker = world.create();
  const target = world.create();
  world.add(attacker, Position, { x: 2, y: 2 });
  world.add(target, Position, { x: 7, y: 2 });

  const venomBow = addWeapon(world, "venom_bow", ["venomous1"]);
  world.add(attacker, Equipment, { ranged: venomBow });

  const controller = createProjectileFxController({
    world,
    cam: {},
    fx: { pool: { spawn() {} } },
    getPosition: (id) => {
      const pos = world.get(id, Position);
      return pos ? { x: pos.x, y: pos.y } : null;
    },
  });
  controller.installListeners();

  world.emit("ranged:shot", {
    attacker,
    target,
    hit: true,
    style: "plain",
    projectileSpeed: 18,
  });

  let lights = controller.getActiveLights();
  assert(
    lights.some((light) => Array.isArray(light.color) && light.color[0] === 120 && light.color[1] === 255),
    "expected venom profile color on plain ranged shot",
  );

  world.emit("ranged:shot", {
    attacker,
    target,
    hit: true,
    style: "fire",
    projectileSpeed: 18,
  });
  lights = controller.getActiveLights();
  assert(
    lights.some((light) => Array.isArray(light.color) && light.color[0] === 255 && light.color[1] === 100 && light.color[2] === 30),
    "expected fire-arrow light path to remain intact",
  );

  world.emit("spell:frost", {
    from: { x: 1, y: 1 },
    at: { x: 5, y: 1 },
    fizzle: false,
  });
  lights = controller.getActiveLights();
  assert(
    lights.some((light) => Array.isArray(light.color) && light.color[0] === 140 && light.color[1] === 200 && light.color[2] === 255),
    "expected spell frost projectile path to remain separate",
  );
});

