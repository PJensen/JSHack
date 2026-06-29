import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createFrom } from "../src/lib/ecs-js/archetype.js";
import { basePalette } from "../src/display/palette/base.js";
import { Mailbox } from "../src/rules/archetypes/Overworld.js";
import { Interactable } from "../src/rules/components/Interactable.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Position } from "../src/rules/components/Position.js";
import { Player } from "../src/rules/components/Player.js";
import { MailboxOpenRequested } from "../src/events/MailboxOpenRequested.js";
import { runInteractHooks } from "../src/rules/interaction/interactRunner.js";
import { resolveInteractableAffordance } from "../src/rules/interaction/interactableAffordance.js";
import { canonicalMailPhone } from "../src/cloud/mailbox/client.js";
import { installContent } from "../src/content/install.js";
import "../src/content/interactables/index.js";

installContent();

Deno.test("mailbox uses the actual e-mail glyph", () => {
  assertEquals(basePalette.mailbox?.glyph, "✉");
});

Deno.test("Mailbox archetype is an authored mailbox interactable", () => {
  const world = new World({ seed: 1 });
  const id = createFrom(world, Mailbox, { x: 4, y: 5 });

  assertEquals(world.get(id, Position), { x: 4, y: 5 });
  assertEquals(world.get(id, NamedIdentity)?.identity, "mailbox");
  assertEquals(world.get(id, Interactable)?.action, "openMailbox");

  const affordance = resolveInteractableAffordance(world, id);
  assertEquals(affordance?.title, "Mailbox");
  assertEquals(affordance?.label, "Check mail");
});

Deno.test("openMailbox emits a concrete mailbox event", () => {
  const world = new World({ seed: 2 });
  const actor = world.create();
  world.add(actor, Player);
  const target = createFrom(world, Mailbox, { x: 1, y: 1 });
  const events = [];
  world.on(MailboxOpenRequested, (event) => events.push(event));

  assertEquals(runInteractHooks("openMailbox", world, actor, target, null, null), true);
  assertEquals(events.length, 1);
  assertEquals(events[0].actor, actor);
  assertEquals(events[0].targetId, target);
});

Deno.test("mail phone canonicalization strips everything but digits", () => {
  assertEquals(canonicalMailPhone("+1 (555) 123-4567"), "15551234567");
  assertEquals(canonicalMailPhone("abc+123"), "123");
});
