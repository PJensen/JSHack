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

function addRatatoskr(world, x, y) {
  const id = world.create();
  world.add(id, NamedIdentity, { name: "Ratatoskr", identity: "ratatoskr" });
  world.add(id, Position, { x, y });
  return id;
}

Deno.test("overworldAmbientSystem plays Ratatoskr squirrel ambience nearby with 320 turn cooldown", () => {
  const world = new World({ seed: 0x5151 });
  const audio = [];
  addDepth(world, 0);
  addPlayer(world, 0, 0);
  const ratatoskr = addRatatoskr(world, 7, 0);
  world.on("audio:play", (ev) => audio.push(ev));

  world.step = 0;
  overworldAmbientSystem(world);
  assertEquals(audio.length, 1);
  assertEquals(audio[0].key, "ambient:squirrel");
  assertEquals(audio[0].sourceId, ratatoskr);
  assertEquals(audio[0].at, { x: 7, y: 0 });

  world.step = 300;
  overworldAmbientSystem(world);
  assertEquals(audio.length, 1, "Ratatoskr ambience should still be on cooldown after 300 turns");

  world.step = 320;
  overworldAmbientSystem(world);
  assertEquals(audio.length, 2, "Ratatoskr ambience should return after the authored cooldown");
});

Deno.test("overworldAmbientSystem does not play Ratatoskr ambience outside nearby range", () => {
  const world = new World({ seed: 0x5152 });
  const audio = [];
  addDepth(world, 0);
  addPlayer(world, 0, 0);
  addRatatoskr(world, 8, 0);
  world.on("audio:play", (ev) => audio.push(ev));

  overworldAmbientSystem(world);
  assertEquals(audio.length, 0);
});
