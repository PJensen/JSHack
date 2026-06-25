import "./helpers/installContentCatalog.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { INTERACT_PAYLOADS } from "../src/rules/content/interaction/interactPayloads.js";
import { getAuthoredInteractable } from "../src/rules/interaction/interactableRegistry.js";
import { Fountain } from "../src/rules/archetypes/RoomFeatures.js";
import { FountainState } from "../src/rules/components/FountainState.js";
import { Interactable } from "../src/rules/components/Interactable.js";
import { createFrom } from "../src/lib/ecs-js/archetype.js";
import { createFountainPresentationExtension } from "../src/display/ui/wiring/fountainPresentationExtension.js";
import { createFountainUiExtension } from "../src/display/ui/wiring/fountainUiExtension.js";

Deno.test("authored fountain owns named verb rules outside the legacy registry body", async () => {
  const definition = getAuthoredInteractable("fountain");
  assert(definition);
  assertEquals(typeof definition.actions, "function");
  assertEquals(definition.defaultVerb, "drink");
  assertEquals(definition.verbs.drink.id, "fountain.drink");
  assertEquals(definition.verbs.dip.id, "fountain.dip");

  const legacySource = await Deno.readTextFile(new URL("../src/rules/content/interaction/interactPayloads.js", import.meta.url));
  assert(!/\n\s*fountain:\s*\{/.test(legacySource), "fountain must not regress into the legacy payload object");
  assertEquals(INTERACT_PAYLOADS.fountain, undefined);

  const fountainSource = await Deno.readTextFile(new URL("../src/content/interactables/fountain/index.js", import.meta.url));
  assert(!fountainSource.includes("ctx.world"), "fountain rule content must use query/mutate/io capabilities");
  assert(!/\bworld\.(set|add|destroy|emit)\s*\(/.test(fountainSource), "fountain content must not mutate the ECS world directly");
});

Deno.test("fountain archetype owns durable ECS state", () => {
  const world = new World({ seed: 9 });
  const id = createFrom(world, Fountain, { x: 3, y: 4 });
  assert(world.has(id, Interactable));
  assert(world.has(id, FountainState));
  assertEquals(world.get(id, Interactable).params, null);
  assert(world.get(id, FountainState).chargesRemaining > 0, "new fountains must project as active before first interaction");
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
