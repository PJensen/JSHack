import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { buildWorldView } from "../src/bridge/schema/worldView.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";

Deno.test("buildWorldView projects proc-package state effects with metadata", () => {
  const world = new World({ seed: 0xC0FFEE });

  const player = world.create();
  world.add(player, Player, {});
  world.add(player, Position, { x: 1, y: 1 });

  const target = world.create();
  world.add(target, Position, { x: 2, y: 1 });
  world.add(target, NamedIdentity, { identity: "goblin", name: "Goblin" });
  world.add(target, ActiveEffects, {
    effects: [
      { key: "kinetic_battery", turnsLeft: 12, potency: 3, stacks: 3 },
      { key: "burning", turnsLeft: 2, potency: 1, stacks: 1 },
    ],
  });

  const view = buildWorldView(world);
  const rec = view.entities.find((e) => e.id === target);

  assert(rec, "expected target entity in world view");
  assert(Array.isArray(rec.procStates), "proc states should be projected");
  assertEquals(rec.procStates.length, 1);

  const proc = rec.procStates[0];
  assertEquals(proc.key, "kinetic_battery");
  assertEquals(proc.stacks, 3);
  assertEquals(proc.turnsLeft, 12);
  assertEquals(proc.potency, 3);
  assertEquals(proc.name, "Kinetic Battery");
  assert(typeof proc.description === "string" && proc.description.length > 0, "expected proc description");
});
