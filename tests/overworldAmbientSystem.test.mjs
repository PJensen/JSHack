import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { overworldAmbientSystem } from "../src/rules/systems/overworldAmbientSystem.js";

function addDepth(world, depth) {
  const id = world.create();
  world.add(id, DungeonState, { currentDepth: depth, profileType: depth === 0 ? "overworld" : "default" });
  return id;
}

function addPlayer(world, x, y) {
  const id = world.create();
  world.add(id, Player, {});
  world.add(id, Position, { x, y });
  return id;
}

Deno.test("overworldAmbientSystem does not own Ratatoskr squirrel audio", () => {
  const world = new World({ seed: 0x5152 });
  const audio = [];
  addDepth(world, 0);
  addPlayer(world, 0, 0);

  const ratatoskr = world.create();
  world.add(ratatoskr, NamedIdentity, { name: "Ratatoskr", identity: "ratatoskr" });
  world.add(ratatoskr, Position, { x: 1, y: 0 });
  world.on("audio:play", (ev) => audio.push(ev));

  overworldAmbientSystem(world);
  assertEquals(audio.length, 0);
});
