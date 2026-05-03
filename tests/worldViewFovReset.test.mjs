import "./helpers/installContentMonsters.mjs";
import { assert } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { buildWorldView } from "../src/bridge/schema/worldView.js";
import { initDungeon } from "../src/rules/environment/dungeon/index.js";
import { clearAll } from "../src/rules/environment/dungeon/tileMap.js";
import { clearExplored } from "../src/rules/environment/dungeon/exploredMap.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";

function posOfIdentity(world, identity) {
  for (const [, ident, pos] of world.query(NamedIdentity, Position)) {
    if (ident.identity === identity) return { x: pos.x, y: pos.y };
  }
  throw new Error(`missing ${identity}`);
}

function makePlayer(world, pos) {
  const player = world.create();
  world.add(player, Player, {});
  world.add(player, NamedIdentity, { name: "Hero", identity: "player" });
  world.add(player, Position, { x: pos.x, y: pos.y });
  return player;
}

Deno.test("buildWorldView recomputes FOV after explored state is cleared on the same step", async () => {
  clearAll();
  clearExplored();

  const firstWorld = new World({ seed: 0xC0FFEE });
  const firstSpawn = await initDungeon(firstWorld, { startDepth: 1 });
  makePlayer(firstWorld, firstSpawn);
  buildWorldView(firstWorld);

  clearAll();
  clearExplored();

  const secondWorld = new World({ seed: 0xC0FFEE });
  const secondSpawn = await initDungeon(secondWorld, { startDepth: 0 });
  makePlayer(secondWorld, secondSpawn);

  const view = buildWorldView(secondWorld);

  assert(
    view.isVisible?.(secondSpawn.x, secondSpawn.y),
    "fresh view should recompute FOV even when the step matches a prior world",
  );

  clearAll();
  clearExplored();
});
