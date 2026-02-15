import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { Status } from "../src/rules/components/Status.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { effectSystem, registerEffectCallback } from "../src/rules/systems/effectSystem.js";

Deno.test("effect callback fallback still runs for unknown effect keys", () => {
  const world = new World({ seed: 333 });
  world.setScheduler((w) => effectSystem(w));

  registerEffectCallback("test:phase3:unknownEffect", ({ id, e, vit, statusMap }) => {
    if (vit) vit.hp = Math.max(0, vit.hp - 1);
    statusMap.set("phase3_custom", {
      type: "phase3_custom",
      duration: e.turnsLeft,
      potency: 1,
      stacks: 1,
    });
  });

  const id = world.create();
  world.add(id, Vitality, { maxHp: 10, hp: 10 });
  world.add(id, ActiveEffects, {
    effects: [{ key: "unknown_effect", cbKey: "test:phase3:unknownEffect", turnsLeft: 2, potency: 1, stacks: 1 }],
  });

  world.tick(1);

  const vit = world.get(id, Vitality);
  const status = world.get(id, Status);
  assertEquals(vit.hp, 9);
  assert(status && Array.isArray(status.statuses), "status component should be projected");
  assert(status.statuses.some((s) => s.type === "phase3_custom"), "callback should project custom status");
});

