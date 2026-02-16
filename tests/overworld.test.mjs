import { assert } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { initDungeon } from "../src/rules/environment/dungeon/index.js";
import { transitionToDepth } from "../src/rules/environment/dungeon/transition.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Position } from "../src/rules/components/Position.js";
import { Player } from "../src/rules/components/Player.js";
import { isWalkable, clearAll } from "../src/rules/environment/dungeon/tileMap.js";

function makePlayerAt(world, x, y) {
  const id = world.create();
  world.add(id, Player, {});
  world.add(id, Position, { x, y });
  return id;
}

Deno.test("initDungeon supports depth 0 overworld", () => {
  clearAll();
  const world = new World({ seed: 0xa77a77 });
  const spawn = initDungeon(world, { startDepth: 0 });

  assert(isWalkable(spawn.x, spawn.y), "overworld spawn tile is walkable");

  let depth = -1;
  for (const [, ds] of world.query(DungeonState)) {
    depth = ds.currentDepth;
    break;
  }
  assert(depth === 0, `expected currentDepth 0, got ${depth}`);
});

Deno.test("overworld contains a down stair entity", () => {
  clearAll();
  const world = new World({ seed: 0xC0FFEE });
  initDungeon(world, { startDepth: 0 });

  let found = false;
  for (const [, ni] of world.query(NamedIdentity)) {
    if (ni.identity === "stair_down") {
      found = true;
      break;
    }
  }
  assert(found, "expected at least one stair_down in overworld");
});

Deno.test("can transition depth 0 -> 1 -> 0", () => {
  clearAll();
  const world = new World({ seed: 42 });
  const spawn = initDungeon(world, { startDepth: 0 });
  makePlayerAt(world, spawn.x, spawn.y);

  transitionToDepth(world, 1, { x: 0, y: 0 }, { direction: "down" });
  let d1 = -1;
  for (const [, ds] of world.query(DungeonState)) { d1 = ds.currentDepth; break; }
  assert(d1 === 1, "expected depth 1 after descending");

  transitionToDepth(world, 0, { x: 0, y: 0 }, { direction: "up" });
  let d0 = -1;
  for (const [, ds] of world.query(DungeonState)) { d0 = ds.currentDepth; break; }
  assert(d0 === 0, "expected depth 0 after ascending");
});
