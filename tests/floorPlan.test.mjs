import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { createFrom } from '../src/lib/ecs-js/archetype.js';
import { generateFloorPlan, stairWorldPos } from '../src/rules/environment/dungeon/floorPlan.js';
import { StairDown, StairUp } from '../src/rules/archetypes/Stairs.js';
import { Position } from '../src/rules/components/Position.js';
import { Terrain } from '../src/rules/components/Terrain.js';
import { Interactable } from '../src/rules/components/Interactable.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { CHUNK_SIZE } from '../src/rules/environment/dungeon/constants.js';

Deno.test("floor plan is deterministic", () => {
  const a = generateFloorPlan(42, 1);
  const b = generateFloorPlan(42, 1);
  assert(a.seed === b.seed, 'same seed');
  assert(a.downStairs.length === b.downStairs.length, 'same down stair count');
  assert(a.upStairs.length === b.upStairs.length, 'same up stair count');
  assert(a.theme === b.theme, 'same theme');
  assert(a.difficultyMult === b.difficultyMult, 'same difficulty');
});

Deno.test("floor 1 has down stairs but no up stairs", () => {
  const plan = generateFloorPlan(42, 1);
  assert(plan.downStairs.length >= 1, 'has at least 1 down stair');
  assert(plan.upStairs.length === 0, 'floor 1 has no up stairs');
});

Deno.test("floor 2+ has both down and up stairs", () => {
  const plan = generateFloorPlan(42, 2);
  assert(plan.downStairs.length >= 1, 'has down stairs');
  assert(plan.upStairs.length >= 1, 'has up stairs');
});

Deno.test("difficulty increases with depth", () => {
  const p1 = generateFloorPlan(42, 1);
  const p5 = generateFloorPlan(42, 5);
  const p10 = generateFloorPlan(42, 10);
  assert(p1.difficultyMult < p5.difficultyMult, 'floor 5 harder than floor 1');
  assert(p5.difficultyMult < p10.difficultyMult, 'floor 10 harder than floor 5');
});

Deno.test("stair placements have valid chunk-local coordinates", () => {
  for (const depth of [1, 5, 10]) {
    const plan = generateFloorPlan(42, depth);
    for (const stair of [...plan.downStairs, ...plan.upStairs]) {
      assert(stair.localX >= 4 && stair.localX <= CHUNK_SIZE - 5,
        `stair localX in range: ${stair.localX}`);
      assert(stair.localY >= 4 && stair.localY <= CHUNK_SIZE - 5,
        `stair localY in range: ${stair.localY}`);
    }
  }
});

Deno.test("stairWorldPos computes correct world coordinates", () => {
  const stair = { chunkX: 2, chunkY: -1, localX: 10, localY: 15 };
  const pos = stairWorldPos(stair);
  assert(pos.x === 2 * CHUNK_SIZE + 10, `x = ${pos.x}`);
  assert(pos.y === -1 * CHUNK_SIZE + 15, `y = ${pos.y}`);
});

Deno.test("StairDown archetype creates valid entity", () => {
  const world = new World({ seed: 42 });
  const id = createFrom(world, StairDown, { x: 5, y: 10 });

  const pos = world.get(id, Position);
  assert(pos.x === 5 && pos.y === 10, 'correct position');

  const ter = world.get(id, Terrain);
  assert(ter.walkable === true, 'stair is walkable');
  assert(ter.opaque === false, 'stair is transparent');

  const inter = world.get(id, Interactable);
  assert(inter.action === 'descendStair', 'correct action');

  const name = world.get(id, NamedIdentity);
  assert(name.identity === 'stair_down', 'correct identity');
});

Deno.test("StairUp archetype creates valid entity", () => {
  const world = new World({ seed: 42 });
  const id = createFrom(world, StairUp, { x: 3, y: 7 });

  const inter = world.get(id, Interactable);
  assert(inter.action === 'ascendStair', 'correct action');

  const name = world.get(id, NamedIdentity);
  assert(name.identity === 'stair_up', 'correct identity');
});

Deno.test("different depths produce different floor plans", () => {
  const p1 = generateFloorPlan(42, 1);
  const p2 = generateFloorPlan(42, 2);
  assert(p1.seed !== p2.seed, 'different seeds');
});
