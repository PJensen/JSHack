import { assert } from "jsr:@std/assert";
import { createRng } from '../src/lib/ecs-js/rng.js';
import { World } from '../src/lib/ecs-js/index.js';
import { generateChunk } from '../src/rules/environment/dungeon/chunk.js';
import { populateChunk, materializeSpawn } from '../src/rules/environment/dungeon/populate.js';
import { pickMonster, pickItem } from '../src/rules/environment/dungeon/tables.js';
import { Position } from '../src/rules/components/Position.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';

Deno.test("pickMonster returns valid params", () => {
  const rng = createRng(42);
  for (const depth of [1, 5, 10, 20]) {
    const m = pickMonster(rng, depth);
    assert(typeof m.name === 'string' && m.name.length > 0, 'has name');
    assert(typeof m.identity === 'string', 'has identity');
    assert(m.maxHp > 0, 'has positive HP');
    assert(m.faction === 'enemy', 'is enemy');
  }
});

Deno.test("pickMonster scales HP with depth", () => {
  const rng1 = createRng(42);
  const rng2 = createRng(42);
  const m1 = pickMonster(rng1, 1);
  // Use same seed to get same monster type
  const m20 = pickMonster(rng2, 20);
  // Same monster template but different HP due to depth
  assert(m20.maxHp > m1.maxHp, `deeper monsters have more HP: ${m1.maxHp} vs ${m20.maxHp}`);
});

Deno.test("pickItem returns valid kinds", () => {
  const rng = createRng(42);
  const validKinds = new Set(['gold', 'potion', 'equipment', 'arrows', 'fire_arrows', 'scroll', 'book']);
  for (let i = 0; i < 20; i++) {
    const item = pickItem(rng, 5);
    assert(validKinds.has(item.kind), `valid kind: ${item.kind}`);
  }
});

Deno.test("populateChunk generates spawns in rooms", () => {
  const chunk = generateChunk(42, 1, 0, 0);
  const rng = createRng(123);
  const floorPlan = { depth: 1, difficultyMult: 1.0 };
  const spawns = populateChunk(chunk, floorPlan, rng);

  assert(Array.isArray(spawns), 'returns array');
  // With default density, a 32x32 chunk should generate some spawns
  assert(spawns.length > 0, `generated ${spawns.length} spawns`);

  for (const sp of spawns) {
    assert(Number.isInteger(sp.x) && Number.isInteger(sp.y), `spawn at integers (${sp.x},${sp.y})`);
    assert(typeof sp.kind === 'string', 'has kind');
  }
});

Deno.test("populateChunk scales monster count with depth", () => {
  const chunk = generateChunk(42, 1, 0, 0);
  const rng1 = createRng(123);
  const rng5 = createRng(123);
  const spawns1 = populateChunk(chunk, { depth: 1, difficultyMult: 1.0 }, rng1);
  const spawns5 = populateChunk(chunk, { depth: 5, difficultyMult: 1.6 }, rng5);

  const monsters1 = spawns1.filter(s => s.kind === 'monster').length;
  const monsters5 = spawns5.filter(s => s.kind === 'monster').length;
  // Higher difficulty should yield more monsters (or equal due to rng variance)
  assert(monsters5 >= monsters1, `depth 5 (${monsters5}) >= depth 1 (${monsters1})`);
});

Deno.test("materializeSpawn creates monster entity", () => {
  const world = new World({ seed: 42 });
  const id = materializeSpawn(world, {
    x: 5, y: 10, kind: 'monster',
    params: { name: 'Goblin', identity: 'monster', maxHp: 8, faction: 'enemy' },
  });
  assert(id != null, 'created entity');
  const pos = world.get(id, Position);
  assert(pos.x === 5 && pos.y === 10, 'correct position');
  const vit = world.get(id, Vitality);
  assert(vit && vit.hp > 0, 'has HP');
});

