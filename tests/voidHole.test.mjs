import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert";
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
import { Physiology } from "../src/rules/components/Physiology.js";
import { computeVoidHoleProgress, computeVoidHoleStrength, voidHoleSystem } from "../src/rules/systems/voidHoleSystem.js";
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

function makeEntity(world, x, y, hp, faction, massKg = 80) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Vitality, { maxHp: hp, hp });
  world.add(id, Equipment, {});
  world.add(id, Physiology, { massKg });
  if (faction) world.add(id, Faction, { key: faction });
  return id;
}

function createVoidHole(world, sourceId, x, y, opts = {}) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, VoidHole, {
    sourceId,
    radius: opts.radius ?? 3,
    pullSteps: opts.pullSteps ?? 2,
    tickDamage: opts.tickDamage ?? 7,
    ageTurns: opts.ageTurns ?? 0,
    durationTurns: opts.durationTurns ?? 6,
  });
  return id;
}

Deno.test("void hole strength grows over its lifetime", () => {
  const strengths = Array.from({ length: 6 }, (_, age) => computeVoidHoleStrength(age, 6));
  assertAlmostEquals(strengths[0], 0.75);
  assertAlmostEquals(strengths[5], 1.55);
  for (let i = 1; i < strengths.length; i++) {
    assert(strengths[i] > strengths[i - 1], `strength ${i} should grow over ${i - 1}`);
  }
  assertEquals(computeVoidHoleProgress(0, 6), 0);
  assertEquals(computeVoidHoleProgress(5, 6), 1);
});

Deno.test("void hole creates a persistent targeted well with typed state events", () => {
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
  assertEquals(hole.pullSteps, 2);
  assertEquals(hole.tickDamage, 7);
  assertEquals(hole.durationTurns, 6);
  assertEquals(lifespan.turnsLeft, 6);

  voidHoleSystem(world);

  assertEquals(events.length, 1);
  assert(events[0] instanceof VoidHoleCast);
  assertEquals(events[0].actor, caster);
  assertEquals(events[0].holeId, holeId);
  assertEquals(events[0].origin, { x: 4, y: 2 });
  assertEquals(events[0].ageTurns, 0);
  assertEquals(events[0].durationTurns, 6);
  assertEquals(events[0].progress, 0);
  assertEquals(events[0].strength, 0.75);
  assertEquals(events[0].collapsing, false);
  assertEquals(events[0].affected[0].id, target);
  assertEquals(events[0].affected[0].from, { x: 7, y: 2 });
  assertEquals(events[0].affected[0].to, { x: 6, y: 2 });
  assertEquals(world.get(target, Position).x, 6);
  assert(world.get(target, Vitality).hp < 30);
  assertEquals(hole.ageTurns, 1);

  for (let i = 0; i < 6; i++) lifespanSystem(world);
  assert(!world.isAlive(holeId), "void hole should expire through Lifespan cleanup");
});

Deno.test("void hole requires an explicit targeted tile", () => {
  loadFlatFloor();
  const world = new World({ seed: 0x501f });
  const failures = [];
  world.on("spell:no-target", (event) => failures.push(event));

  const caster = makeEntity(world, 2, 2, 20, "player");
  makeEntity(world, 5, 2, 30, "enemy");

  runSpellScript(world, caster, getSpell("void_hole"), {});

  assertEquals([...world.query(VoidHole)].length, 0);
  assertEquals(failures.length, 1);
  assertEquals(failures[0].spellId, "void_hole");
  assertEquals(failures[0].reason, "no_target");
});

Deno.test("void hole pull is mass-aware", () => {
  loadFlatFloor();
  const world = new World({ seed: 0x5020 });
  const events = [];
  world.on(VoidHoleCast, (event) => events.push(event));

  const caster = makeEntity(world, 2, 2, 20, "player");
  const light = makeEntity(world, 9, 2, 60, "enemy", 20);
  const heavy = makeEntity(world, 9, 4, 60, "enemy", 220);
  const massive = makeEntity(world, 9, 6, 60, "enemy", 360);
  createVoidHole(world, caster, 4, 4, { radius: 6, ageTurns: 5 });

  voidHoleSystem(world);

  assertEquals(events.length, 1);
  assertEquals(events[0].ageTurns, 5);
  assertEquals(events[0].progress, 1);
  assertEquals(events[0].strength, 1.55);
  assertEquals(world.get(light, Position), { x: 7, y: 4 });
  assertEquals(world.get(heavy, Position), { x: 8, y: 4 });
  assertEquals(world.get(massive, Position), { x: 9, y: 6 });
  assert(world.get(massive, Vitality).hp < 60, "massive targets should resist pull but still take damage");
});

Deno.test("void hole final collapse applies close-range bonus damage", () => {
  loadFlatFloor();
  const normalWorld = new World({ seed: 0x5021 });
  const collapseWorld = new World({ seed: 0x5021 });

  const normalCaster = makeEntity(normalWorld, 2, 2, 20, "player");
  const normalTarget = makeEntity(normalWorld, 5, 4, 80, "enemy", 80);
  createVoidHole(normalWorld, normalCaster, 4, 4, { radius: 3, ageTurns: 2 });
  voidHoleSystem(normalWorld);

  const collapseCaster = makeEntity(collapseWorld, 2, 2, 20, "player");
  const collapseTarget = makeEntity(collapseWorld, 5, 4, 80, "enemy", 80);
  const collapseEvents = [];
  collapseWorld.on(VoidHoleCast, (event) => collapseEvents.push(event));
  createVoidHole(collapseWorld, collapseCaster, 4, 4, { radius: 3, ageTurns: 5 });
  voidHoleSystem(collapseWorld);

  const normalDamage = 80 - worldHp(normalWorld, normalTarget);
  const collapseDamage = 80 - worldHp(collapseWorld, collapseTarget);
  assert(collapseDamage > normalDamage, `collapse damage ${collapseDamage} should exceed normal ${normalDamage}`);
  assertEquals(collapseEvents[0].ageTurns, 5);
  assertEquals(collapseEvents[0].collapsing, true);
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

function worldHp(world, id) {
  return world.get(id, Vitality).hp;
}

Deno.test("void hole has a learnable spellbook", () => {
  assert(getSpell("void_hole"), "void hole spell should exist");
  assert(getContentItem("book_void_hole"), "void hole spellbook should exist");
});
