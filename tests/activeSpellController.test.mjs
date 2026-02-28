import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createActiveSpellController } from "../src/main/spells/activeSpellController.js";
import { Player } from "../src/rules/components/Player.js";
import { Brain } from "../src/rules/components/Brain.js";
import { Position } from "../src/rules/components/Position.js";

function makeWorldWithPlayer(learnedSpellIds) {
  const world = new World({ seed: 123 });
  const playerId = world.create();
  world.add(playerId, Player);
  world.add(playerId, Position, { x: 0, y: 0 });
  world.add(playerId, Brain, { learnedSpellIds: learnedSpellIds.slice() });
  return { world, playerId };
}

Deno.test("activeSpellController: unknown selected spell falls back to first known spell", () => {
  const { world } = makeWorldWithPlayer(["lightning", "meteor"]);
  const ctrl = createActiveSpellController(world);

  ctrl.setActiveSpell("not_a_real_spell");

  assertEquals(ctrl.getActiveSpellId(), "lightning");
});

Deno.test("activeSpellController: ensureActiveSpell clears stale active spell after spell loss", () => {
  const { world, playerId } = makeWorldWithPlayer(["lightning"]);
  const ctrl = createActiveSpellController(world);

  ctrl.setActiveSpell("lightning");
  const brain = world.get(playerId, Brain);
  brain.learnedSpellIds = [];
  world.set(playerId, Brain, brain);

  assertEquals(ctrl.ensureActiveSpell(), null);
  assertEquals(ctrl.getActiveSpellId(), null);
});
