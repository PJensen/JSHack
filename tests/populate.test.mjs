import { assert } from "jsr:@std/assert";
import { createRng } from '../src/lib/ecs-js/rng.js';
import { World } from '../src/lib/ecs-js/index.js';
import { generateChunk } from '../src/rules/environment/dungeon/chunk.js';
import { populateChunk, materializeSpawn } from '../src/rules/environment/dungeon/populate.js';
import { pickMonster, pickItem, pickSpawner } from '../src/rules/environment/dungeon/tables.js';
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL, TILE_DOOR, TILE_STAIR_DOWN, TILE_STAIR_UP } from '../src/rules/environment/dungeon/constants.js';
import { Position } from '../src/rules/components/Position.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { MonsterSpawner } from '../src/rules/components/MonsterSpawner.js';
import { Player } from '../src/rules/components/Player.js';
import { buildWorldView } from '../src/bridge/schema/worldView.js';
import { buildPalette } from '../src/display/palette/index.js';
import { clearAll as clearTileMap } from '../src/rules/environment/dungeon/tileMap.js';
import { clearExplored } from '../src/rules/environment/dungeon/exploredMap.js';

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

Deno.test("pickSpawner uses rat/spider pool on shallow depth", () => {
  const rngFirst = {
    next: () => 0,
    int: (min) => min,
    choice: (arr) => arr[0],
    float: (min) => min,
  };
  const first = pickSpawner(rngFirst, 1);
  assert(first.monsterType.identity === 'rat', `expected rat, got ${first.monsterType.identity}`);

  const rngSecond = {
    next: () => 0,
    int: (min, max) => (typeof max === 'number' ? max : min),
    choice: (arr) => arr[arr.length - 1],
    float: (min, max) => (typeof max === 'number' ? max : min),
  };
  const second = pickSpawner(rngSecond, 1);
  assert(second.monsterType.identity === 'spider', `expected spider, got ${second.monsterType.identity}`);
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

Deno.test("populateChunk can generate a shallow spawner", () => {
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_WALL);
  for (let y = 2; y < 12; y++) {
    for (let x = 2; x < 12; x++) {
      tiles[y * CHUNK_SIZE + x] = TILE_FLOOR;
    }
  }

  const chunk = {
    chunkX: 1,
    chunkY: 1,
    tiles,
    rooms: [{ x: CHUNK_SIZE + 2, y: CHUNK_SIZE + 2, w: 10, h: 10 }],
    doors: [],
  };
  const floorPlan = { depth: 1, difficultyMult: 1.0 };
  const rng = {
    next: () => 0, // Always pass chance gates.
    int: (min) => min,
    choice: (arr) => arr[0],
    float: (min) => min,
  };

  const spawns = populateChunk(chunk, floorPlan, rng);
  const spawners = spawns.filter((s) => s.kind === 'spawner');
  assert(spawners.length > 0, 'expected at least one spawner');
  assert(spawners[0].params?.monsterType?.identity === 'rat', 'expected shallow spawner monster to be rat');
});

Deno.test("populateChunk shallow spawners can be both rat and spider", () => {
  const seen = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    const chunk = generateChunk(seed, 1, 0, 0);
    const rng = createRng(seed * 1337);
    const spawns = populateChunk(chunk, { depth: 1, difficultyMult: 1.0 }, rng);
    for (const sp of spawns) {
      if (sp.kind !== 'spawner') continue;
      const identity = sp.params?.monsterType?.identity;
      if (identity === 'rat' || identity === 'spider') seen.add(identity);
    }
    if (seen.size === 2) break;
  }

  assert(seen.has('rat'), 'expected to observe a rat spawner');
  assert(seen.has('spider'), 'expected to observe a spider spawner');
});

