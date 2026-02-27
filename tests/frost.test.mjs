import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Collider } from "../src/rules/components/Collider.js";
import { runSpellScript } from "../src/rules/scripts/spells.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";
import { clearAll as clearTileMap, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";

const SPELL = { id: "frost", name: "Frost", manaCost: 5, range: 10, script: "frost" };

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

Deno.test("frost: blocksight collider prevents targeting through it", () => {
  loadFlatFloor();
  const world = new World({ seed: 11 });
  const events = [];
  world.on("spell:frost", (ev) => events.push(ev));

  const caster = makeEntity(world, 2, 2, 20, "player");
  const target = makeEntity(world, 8, 2, 20, "enemy");
  const blocker = world.create();
  world.add(blocker, Position, { x: 5, y: 2 });
  world.add(blocker, Collider, { solid: true, blocksSight: true });

  runSpellScript(world, caster, SPELL, {});

  assertEquals(world.get(target, Vitality).hp, 20);
  assertEquals(events.length, 1);
  assertEquals(events[0].fizzle, true);
});
