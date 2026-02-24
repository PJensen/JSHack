import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { Collider } from "../src/rules/components/Collider.js";
import { Pushable } from "../src/rules/components/Pushable.js";
import { loadChunk, clearAll, setTile, getTile } from "../src/rules/environment/dungeon/tileMap.js";
import {
  CHUNK_SIZE, TILE_FLOOR, TILE_WALL, TILE_ICE, TILE_SHALLOW_WATER, TILE_LAVA,
} from "../src/rules/environment/dungeon/constants.js";
import { installTileStepEffectListener } from "../src/rules/systems/tileStepEffectSystem.js";
import { findTileStepEffect, TILE_STEP_EFFECTS } from "../src/rules/data/tileStepEffects.js";

function loadFloorChunk() {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
}

function makeLiving(world, x, y, hp = 20) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Vitality, { maxHp: 20, hp });
  world.add(id, ActiveEffects, { effects: [] });
  return id;
}

// ── shallow water: extinguish burn ──────────────────────────────────

Deno.test("tileStepEffects: shallow water extinguishes burn", () => {
  loadFloorChunk();
  try {
    setTile(5, 5, TILE_SHALLOW_WATER);
    const world = new World({ seed: 42 });
    installTileStepEffectListener(world);

    const actor = makeLiving(world, 4, 5);
    // Give actor a burn effect
    const ae = world.get(actor, ActiveEffects);
    ae.effects.push({ key: "burn", turnsLeft: 3, potency: 2, stacks: 1 });

    let waded = false;
    world.on("tile:waded", () => { waded = true; });

    // Move actor onto shallow water
    world.set(actor, Position, { x: 5, y: 5 });
    world.emit("moved", { id: actor, from: { x: 4, y: 5 }, to: { x: 5, y: 5 } });

    assert(waded, "should emit tile:waded");
    const aeAfter = world.get(actor, ActiveEffects);
    const burns = aeAfter.effects.filter(e => e.key === "burn");
    assertEquals(burns.length, 0, "burn should be removed");
  } finally { clearAll(); }
});

Deno.test("tileStepEffects: shallow water without burn does nothing harmful", () => {
  loadFloorChunk();
  try {
    setTile(5, 5, TILE_SHALLOW_WATER);
    const world = new World({ seed: 42 });
    installTileStepEffectListener(world);

    const actor = makeLiving(world, 4, 5);

    let waded = false;
    world.on("tile:waded", () => { waded = true; });

    world.set(actor, Position, { x: 5, y: 5 });
    world.emit("moved", { id: actor, from: { x: 4, y: 5 }, to: { x: 5, y: 5 } });

    assertEquals(waded, false, "should not emit tile:waded if no burn to remove");
    const vit = world.get(actor, Vitality);
    assertEquals(vit.hp, 20, "hp should be unchanged");
  } finally { clearAll(); }
});

// ── lava: scorch + burn ─────────────────────────────────────────────

Deno.test("tileStepEffects: lava deals damage and applies burn", () => {
  loadFloorChunk();
  try {
    setTile(5, 5, TILE_LAVA);
    const world = new World({ seed: 42 });
    installTileStepEffectListener(world);

    const actor = makeLiving(world, 4, 5);

    let scorched = false;
    world.on("tile:scorched", () => { scorched = true; });

    world.set(actor, Position, { x: 5, y: 5 });
    world.emit("moved", { id: actor, from: { x: 4, y: 5 }, to: { x: 5, y: 5 } });

    assert(scorched, "should emit tile:scorched");
    const vit = world.get(actor, Vitality);
    assert(vit.hp < 20, "hp should be reduced by lava damage");
    const ae = world.get(actor, ActiveEffects);
    const burns = ae.effects.filter(e => e.key === "burn");
    assertEquals(burns.length, 1, "should have burn effect");
  } finally { clearAll(); }
});

// ── ice: chain slide ────────────────────────────────────────────────

Deno.test("tileStepEffects: ice slides actor in same direction", () => {
  loadFloorChunk();
  try {
    // Create a 3-tile ice strip: (5,5), (6,5), (7,5)
    setTile(5, 5, TILE_ICE);
    setTile(6, 5, TILE_ICE);
    setTile(7, 5, TILE_ICE);
    // (8,5) is floor — actor should stop there
    const world = new World({ seed: 42 });
    installTileStepEffectListener(world);

    const actor = makeLiving(world, 4, 5);

    let slidEvent = null;
    world.on("tile:slid", (ev) => { slidEvent = ev; });

    // Actor steps onto first ice tile (moving east)
    world.set(actor, Position, { x: 5, y: 5 });
    world.emit("moved", { id: actor, from: { x: 4, y: 5 }, to: { x: 5, y: 5 } });

    const pos = world.get(actor, Position);
    assertEquals(pos.x, 8, "actor should slide through all ice to first non-ice tile");
    assertEquals(pos.y, 5);
    assert(slidEvent, "should emit tile:slid");
    assertEquals(slidEvent.steps, 3, "should have slid 3 steps");
  } finally { clearAll(); }
});

