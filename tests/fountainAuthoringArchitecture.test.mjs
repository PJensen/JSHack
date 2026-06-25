import "./helpers/installContentCatalog.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { INTERACT_PAYLOADS } from "../src/rules/content/interaction/interactPayloads.js";
import { Fountain } from "../src/rules/archetypes/RoomFeatures.js";
import { FountainState } from "../src/rules/components/FountainState.js";
import { Interactable } from "../src/rules/components/Interactable.js";
import { createFrom } from "../src/lib/ecs-js/archetype.js";
import { createFountainPresentationExtension } from "../src/display/ui/wiring/fountainPresentationExtension.js";
import { createFountainUiExtension } from "../src/display/ui/wiring/fountainUiExtension.js";

Deno.test("authored fountain owns its actions and hooks outside the legacy registry body", async () => {
  const definition = INTERACT_PAYLOADS.fountain;
  assert(definition);
  assertEquals(typeof definition.beforeInteract, "function");
  assertEquals(typeof definition.onInteract, "function");
  assertEquals(typeof definition.actions, "function");

  const legacySource = await Deno.readTextFile(new URL("../src/rules/content/interaction/interactPayloads.js", import.meta.url));
  assert(!/\n\s*fountain:\s*\{/.test(legacySource), "fountain must not regress into the legacy payload object");
});

Deno.test("fountain archetype owns durable ECS state", () => {
  const world = new World({ seed: 9 });
  const id = createFrom(world, Fountain, { x: 3, y: 4 });
  assert(world.has(id, Interactable));
  assert(world.has(id, FountainState));
  assertEquals(world.get(id, Interactable).params, null);
});

Deno.test("fountain display consumers install as idempotent extensions", () => {
  const world = new World();
  const ftext = { addHeal() {}, addDamage() {}, addStatus() {} };
  const fx = { pool: { spawn() {} } };
  const presentation = createFountainPresentationExtension({ ftext, fx, getPosition: () => null });
  const ui = createFountainUiExtension({ getPlayerEntity: () => null, getItemInfo: () => null, resolveItemDisplayName: () => "" });
  world.install(presentation);
  world.install(presentation);
  world.install(ui);
  world.install(ui);
  assertEquals(world.extensions().filter((entry) => entry.name.includes("fountain")).length, 2);
});
