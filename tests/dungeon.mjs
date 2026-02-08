import { World } from '../src/lib/ecs-js/index.js';
import { generateDungeon } from '../src/rules/environment/dungeonGenerator.js';
import { Position } from '../src/rules/components/Position.js';
import { Terrain } from '../src/rules/components/Terrain.js';
import { Collider } from '../src/rules/components/Collider.js';

function assert(c, m) { if (!c) throw new Error('Assertion failed: ' + m); }

function key(x, y) { return `${x},${y}`; }

async function run() {
  const world = new World({ seed: 42 });
  const meta = generateDungeon(world, { width: 9, height: 9 });

  // 1. Metadata has rooms
  assert(Array.isArray(meta.rooms) && meta.rooms.length >= 2, 'at least 2 rooms');
  for (const room of meta.rooms) {
    assert(Number.isInteger(room.cx) && Number.isInteger(room.cy), 'room center is integer');
    assert(room.w > 0 && room.h > 0, 'room has positive dimensions');
  }

  // 2. Metadata has spawn points on walkable floor
  assert(Array.isArray(meta.spawnPoints) && meta.spawnPoints.length >= 1, 'has spawn points');

  // 3. Build tile maps from entities
  const floors = new Set();
  const walls = new Set();
  for (const [id, pos] of world.query(Position)) {
    const ter = world.get(id, Terrain);
    if (!ter) continue;
    assert(Number.isInteger(pos.x) && Number.isInteger(pos.y), `tile position integer: ${pos.x},${pos.y}`);
    if (ter.walkable) floors.add(key(pos.x, pos.y));
    if (!ter.walkable) walls.add(key(pos.x, pos.y));
  }

  // 4. Floor tiles exist inside rooms
  const mainRoom = meta.rooms[0];
  assert(floors.has(key(mainRoom.cx, mainRoom.cy)), 'main room center is floor');

  // 5. Wall tiles exist (Terrain.walkable=false, opaque=true)
  let wallCount = 0;
  for (const [id, pos] of world.query(Position)) {
    const ter = world.get(id, Terrain);
    if (ter && !ter.walkable) {
      wallCount++;
      assert(ter.opaque === true, `wall at ${pos.x},${pos.y} is opaque`);
    }
  }
  assert(wallCount > 0, 'has wall tiles');

  // 6. Spawn points are on floor tiles
  for (const sp of meta.spawnPoints) {
    assert(floors.has(key(sp.x, sp.y)), `spawn point ${sp.x},${sp.y} is on floor`);
  }

  // 7. Rooms are connected: flood fill from main room center should reach all room centers
  const visited = new Set();
  const queue = [key(mainRoom.cx, mainRoom.cy)];
  visited.add(queue[0]);
  while (queue.length > 0) {
    const cur = queue.shift();
    const [cx, cy] = cur.split(',').map(Number);
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nk = key(cx + dx, cy + dy);
      if (!visited.has(nk) && floors.has(nk)) {
        visited.add(nk);
        queue.push(nk);
      }
    }
  }
  for (const room of meta.rooms) {
    assert(visited.has(key(room.cx, room.cy)), `room ${room.key} center reachable from main`);
  }

  // 8. Doors metadata
  assert(Array.isArray(meta.doors), 'has doors array');

  console.log(`Dungeon tests PASS (${meta.rooms.length} rooms, ${floors.size} floors, ${wallCount} walls)`);
}
run().catch(e => { console.error(e); process.exitCode = 1; });
