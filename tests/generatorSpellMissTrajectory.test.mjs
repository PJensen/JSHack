import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { runSpellScript } from "../src/rules/scripts/spells.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";
import { clearAll as clearTileMap, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";

const ARCANE_BOLT = {
  id: "arcane_bolt",
  name: "Arcane Bolt",
  manaCost: 4,
  range: 10,
  script: "arcane_bolt",
};

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

Deno.test("generator projectile spell emits missed + missTo on miss", () => {
  loadFlatFloor();
  const world = new World({ seed: 0x8a11 });
  const events = [];
  world.on("spell:arcane_bolt", (ev) => events.push(ev));

  const caster = makeEntity(world, 2, 2, 20, "player");
  const target = makeEntity(world, 6, 2, 20, "enemy");
  world.get(target, Equipment).spellAvoidDerived = 200;

  runSpellScript(world, caster, ARCANE_BOLT, {});

  assertEquals(events.length, 1);
  assertEquals(events[0].targetId, target);
  assertEquals(events[0].hit, false);
  assertEquals(events[0].missed, true);
  assert(Number.isFinite(events[0].missTo?.x), "missTo.x should be finite");
  assert(Number.isFinite(events[0].missTo?.y), "missTo.y should be finite");
  assert(
    events[0].missTo.x !== events[0].at.x || events[0].missTo.y !== events[0].at.y,
    "missTo should differ from direct target point on misses",
  );
});

Deno.test("generator projectile spell keeps missTo empty on hit", () => {
  loadFlatFloor();
  const world = new World({ seed: 0x8a12 });
  const events = [];
  world.on("spell:arcane_bolt", (ev) => events.push(ev));

  const caster = makeEntity(world, 2, 2, 20, "player");
  makeEntity(world, 6, 2, 20, "enemy");

  runSpellScript(world, caster, ARCANE_BOLT, {});

  assertEquals(events.length, 1);
  assertEquals(events[0].hit, true);
  assertEquals(events[0].missed, false);
  assertEquals(events[0].missTo, undefined);
});
