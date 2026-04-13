import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Collider } from "../src/rules/components/Collider.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
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
  world.add(id, Equipment, {});
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
  assertEquals(events[0].projectileDelay, 0);
});

Deno.test("frost: emits projectile delay matching travel time", () => {
  loadFlatFloor();
  const world = new World({ seed: 12 });
  const events = [];
  world.on("spell:frost", (ev) => events.push(ev));

  const caster = makeEntity(world, 2, 2, 20, "stone_taunter");
  makeEntity(world, 6, 2, 20, "enemy");

  runSpellScript(world, caster, SPELL, {});

  assertEquals(events.length, 1);
  assertEquals(events[0].fizzle, undefined);
  assertEquals(events[0].projectileDelay, 0.5);
});

Deno.test("frost: publishes VFX event on miss and does not apply frost", () => {
  loadFlatFloor();
  const world = new World({ seed: 13 });
  const frostEvents = [];
  const missEvents = [];
  world.on("spell:frost", (ev) => frostEvents.push(ev));
  world.on("spell:miss", (ev) => missEvents.push(ev));

  const caster = makeEntity(world, 2, 2, 20, "stone_taunter");
  const target = makeEntity(world, 6, 2, 20, "enemy");
  world.get(target, Equipment).spellAvoidDerived = 200;

  runSpellScript(world, caster, SPELL, {});

  assertEquals(frostEvents.length, 1);
  assertEquals(frostEvents[0].targetId, target);
  assertEquals(frostEvents[0].missed, true);
  assertEquals(frostEvents[0].projectileDelay, 0.5);
  assertEquals(Number.isFinite(frostEvents[0].missTo?.x), true);
  assertEquals(Number.isFinite(frostEvents[0].missTo?.y), true);
  assertEquals(
    frostEvents[0].missTo.x === frostEvents[0].at.x && frostEvents[0].missTo.y === frostEvents[0].at.y,
    false,
  );
  assertEquals(missEvents.length, 1);
  assertEquals(missEvents[0].spellId, "frost");
  assertEquals(world.get(target, Vitality).hp, 20);
  assertEquals(!!world.get(target, ActiveEffects)?.effects?.some((effect) => effect.key === "frost"), false);
});
