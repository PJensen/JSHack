import { assert } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { petBehaviorSystem } from "../src/rules/systems/petBehaviorSystem.js";
import { Player } from "../src/rules/components/Player.js";
import { Pet } from "../src/rules/components/Pet.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { MoveIntent } from "../src/rules/components/Intents/MoveIntent.js";
import { PetState } from "../src/rules/components/PetState.js";

Deno.test("pet behavior ignores dead pet corpses", () => {
  const world = new World({ seed: 42 });

  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Position, { x: 10, y: 10 });

  const corpseId = world.create();
  world.add(corpseId, Pet);
  world.add(corpseId, Position, { x: 0, y: 0 });
  world.add(corpseId, Vitality, { hp: 0, maxHp: 5 });

  petBehaviorSystem(world);

  assert(!world.has(corpseId, MoveIntent), "dead pet corpse should not receive MoveIntent");
  assert(!world.has(corpseId, PetState), "dead pet corpse should not enter pet AI states");
  const pos = world.get(corpseId, Position);
  assert(pos && pos.x === 0 && pos.y === 0, "dead pet corpse should not move");
});
