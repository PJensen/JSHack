import { assert, assertEquals } from "jsr:@std/assert";
import "./helpers/installContentCatalog.mjs";
import { World } from "../src/lib/ecs-js/index.js";
import { ArcaneBarrageCast, MagicMissileCast } from "../src/events/ArcaneProjectileCast.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Equipment } from "../src/rules/components/Equipment.js";
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

Deno.test("magic missile damages nearest hostile and emits typed projectile event", () => {
  loadFlatFloor();
  const world = new World({ seed: 0x4d15 });
  const events = [];
  world.on(MagicMissileCast, (event) => events.push(event));

  const caster = makeEntity(world, 2, 2, 20, "player");
  const target = makeEntity(world, 6, 2, 20, "enemy");

  runSpellScript(world, caster, getSpell("magic_missile"), {});

  assertEquals(events.length, 1);
  assert(events[0] instanceof MagicMissileCast);
  assertEquals(events[0].actor, caster);
  assertEquals(events[0].targetId, target);
  assertEquals(events[0].from, { x: 2, y: 2 });
  assertEquals(events[0].at, { x: 6, y: 2 });
  assertEquals(events[0].projectileDelay, 4 / 9);
  assert(world.get(target, Vitality).hp < 20);
});

Deno.test("arcane barrage uses one synchronized typed event with three lanes", () => {
  loadFlatFloor();
  const world = new World({ seed: 0xba77 });
  const events = [];
  world.on(ArcaneBarrageCast, (event) => events.push(event));

  const caster = makeEntity(world, 2, 2, 20, "player");
  const target = makeEntity(world, 6, 2, 30, "enemy");

  runSpellScript(world, caster, getSpell("arcane_barrage"), {});

  assertEquals(events.length, 1);
  assert(events[0] instanceof ArcaneBarrageCast);
  assertEquals(events[0].targetId, target);
  assertEquals(events[0].lanes, 3);
  assertEquals(events[0].projectileDelay, 4 / 9);
  assert(world.get(target, Vitality).hp < 30);
});

Deno.test("magic missile and arcane barrage have learnable spellbooks", () => {
  assert(getSpell("magic_missile"), "magic missile spell should exist");
  assert(getSpell("arcane_barrage"), "arcane barrage spell should exist");
  assert(getContentItem("book_magic_missile"), "magic missile spellbook should exist");
  assert(getContentItem("book_arcane_barrage"), "arcane barrage spellbook should exist");
});
