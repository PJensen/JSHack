import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { getSpell } from "../src/rules/data/spells.js";
import { runSpellScript } from "../src/rules/scripts/spells.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Flying } from "../src/rules/components/Flying.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { clearAll, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL } from "../src/rules/environment/dungeon/constants.js";
import { hasSpellLineOfSight } from "../src/rules/utils/spellTargeting.js";

function addDungeonState(world, depth, profileType) {
  const id = world.create();
  world.add(id, DungeonState, {
    worldSeed: 1,
    currentDepth: depth,
    profileType,
    floorEntityIds: [],
    downStairPositions: [],
  });
  return id;
}

function loadWallBetweenCasterAndTarget() {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
  tiles[0 * CHUNK_SIZE + 2] = TILE_WALL;
  loadChunk(0, 0, tiles);
}

function makeActor(world, x, y, faction, hp = 20) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Vitality, { maxHp: hp, hp });
  world.add(id, Faction, { key: faction });
  return id;
}

function makeFlyingTarget(world, x, y, hp = 20) {
  const id = makeActor(world, x, y, "enemy", hp);
  world.add(id, Flying, {});
  return id;
}

Deno.test("frost can auto-target an overworld flyer through wall cover", () => {
  loadWallBetweenCasterAndTarget();
  const world = new World({ seed: 101 });
  addDungeonState(world, 0, "overworld");

  const caster = makeActor(world, 0, 0, "stone_taunter");
  const target = makeFlyingTarget(world, 4, 0);
  const events = [];
  world.on("spell:frost", (event) => events.push(event));

  runSpellScript(world, caster, getSpell("frost"), {});

  assert(world.get(target, Vitality).hp < 20, "overworld flyer should take frost damage");
  assertEquals(events[0]?.targetId, target);
  assertEquals(events[0]?.fizzle, undefined);
});

Deno.test("frost still fizzles on cave flyers behind blocked LOS", () => {
  loadWallBetweenCasterAndTarget();
  const world = new World({ seed: 102 });
  addDungeonState(world, 5, "caves");

  const caster = makeActor(world, 0, 0, "player");
  const target = makeFlyingTarget(world, 4, 0);
  const events = [];
  world.on("spell:frost", (event) => events.push(event));

  runSpellScript(world, caster, getSpell("frost"), {});

  assertEquals(world.get(target, Vitality).hp, 20);
  assertEquals(events[0]?.fizzle, true);
});

Deno.test("agony can hit an overworld flyer that is visible via aerial LOS", () => {
  loadWallBetweenCasterAndTarget();
  const world = new World({ seed: 103 });
  addDungeonState(world, 0, "overworld");

  const caster = makeActor(world, 0, 0, "player");
  const target = makeFlyingTarget(world, 4, 0, 30);

  runSpellScript(world, caster, getSpell("agony"), { targetId: target, x: 4, y: 0 });

  const effects = world.get(target, ActiveEffects);
  assert(effects?.effects?.some((effect) => effect.key === "agony"), "agony should apply to overworld flyer");
});

Deno.test("meteor can target a tile occupied by an overworld flyer through wall cover", () => {
  loadWallBetweenCasterAndTarget();
  const world = new World({ seed: 104 });
  addDungeonState(world, 0, "overworld");

  const caster = makeActor(world, 0, 0, "player");
  const target = makeFlyingTarget(world, 4, 0, 30);
  const failures = [];
  world.on("spell:meteor:failed", (event) => failures.push(event));

  runSpellScript(world, caster, getSpell("meteor"), { x: 4, y: 0 });

  assertEquals(failures.length, 0);
  assert(world.get(target, Vitality).hp < 30, "meteor should damage the flyer on the chosen tile");
});

Deno.test("spell LOS blocks non-adjacent invisible hostile targets even with direct LOS", () => {
  clearAll();
  const world = new World({ seed: 105 });
  const caster = makeActor(world, 0, 0, "player");
  const target = makeActor(world, 4, 0, "enemy");
  world.add(target, ActiveEffects, {
    effects: [{ key: "invisible", turnsLeft: 12, potency: 1, stacks: 1 }],
  });

  const sourcePos = world.get(caster, Position);
  const targetPos = world.get(target, Position);
  const ok = hasSpellLineOfSight(world, {
    sourceId: caster,
    targetId: target,
    sourcePos,
    targetPos,
    range: 10,
    isBlocked: () => false,
  });
  assertEquals(ok, false);
});

Deno.test("spell LOS allows non-hostile invisible targets", () => {
  clearAll();
  const world = new World({ seed: 106 });
  const caster = makeActor(world, 0, 0, "player");
  const target = makeActor(world, 4, 0, "player");
  world.add(target, ActiveEffects, {
    effects: [{ key: "invisible", turnsLeft: 12, potency: 1, stacks: 1 }],
  });

  const sourcePos = world.get(caster, Position);
  const targetPos = world.get(target, Position);
  const ok = hasSpellLineOfSight(world, {
    sourceId: caster,
    targetId: target,
    sourcePos,
    targetPos,
    range: 10,
    isBlocked: () => false,
  });
  assertEquals(ok, true);
});

Deno.test("spell LOS blocks invisible flying hostile resolved from target tile fallback", () => {
  clearAll();
  const world = new World({ seed: 107 });
  addDungeonState(world, 0, "overworld");
  const caster = makeActor(world, 0, 0, "player");
  const flyer = makeFlyingTarget(world, 4, 0, 20);
  world.add(flyer, ActiveEffects, {
    effects: [{ key: "invisible", turnsLeft: 12, potency: 1, stacks: 1 }],
  });

  const sourcePos = world.get(caster, Position);
  const targetPos = { x: 4, y: 0 };
  const ok = hasSpellLineOfSight(world, {
    sourceId: caster,
    sourcePos,
    targetPos,
    range: 10,
    isBlocked: () => false,
    allowFlyingOccupantAtTarget: true,
  });
  assertEquals(ok, false);
});
