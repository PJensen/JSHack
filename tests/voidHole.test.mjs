import { assert, assertEquals } from "jsr:@std/assert";
import "./helpers/installContentCatalog.mjs";
import { World } from "../src/lib/ecs-js/index.js";
import { VoidHoleCast } from "../src/events/VoidHoleCast.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Collider } from "../src/rules/components/Collider.js";
import { Lifespan } from "../src/rules/components/Lifespan.js";
import { VoidHole } from "../src/rules/components/VoidHole.js";
import { voidHoleSystem } from "../src/rules/systems/voidHoleSystem.js";
import { lifespanSystem } from "../src/rules/systems/lifespanSystem.js";
import { runSpellScript } from "../src/rules/scripts/spells.js";
import { getSpell } from "../src/rules/data/spells.js";
import { getContentItem } from "../src/content/registry.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";
import { clearAll as clearTileMap, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";

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
  world.add(id, Equipment, {});
  if (faction) world.add(id, Faction, { key: faction });
  return id;
}

Deno.test("void hole creates a temporary well that pulses typed pull events", () => {
  loadFlatFloor();
  const world = new World({ seed: 0x501d });
  const events = [];
  world.on(VoidHoleCast, (event) => events.push(event));

  const caster = makeEntity(world, 2, 2, 20, "player");
  const target = makeEntity(world, 7, 2, 30, "enemy");

  runSpellScript(world, caster, getSpell("void_hole"), { x: 4, y: 2 });

  assertEquals(events.length, 0);
  assertEquals(world.get(target, Position).x, 7);
  const holes = [...world.query(VoidHole, Position, Lifespan)];
  assertEquals(holes.length, 1);
  const [holeId, hole, pos, lifespan] = holes[0];
  assertEquals(pos, { x: 4, y: 2 });
  assertEquals(hole.sourceId, caster);
  assertEquals(hole.radius, 3);
  assertEquals(lifespan.turnsLeft, 4);

  voidHoleSystem(world);

  assertEquals(events.length, 1);
  assert(events[0] instanceof VoidHoleCast);
  assertEquals(events[0].actor, caster);
  assertEquals(events[0].origin, { x: 4, y: 2 });
  assertEquals(events[0].affected[0].id, target);
  assertEquals(events[0].affected[0].from, { x: 7, y: 2 });
  assertEquals(events[0].affected[0].to, { x: 6, y: 2 });
  assertEquals(world.get(target, Position).x, 6);
  assert(world.get(target, Vitality).hp < 30);

  for (let i = 0; i < 4; i++) lifespanSystem(world);
  assert(!world.isAlive(holeId), "void hole should expire through Lifespan cleanup");
});

Deno.test("void hole pull stops at solid blockers", () => {
  loadFlatFloor();
  const world = new World({ seed: 0x501e });
  const events = [];
  world.on(VoidHoleCast, (event) => events.push(event));

  const caster = makeEntity(world, 2, 2, 20, "player");
  const target = makeEntity(world, 7, 2, 30, "enemy");
  const blocker = world.create();
  world.add(blocker, Position, { x: 6, y: 2 });
  world.add(blocker, Collider, { solid: true, blocksSight: false });

  runSpellScript(world, caster, getSpell("void_hole"), { x: 4, y: 2 });
  voidHoleSystem(world);

  assertEquals(events.length, 1);
  assertEquals(events[0].affected[0].from, { x: 7, y: 2 });
  assertEquals(events[0].affected[0].to, { x: 7, y: 2 });
  assertEquals(world.get(target, Position).x, 7);
  assert(world.get(target, Vitality).hp < 30);
});

Deno.test("void hole has a learnable spellbook", () => {
  assert(getSpell("void_hole"), "void hole spell should exist");
  assert(getContentItem("book_void_hole"), "void hole spellbook should exist");
});
