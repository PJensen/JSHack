import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { Faction } from '../src/rules/components/Faction.js';
import { runSpellScript } from '../src/rules/scripts/spells.js';
import { loadChunk, clearAll } from '../src/rules/environment/dungeon/tileMap.js';
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL } from '../src/rules/environment/dungeon/constants.js';

const SPELL = { id: 'blastwave', name: 'Blast Wave', manaCost: 7, script: 'blastwave' };

/** Load a floor-filled chunk so isWalkable returns true for all positions in it. */
function loadFloorChunk(cx = 0, cy = 0) {
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  return { tiles, cx, cy };
}

function makeEntity(world, x, y, hp, faction) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Vitality, { maxHp: hp, hp });
  if (faction) world.add(id, Faction, { key: faction });
  return id;
}

Deno.test("blastwave: dist-1 pushed 2 tiles, dist-2 pushed 1 tile", () => {
  clearAll();
  const { tiles, cx, cy } = loadFloorChunk();
  loadChunk(cx, cy, tiles);

  const world = new World({ seed: 1 });
  const caster = makeEntity(world, 5, 5, 20, 'player');
  const a = makeEntity(world, 6, 5, 20, 'enemy');
  const b = makeEntity(world, 7, 5, 20, 'enemy');

  runSpellScript(world, caster, SPELL, {});

  const pa = world.get(a, Position);
  const pb = world.get(b, Position);
  assert(pa.x === 8 && pa.y === 5, `dist-1 pushed 2 tiles (got ${pa.x},${pa.y})`);
  assert(pb.x === 8 && pb.y === 5, `dist-2 pushed 1 tile (got ${pb.x},${pb.y})`);
});

Deno.test("blastwave: push direction = sign away from caster", () => {
  clearAll();
  const { tiles, cx, cy } = loadFloorChunk();
  loadChunk(cx, cy, tiles);

  const world = new World({ seed: 1 });
  const caster = makeEntity(world, 5, 5, 20, 'player');
  const left = makeEntity(world, 4, 5, 20, 'enemy');
  const diag = makeEntity(world, 4, 4, 20, 'enemy');

  runSpellScript(world, caster, SPELL, {});

  const pl = world.get(left, Position);
  assert(pl.x === 2 && pl.y === 5, `pushed left by 2 (got ${pl.x},${pl.y})`);
  const pd = world.get(diag, Position);
  assert(pd.x === 2 && pd.y === 2, `pushed diag (-1,-1) by 2 (got ${pd.x},${pd.y})`);
});

Deno.test("blastwave: closer = pushed farther", () => {
  clearAll();
  const { tiles, cx, cy } = loadFloorChunk();
  loadChunk(cx, cy, tiles);

  const world = new World({ seed: 1 });
  const caster = makeEntity(world, 5, 5, 20, 'player');
  const near = makeEntity(world, 5, 4, 20, 'enemy');
  const far = makeEntity(world, 5, 3, 20, 'enemy');

  runSpellScript(world, caster, SPELL, {});

  const pn = world.get(near, Position);
  assert(pn.y === 2, `dist-1 pushed 2 (got y=${pn.y})`);
  const pf = world.get(far, Position);
  assert(pf.y === 2, `dist-2 pushed 1 (got y=${pf.y})`);
});

Deno.test("blastwave: cannot push through walls", () => {
  clearAll();
  // Load chunk with a wall at (7,5), floors everywhere else
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  tiles[5 * CHUNK_SIZE + 7] = TILE_WALL; // (7,5) is wall
  loadChunk(0, 0, tiles);

  const world = new World({ seed: 1 });
  const caster = makeEntity(world, 5, 5, 20, 'player');
  const target = makeEntity(world, 6, 5, 20, 'enemy');

  runSpellScript(world, caster, SPELL, {});

  const pt = world.get(target, Position);
  assert(pt.x === 6 && pt.y === 5, `blocked by wall, stays at (6,5) (got ${pt.x},${pt.y})`);
});

Deno.test("blastwave: damage applied, attenuated by distance", () => {
  clearAll();
  const world = new World({ seed: 1 });
  const caster = makeEntity(world, 5, 5, 20, 'player');
  const near = makeEntity(world, 6, 5, 20, 'enemy');
  const far = makeEntity(world, 7, 5, 20, 'enemy');

  runSpellScript(world, caster, SPELL, {});

  const vn = world.get(near, Vitality);
  const vf = world.get(far, Vitality);
  assert(vn.hp < 20, `near target took damage (hp=${vn.hp})`);
  assert(vf.hp < 20, `far target took damage (hp=${vf.hp})`);
  assert(vn.hp <= vf.hp, `near took more damage than far (${vn.hp} <= ${vf.hp})`);
});

Deno.test("blastwave: caster not affected", () => {
  clearAll();
  const world = new World({ seed: 1 });
  const caster = makeEntity(world, 5, 5, 20, 'player');
  makeEntity(world, 6, 5, 20, 'enemy');

  runSpellScript(world, caster, SPELL, {});

  const vc = world.get(caster, Vitality);
  assert(vc.hp === 20, `caster undamaged (hp=${vc.hp})`);
  const pc = world.get(caster, Position);
  assert(pc.x === 5 && pc.y === 5, `caster position unchanged (${pc.x},${pc.y})`);
});

Deno.test("blastwave: spell:blastwave event emitted", () => {
  clearAll();
  const world = new World({ seed: 1 });
  const events = [];
  world.on('spell:blastwave', (d) => events.push(d));
  const caster = makeEntity(world, 5, 5, 20, 'player');
  makeEntity(world, 6, 5, 20, 'enemy');

  runSpellScript(world, caster, SPELL, {});

  assert(events.length >= 1, 'spell:blastwave emitted');
});

Deno.test("blastwave: kill → died emitted", () => {
  clearAll();
  const world = new World({ seed: 1 });
  const events = [];
  world.on('died', (d) => events.push(d));
  const caster = makeEntity(world, 5, 5, 20, 'player');
  const weak = makeEntity(world, 6, 5, 1, 'enemy');

  runSpellScript(world, caster, SPELL, {});

  assert(events.some(e => e.id === weak), 'died emitted for killed target');
});
