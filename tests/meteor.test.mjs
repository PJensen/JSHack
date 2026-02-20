import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { Faction } from '../src/rules/components/Faction.js';
import { Status } from '../src/rules/components/Status.js';
import { runSpellScript } from '../src/rules/scripts/spells.js';
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL } from '../src/rules/environment/dungeon/constants.js';
import { clearAll as clearTileMap, loadChunk } from '../src/rules/environment/dungeon/tileMap.js';

const SPELL = { id: 'meteor', name: 'Meteor', manaCost: 12, range: 12, script: 'meteor' };

function loadFlatFloor() {
  clearTileMap();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
}

function makeEntity(world, x, y, hp, faction) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Vitality, { maxHp: hp, hp });
  if (faction) world.add(id, Faction, { key: faction });
  return id;
}

Deno.test("meteor: AoE damage at target — full damage within radius 1", () => {
  loadFlatFloor();
  const world = new World({ seed: 1 });
  const caster = makeEntity(world, 0, 0, 20, 'player');
  const center = makeEntity(world, 10, 10, 50, 'enemy');
  const adj = makeEntity(world, 11, 10, 50, 'enemy');

  runSpellScript(world, caster, SPELL, { x: 10, y: 10 });

  const vc = world.get(center, Vitality);
  const va = world.get(adj, Vitality);
  assert(vc.hp < 50, `center took damage (hp=${vc.hp})`);
  assert(va.hp < 50, `adjacent took damage (hp=${va.hp})`);
  assert(vc.hp === va.hp, `same damage at dist 0 and dist 1 (${vc.hp} === ${va.hp})`);
});

Deno.test("meteor: half damage at radius 2", () => {
  loadFlatFloor();
  const world = new World({ seed: 1 });
  const caster = makeEntity(world, 0, 0, 20, 'player');
  const near = makeEntity(world, 10, 10, 50, 'enemy');
  const far = makeEntity(world, 12, 10, 50, 'enemy');

  runSpellScript(world, caster, SPELL, { x: 10, y: 10 });

  const vn = world.get(near, Vitality);
  const vf = world.get(far, Vitality);
  const nearDmg = 50 - vn.hp;
  const farDmg = 50 - vf.hp;
  assert(nearDmg > 0, `near took damage (${nearDmg})`);
  assert(farDmg > 0, `far took damage (${farDmg})`);
  assert(farDmg < nearDmg, `far took less damage than near (${farDmg} < ${nearDmg})`);
  assert(Math.abs(farDmg - Math.floor(nearDmg / 2)) <= 1, `far damage ~half of near (${farDmg} vs ${Math.floor(nearDmg / 2)})`);
});

Deno.test("meteor: no damage beyond radius 2", () => {
  loadFlatFloor();
  const world = new World({ seed: 1 });
  const caster = makeEntity(world, 0, 0, 20, 'player');
  const outside = makeEntity(world, 13, 10, 50, 'enemy');

  runSpellScript(world, caster, SPELL, { x: 10, y: 10 });

  const vo = world.get(outside, Vitality);
  assert(vo.hp === 50, `outside radius undamaged (hp=${vo.hp})`);
});

Deno.test("meteor: spell:meteor event emitted", () => {
  loadFlatFloor();
  const world = new World({ seed: 1 });
  const events = [];
  world.on('spell:meteor', (d) => events.push(d));
  const caster = makeEntity(world, 0, 0, 20, 'player');
  makeEntity(world, 10, 10, 50, 'enemy');

  runSpellScript(world, caster, SPELL, { x: 10, y: 10 });

  assert(events.length >= 1, 'spell:meteor emitted');
});

Deno.test("meteor: explicit target out of range fails", () => {
  loadFlatFloor();
  const world = new World({ seed: 2 });
  const failures = [];
  world.on('spell:meteor:failed', (e) => failures.push(e));
  const caster = makeEntity(world, 0, 0, 20, 'player');
  const target = makeEntity(world, 2, 2, 50, 'enemy');

  runSpellScript(world, caster, SPELL, { x: 20, y: 0 });

  const vit = world.get(target, Vitality);
  assertEquals(vit.hp, 50);
  assertEquals(failures.length, 1);
  assertEquals(failures[0].reason, 'out_of_range');
});

Deno.test("meteor: explicit target blocked by LOS fails", () => {
  clearTileMap();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
  tiles[0 * CHUNK_SIZE + 5] = TILE_WALL;
  loadChunk(0, 0, tiles);

  const world = new World({ seed: 3 });
  const failures = [];
  world.on('spell:meteor:failed', (e) => failures.push(e));
  const caster = makeEntity(world, 2, 0, 20, 'player');
  const target = makeEntity(world, 8, 0, 50, 'enemy');

  runSpellScript(world, caster, SPELL, { x: 8, y: 0 });

  const vit = world.get(target, Vitality);
  assertEquals(vit.hp, 50);
  assertEquals(failures.length, 1);
  assertEquals(failures[0].reason, 'blocked_los');
});

Deno.test("meteor: confused caster reroutes from caster LOS cone", () => {
  loadFlatFloor();
  const world = new World({ seed: 4 });
  const caster = makeEntity(world, 10, 10, 20, 'player');
  world.add(caster, Status, {
    statuses: [{ type: "confused", duration: 5, potency: 1, stacks: 1 }],
  });
  const nearMarked = makeEntity(world, 20, 10, 50, 'enemy');
  const nearCaster = makeEntity(world, 11, 10, 50, 'enemy');

  const meteorEvents = [];
  world.on('spell:meteor', (e) => meteorEvents.push(e));

  runSpellScript(world, caster, SPELL, { x: 20, y: 10 });

  const hitMarked = 50 - world.get(nearMarked, Vitality).hp;
  const hitNearCaster = 50 - world.get(nearCaster, Vitality).hp;
  assertEquals(meteorEvents.length, 1);
  assertEquals(meteorEvents[0].randomized, true);
  assertEquals(meteorEvents[0].randomReason, 'confused');
  assert(hitNearCaster > 0 || hitMarked === 0, 'randomized cast should not reliably honor marked tile');
});