Deno.test("spawner wiring: kind -> identity -> worldView -> palette", () => {
  // Keep singleton maps from prior tests from affecting visibility assertions.
  clearTileMap();
  clearExplored();

  const world = new World({ seed: 42 });

  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Position, { x: 0, y: 0 });

  const spawnerId = materializeSpawn(world, {
    x: 1,
    y: 0,
    kind: 'spawner',
    params: {
      monsterType: {
        name: 'Rat',
        identity: 'rat',
        maxHp: 5,
        faction: 'enemy',
        attackDerived: 0,
        defenseDerived: 0,
        naturalDamageDice: '1d3',
        sizeClass: 'S',
        massKg: 2,
        resistances: { kinetic: { DR: 0 } },
        speed: 1,
      },
      packSize: 3,
      depth: 1,
    },
  });

  assert(spawnerId != null, 'spawner entity should be created');
  const ni = world.get(spawnerId, NamedIdentity);
  assert(ni?.identity === 'spawner', `expected identity 'spawner', got ${ni?.identity}`);

  const spawner = world.get(spawnerId, MonsterSpawner);
  assert(spawner && spawner.spawnParams?.identity === 'rat', 'spawner should keep monster spawn identity');

  const view = buildWorldView(world);
  const viewRec = view.entities.find((e) => e.id === spawnerId);
  assert(viewRec?.kind === 'spawner', `expected worldView kind 'spawner', got ${viewRec?.kind}`);

  const palette = buildPalette();
  const spawnerLook = palette.spawner;
  assert(
    spawnerLook && typeof spawnerLook.glyph === 'string' && spawnerLook.glyph.length > 0,
    'palette should include a spawner glyph'
  );
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

function countRoomEntrances(room, chunk) {
  const rx = room.x - chunk.chunkX * CHUNK_SIZE;
  const ry = room.y - chunk.chunkY * CHUNK_SIZE;
  const rw = room.w;
  const rh = room.h;
  const tiles = chunk.tiles;
  function getTile(x, y) {
    if (x < 0 || y < 0 || x >= CHUNK_SIZE || y >= CHUNK_SIZE) return -1;
    return tiles[y * CHUNK_SIZE + x];
  }
  function isPassable(tile) {
    return tile === TILE_FLOOR || tile === TILE_DOOR || tile === TILE_STAIR_DOWN || tile === TILE_STAIR_UP;
  }
  let entrances = 0;
  let prev = false;
  for (let y = ry; y < ry + rh; y++) {
    const open = isPassable(getTile(rx - 1, y));
    if (open && !prev) entrances++;
    prev = open;
  }
  prev = false;
  for (let y = ry; y < ry + rh; y++) {
    const open = isPassable(getTile(rx + rw, y));
    if (open && !prev) entrances++;
    prev = open;
  }
  prev = false;
  for (let x = rx; x < rx + rw; x++) {
    const open = isPassable(getTile(x, ry - 1));
    if (open && !prev) entrances++;
    prev = open;
  }
  prev = false;
  for (let x = rx; x < rx + rw; x++) {
    const open = isPassable(getTile(x, ry + rh));
    if (open && !prev) entrances++;
    prev = open;
  }
  return entrances;
}

Deno.test("shopkeeper spawns only in dead-end rooms with one perimeter entrance", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const chunk = generateChunk(seed, 1, 0, 0);
    const rng = createRng(seed * 1337);
    const floorPlan = { depth: 1, difficultyMult: 1.0 };
    const spawns = populateChunk(chunk, floorPlan, rng);

    const shopkeepers = spawns.filter(s => s.kind === 'shopkeeper');
    for (const sk of shopkeepers) {
      const room = sk.params?.room;
      assert(room, "shopkeeper spawn should include room metadata");
      const entrances = countRoomEntrances(room, chunk);
      assert(entrances === 1, `shop room must have exactly one perimeter entrance, got ${entrances}`);
    }
  }
});

Deno.test("origin chunk spawn room is never selected as a shop room", () => {
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_WALL);
  // Room 0 (spawn room)
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) tiles[y * CHUNK_SIZE + x] = TILE_FLOOR;
  // Room 1 (eligible shop room)
  for (let y = 20; y < 26; y++) for (let x = 20; x < 26; x++) tiles[y * CHUNK_SIZE + x] = TILE_FLOOR;
  // Exactly one entrance for each room
  tiles[2 * CHUNK_SIZE + 6] = TILE_FLOOR;   // east opening from room 0
  tiles[22 * CHUNK_SIZE + 19] = TILE_FLOOR; // west opening for room 1

  const chunk = {
    chunkX: 0,
    chunkY: 0,
    tiles,
    rooms: [
      // This mirrors the starting room convention (rooms[0] in origin chunk)
      { x: 0, y: 0, w: 6, h: 6 },
      { x: 20, y: 20, w: 6, h: 6 },
    ],
    doors: [],
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