Deno.test("materializeSpawn creates gold entity", () => {
  const world = new World({ seed: 42 });
  const id = materializeSpawn(world, {
    x: 3, y: 7, kind: 'gold',
    params: { kind: 'gold', count: 25 },
  });
  assert(id != null, 'created entity');
  const pos = world.get(id, Position);
  assert(pos.x === 3 && pos.y === 7, 'correct position');
  const info = world.get(id, ItemInfo);
  assert(info.count === 25, `gold count: ${info.count}`);
});

Deno.test("materializeSpawn creates potion entity", () => {
  const world = new World({ seed: 42 });
  const id = materializeSpawn(world, {
    x: 1, y: 2, kind: 'potion',
    params: { kind: 'potion' },
  });
  assert(id != null, 'created entity');
  const pos = world.get(id, Position);
  assert(pos.x === 1 && pos.y === 2, 'correct position');
});

Deno.test("materializeSpawn creates equipment entity", () => {
  const world = new World({ seed: 42 });
  const id = materializeSpawn(world, {
    x: 4, y: 6, kind: 'equipment',
    params: { kind: 'equipment', equipId: 'sword_plain' },
  });
  assert(id != null, 'created entity');
  const pos = world.get(id, Position);
  assert(pos.x === 4 && pos.y === 6, 'correct position');
  const info = world.get(id, ItemInfo);
  assert(info.type === 'equip', 'is equipment');
});

function countRoomDoors(room, doors) {
  let count = 0;
  for (const d of doors) {
    const onVerticalWall =
      (d.x === room.x - 1 || d.x === room.x + room.w) &&
      d.y >= room.y &&
      d.y < room.y + room.h;
    const onHorizontalWall =
      (d.y === room.y - 1 || d.y === room.y + room.h) &&
      d.x >= room.x &&
      d.x < room.x + room.w;
    if (onVerticalWall || onHorizontalWall) count++;
  }
  return count;
}

Deno.test("shopkeeper spawns only in leaf rooms with exactly one door", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const chunk = generateChunk(seed, 1, 0, 0);
    const rng = createRng(seed * 1337);
    const floorPlan = { depth: 1, difficultyMult: 1.0 };
    const spawns = populateChunk(chunk, floorPlan, rng);

    const shopkeepers = spawns.filter(s => s.kind === 'shopkeeper');
    for (const sk of shopkeepers) {
      const room = sk.params?.room;
      assert(room, "shopkeeper spawn should include room metadata");
      const doors = countRoomDoors(room, chunk.doors || []);
      assert(doors === 1, `shop room must have exactly one door, got ${doors}`);
    }
  }
});

Deno.test("origin chunk spawn room is never selected as a shop room", () => {
  const chunk = {
    chunkX: 0,
    chunkY: 0,
    rooms: [
      // This mirrors the starting room convention (rooms[0] in origin chunk)
      { x: 0, y: 0, w: 6, h: 6 },
      { x: 20, y: 20, w: 6, h: 6 },
    ],
    doors: [
      { x: -1, y: 2 },  // one entrance for room 0
      { x: 19, y: 22 }, // one entrance for room 1
    ],
  };
  const floorPlan = { depth: 1, difficultyMult: 1.0 };
  const rng = {
    next: () => 0, // always pass chance gates
    int: (min) => min, // deterministic pick first eligible
    choice: (arr) => arr[0],
    float: (min) => min,
  };

  const spawns = populateChunk(chunk, floorPlan, rng);
  const shopkeeper = spawns.find((s) => s.kind === 'shopkeeper');
  assert(shopkeeper, 'expected a shopkeeper to spawn for this deterministic setup');
  const room = shopkeeper.params?.room;
  assert(room, 'shopkeeper must include room metadata');
  assert(
    !(room.x === chunk.rooms[0].x && room.y === chunk.rooms[0].y && room.w === chunk.rooms[0].w && room.h === chunk.rooms[0].h),
    'shopkeeper must not be placed in origin chunk spawn room',
  );
});