Deno.test("tileStepEffects: ice slide stops at wall", () => {
  loadFloorChunk();
  try {
    setTile(5, 5, TILE_ICE);
    setTile(6, 5, TILE_ICE);
    setTile(7, 5, TILE_WALL); // wall blocks
    const world = new World({ seed: 42 });
    installTileStepEffectListener(world);

    const actor = makeLiving(world, 4, 5);

    world.set(actor, Position, { x: 5, y: 5 });
    world.emit("moved", { id: actor, from: { x: 4, y: 5 }, to: { x: 5, y: 5 } });

    const pos = world.get(actor, Position);
    assertEquals(pos.x, 6, "actor should stop before wall");
    assertEquals(pos.y, 5);
  } finally { clearAll(); }
});

Deno.test("tileStepEffects: ice slide stops at blocked entity", () => {
  loadFloorChunk();
  try {
    setTile(5, 5, TILE_ICE);
    setTile(6, 5, TILE_ICE);
    setTile(7, 5, TILE_ICE);
    const world = new World({ seed: 42 });
    installTileStepEffectListener(world);

    const actor = makeLiving(world, 4, 5);
    // Place a solid entity at (7,5)
    const blocker = world.create();
    world.add(blocker, Position, { x: 7, y: 5 });
    world.add(blocker, Collider, { solid: true, blocksSight: false });

    world.set(actor, Position, { x: 5, y: 5 });
    world.emit("moved", { id: actor, from: { x: 4, y: 5 }, to: { x: 5, y: 5 } });

    const pos = world.get(actor, Position);
    assertEquals(pos.x, 6, "actor should stop before blocking entity");
  } finally { clearAll(); }
});

Deno.test("tileStepEffects: sliding off ice onto floor stops on the floor tile", () => {
  loadFloorChunk();
  try {
    setTile(5, 5, TILE_ICE);
    // (6,5) is floor — actor slides from ice onto floor, then stops
    const world = new World({ seed: 42 });
    installTileStepEffectListener(world);

    const actor = makeLiving(world, 4, 5);

    world.set(actor, Position, { x: 5, y: 5 });
    world.emit("moved", { id: actor, from: { x: 4, y: 5 }, to: { x: 5, y: 5 } });

    const pos = world.get(actor, Position);
    assertEquals(pos.x, 6, "actor should slide one step off ice onto floor");
    assertEquals(pos.y, 5);
  } finally { clearAll(); }
});

Deno.test("tileStepEffects: ice slide into lava applies scorch at the end", () => {
  loadFloorChunk();
  try {
    setTile(5, 5, TILE_ICE);
    setTile(6, 5, TILE_ICE);
    setTile(7, 5, TILE_LAVA);
    const world = new World({ seed: 42 });
    installTileStepEffectListener(world);

    const actor = makeLiving(world, 4, 5);

    let scorched = false;
    world.on("tile:scorched", () => { scorched = true; });

    world.set(actor, Position, { x: 5, y: 5 });
    world.emit("moved", { id: actor, from: { x: 4, y: 5 }, to: { x: 5, y: 5 } });

    const pos = world.get(actor, Position);
    assertEquals(pos.x, 7, "actor should slide onto lava tile");
    assert(scorched, "should be scorched by lava after sliding");
    const vit = world.get(actor, Vitality);
    assert(vit.hp < 20, "should take lava damage");
  } finally { clearAll(); }
});

// ── bridge mechanic ─────────────────────────────────────────────────

Deno.test("tileStepEffects: Pushable entity on tile suppresses step effect", () => {
  loadFloorChunk();
  try {
    setTile(5, 5, TILE_LAVA);
    const world = new World({ seed: 42 });
    installTileStepEffectListener(world);

    // Place a pushable entity (statue) on the lava
    const statue = world.create();
    world.add(statue, Position, { x: 5, y: 5 });
    world.add(statue, Pushable);
    world.add(statue, Collider, { solid: true, blocksSight: true });

    const actor = makeLiving(world, 4, 5);

    let scorched = false;
    world.on("tile:scorched", () => { scorched = true; });

    // Simulate actor stepping onto the bridged tile
    world.set(actor, Position, { x: 5, y: 5 });
    world.emit("moved", { id: actor, from: { x: 4, y: 5 }, to: { x: 5, y: 5 } });

    assertEquals(scorched, false, "should not be scorched on bridged lava");
    const vit = world.get(actor, Vitality);
    assertEquals(vit.hp, 20, "hp should remain unchanged");
  } finally { clearAll(); }
});

// ── data integrity ──────────────────────────────────────────────────

Deno.test("tileStepEffects: all entries have required fields", () => {
  for (const e of TILE_STEP_EFFECTS) {
    assertEquals(typeof e.tile, "number", `${e.event}: tile must be a number`);
    assertEquals(typeof e.type, "string", `${e.event}: type must be a string`);
    assertEquals(typeof e.event, "string", `${e.event}: event must be a string`);
  }
});

Deno.test("tileStepEffects: no duplicate tile keys", () => {
  const tiles = TILE_STEP_EFFECTS.map(e => e.tile);
  assertEquals(new Set(tiles).size, tiles.length, "tile IDs must be unique in TILE_STEP_EFFECTS");
});

Deno.test("tileStepEffects: findTileStepEffect returns correct entries", () => {
  assertNotEquals(findTileStepEffect(TILE_ICE), null);
  assertNotEquals(findTileStepEffect(TILE_SHALLOW_WATER), null);
  assertNotEquals(findTileStepEffect(TILE_LAVA), null);
  assertEquals(findTileStepEffect(TILE_FLOOR), null, "floor should have no step effect");
  assertEquals(findTileStepEffect(TILE_WALL), null, "wall should have no step effect");
});
