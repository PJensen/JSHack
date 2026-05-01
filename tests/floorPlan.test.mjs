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
import { dungeonConfig } from '../src/rules/environment/dungeon/dungeonConfig.js';

function extentChunkCount(plan) {
  return (plan.extent.maxCX - plan.extent.minCX + 1)
    * (plan.extent.maxCY - plan.extent.minCY + 1);
}

Deno.test("floor plan is deterministic", () => {
  const a = generateFloorPlan(42, 1);
  const b = generateFloorPlan(42, 1);
  assert(a.seed === b.seed, 'same seed');
  assert(a.downStairs.length === b.downStairs.length, 'same down stair count');
  assert(a.upStairs.length === b.upStairs.length, 'same up stair count');
  assert(a.theme === b.theme, 'same theme');
  assert(a.difficultyMult === b.difficultyMult, 'same difficulty');
});

Deno.test("floor 0 is the overworld plan", () => {
  const plan = generateFloorPlan(42, 0);
  assert(plan.theme === 'overworld', 'depth 0 uses overworld theme');
  assert(plan.downStairs.length >= 1, 'overworld has at least one down stair');
  assert(plan.upStairs.length === 0, 'overworld has no up stairs');
});

Deno.test("floor 1+ has both down and up stairs", () => {
  const p1 = generateFloorPlan(42, 1);
  const plan = generateFloorPlan(42, 2);
  assert(p1.downStairs.length >= 1, 'floor 1 has down stairs');
  assert(p1.upStairs.length >= 1, 'floor 1 has up stairs');
  assert(p1.disconnectedPocket, 'floor 1 reserves a disconnected pocket chunk');
  assert(!(p1.disconnectedPocket.chunkX === 0 && p1.disconnectedPocket.chunkY === 0), 'pocket chunk is not the origin chunk');
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

Deno.test("dungeonScale changes the raw floor footprint", () => {
  const previous = dungeonConfig.dungeonScale;
  try {
    dungeonConfig.dungeonScale = 0.1;
    const tiny = generateFloorPlan(42, 4);

    dungeonConfig.dungeonScale = 0.3;
    const compact = generateFloorPlan(42, 4);

    dungeonConfig.dungeonScale = 1.0;
    const standard = generateFloorPlan(42, 4);

    dungeonConfig.dungeonScale = 2.0;
    const huge = generateFloorPlan(42, 4);

    assert(extentChunkCount(tiny) <= extentChunkCount(compact), 'tiny footprint should not exceed compact');
    assert(extentChunkCount(compact) <= extentChunkCount(standard), 'compact footprint should not exceed standard');
    assert(extentChunkCount(compact) < extentChunkCount(standard), 'standard footprint should exceed compact');
    assert(extentChunkCount(standard) < extentChunkCount(huge), 'huge footprint should exceed standard');
  } finally {
    dungeonConfig.dungeonScale = previous;
  }
});

Deno.test("floor profile respects configured room sparsity", () => {
  const previousScale = dungeonConfig.dungeonScale;
  const previousSparsity = dungeonConfig.roomSparsity;
  try {
    dungeonConfig.dungeonScale = 0.3;
    dungeonConfig.roomSparsity = 0.35;

    const early = generateFloorPlan(42, 1);
    const late = generateFloorPlan(42, 12);

    // Floor 1 has higher sparsity (sparser) - 0.35 * 2.0 = 0.70
    const expectedFloor1Sparsity = 0.35 * 2.0;
    assert(early.profile.roomSparsity > 0.35, `floor 1 should be sparser (higher sparsity); got ${early.profile.roomSparsity}`);
    assert(Math.abs(early.profile.roomSparsity - expectedFloor1Sparsity) < 0.001, `floor 1 sparsity should be ~${expectedFloor1Sparsity}; got ${early.profile.roomSparsity}`);
    assert(late.profile.roomSparsity === 0.35, `deeper floors should preserve configured room sparsity; got ${late.profile.roomSparsity}`);
    assert(extentChunkCount(early) < extentChunkCount(late), 'later floors should span a larger footprint');
  } finally {
    dungeonConfig.dungeonScale = previousScale;
    dungeonConfig.roomSparsity = previousSparsity;
  }
});

Deno.test("default floor footprint growth stays sublinear at compact scale", () => {
  const previousScale = dungeonConfig.dungeonScale;
  try {
    dungeonConfig.dungeonScale = 0.3;

    const depth4 = generateFloorPlan(42, 4);
    const depth10 = generateFloorPlan(42, 10);
    const depth20 = generateFloorPlan(42, 20);

    assert(extentChunkCount(depth4) < extentChunkCount(depth10), "mid-depth floors should still grow");
    assert(extentChunkCount(depth10) < extentChunkCount(depth20), "late floors should still grow");
    assert(
      extentChunkCount(depth20) < extentChunkCount(depth10) * 2,
      "compact-scale footprint should not balloon near-linearly by late depths",
    );
  } finally {
    dungeonConfig.dungeonScale = previousScale;
  }
});

Deno.test("compact scale keeps floor 2 footprint tight", () => {
  const previousScale = dungeonConfig.dungeonScale;
  try {
    dungeonConfig.dungeonScale = 0.3;

    const floor1 = generateFloorPlan(42, 1);
    const floor2 = generateFloorPlan(42, 2);
    const floor3 = generateFloorPlan(42, 3);

    assert(
      extentChunkCount(floor2) <= 9,
      "floor 2 should remain compact at the default dungeon scale",
    );
    assert(
      extentChunkCount(floor1) <= extentChunkCount(floor2),
      "floor 2 should not shrink below floor 1",
    );
    assert(
      extentChunkCount(floor2) <= extentChunkCount(floor3),
      "floor 3 should be at least as large as floor 2",
    );
  } finally {
    dungeonConfig.dungeonScale = previousScale;
  }
});
