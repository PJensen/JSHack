import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { shouldConsumeWorldTap } from "../src/main/input/worldTapGate.js";
import { Position } from "../src/rules/components/Position.js";
import { Settings } from "../src/rules/components/Settings.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { Interactable } from "../src/rules/components/Interactable.js";

Deno.test("worldTapGate: true when tap has pickup candidate", () => {
  const world = new World({ seed: 201 });
  const actorId = world.create();
  world.add(actorId, Position, { x: 5, y: 5 });
  world.add(actorId, Settings, { pickupRange: 1 });

  const itemId = world.create();
  world.add(itemId, Position, { x: 6, y: 5 });
  world.add(itemId, ItemInfo, { type: "scroll", count: 1 });

  const actor = { id: actorId, pos: { x: 5, y: 5 } };
  assertEquals(shouldConsumeWorldTap(world, actor, 6, 5), true);
});

Deno.test("worldTapGate: true when tap has adjacent interactable candidate", () => {
  const world = new World({ seed: 202 });
  const actorId = world.create();
  world.add(actorId, Position, { x: 10, y: 10 });
  world.add(actorId, Settings, { pickupRange: 1 });

  const chestId = world.create();
  world.add(chestId, Position, { x: 11, y: 10 });
  world.add(chestId, Interactable, { action: "openChest", params: {} });

  const actor = { id: actorId, pos: { x: 10, y: 10 } };
  assertEquals(shouldConsumeWorldTap(world, actor, 11, 10), true);
});

Deno.test("worldTapGate: false when no pickup or interact candidate is in context", () => {
  const world = new World({ seed: 203 });
  const actorId = world.create();
  world.add(actorId, Position, { x: 1, y: 1 });
  world.add(actorId, Settings, { pickupRange: 1 });

  const actor = { id: actorId, pos: { x: 1, y: 1 } };
  assertEquals(shouldConsumeWorldTap(world, actor, 20, 20), false);
});
