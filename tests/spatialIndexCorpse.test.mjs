import { assert } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { buildWorldView } from "../src/bridge/schema/worldView.js";
import { cleanupSystem } from "../src/rules/systems/cleanupSystem.js";
import { Player } from "../src/rules/components/Player.js";
import { Pet } from "../src/rules/components/Pet.js";
import { Owner } from "../src/rules/components/Owner.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";

Deno.test("pet corpse is visible in WorldView after cleanup tick", () => {
  const world = new World({ seed: 42 });

  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Position, { x: 0, y: 0 });
  world.add(playerId, NamedIdentity, { name: "Hero", identity: "hero" });

  const petId = world.create();
  world.add(petId, Pet);
  world.add(petId, Owner, { ownerId: playerId });
  world.add(petId, Position, { x: 1, y: 0 });
  world.add(petId, Vitality, { hp: 0, maxHp: 5 });
  world.add(petId, NamedIdentity, { name: "Kitty", identity: "kitty" });

  // Seed the spatial index before death processing. Without backfill,
  // deferred corpse creation would not be indexed and thus not rendered.
  buildWorldView(world);

  world.setScheduler((w) => {
    cleanupSystem(w);
  });
  world.tick(1);

  const view = buildWorldView(world);
  const corpse = view.entities.find((e) => e.kind === "corpse_kitty");
  assert(corpse, "expected corpse_kitty to appear in WorldView entities");
});
