import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { InteractIntent } from "../src/rules/components/Intents/InteractIntent.js";
import { Faction } from "../src/rules/components/Faction.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { materializeSpawn } from "../src/rules/environment/dungeon/populate.js";
import { interactionSystem } from "../src/rules/systems/interactionSystem.js";
import {
  clearPolymorphHooks,
  installPolymorphListener,
  registerPolymorphHook,
} from "../src/rules/systems/polymorphSystem.js";

Deno.test("touchMimic polymorphs chest-disguise into a hostile mimic and exposes hooks", () => {
  clearPolymorphHooks();
  const world = new World({ seed: 42 });
  installPolymorphListener(world);

  let beforeCount = 0;
  let afterCount = 0;
  const offBefore = registerPolymorphHook("before", (ctx) => {
    beforeCount++;
    assertEquals(ctx.targetIdentity, "mimic");
    assertEquals(ctx.hookKey, "mimic_touch");
  });
  const offAfter = registerPolymorphHook("after", (ctx) => {
    afterCount++;
    assert(ctx.toEntityId > 0, "after hook should expose spawned id");
  });

  const actor = world.create();
  const mimicChest = materializeSpawn(world, {
    x: 6,
    y: 7,
    kind: "mimic",
    params: { depth: 4 },
  });
  assert(mimicChest > 0, "mimic chest should spawn");
  assertEquals(world.get(mimicChest, NamedIdentity)?.identity, "chest");

  const revealed = [];
  world.on("mimic:revealed", (ev) => revealed.push(ev));

  world.add(actor, InteractIntent, { targetId: mimicChest });
  interactionSystem(world);

  assert(!world.isAlive(mimicChest), "chest disguise should be consumed by polymorph");
  assertEquals(revealed.length, 1);

  const mimicId = revealed[0].toEntityId | 0;
  assert(mimicId > 0 && world.isAlive(mimicId), "revealed mimic should be alive");
  assertEquals(world.get(mimicId, NamedIdentity)?.identity, "mimic");
  assertEquals(world.get(mimicId, Faction)?.key, "enemy");
  assert((world.get(mimicId, Vitality)?.hp || 0) > 0, "revealed mimic should have vitality");
  assertEquals(beforeCount, 1);
  assertEquals(afterCount, 1);

  offBefore();
  offAfter();
  clearPolymorphHooks();
});

Deno.test("installPolymorphListener is idempotent", () => {
  clearPolymorphHooks();
  const world = new World({ seed: 99 });
  installPolymorphListener(world);
  installPolymorphListener(world);

  const actor = world.create();
  const mimicChest = materializeSpawn(world, {
    x: 1,
    y: 1,
    kind: "mimic",
    params: { depth: 2 },
  });

  let revealCount = 0;
  world.on("mimic:revealed", () => { revealCount++; });

  world.add(actor, InteractIntent, { targetId: mimicChest });
  interactionSystem(world);

  assertEquals(revealCount, 1);
  clearPolymorphHooks();
});

