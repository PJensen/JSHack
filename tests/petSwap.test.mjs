import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Player } from "../src/rules/components/Player.js";
import { Pet } from "../src/rules/components/Pet.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Stamina } from "../src/rules/components/Stamina.js";
import { Facing } from "../src/rules/components/Facing.js";
import { MoveIntent } from "../src/rules/components/Intents/MoveIntent.js";
import { resolveBump, BUMP_RESOLVERS } from "../src/rules/data/bumpResolvers.js";
import { movementSystem } from "../src/rules/systems/movementSystem.js";
import { installBumpAttackListener, resolveMeleeAttack } from "../src/rules/systems/combatSystem.js";
import { loadChunk, clearAll } from "../src/rules/environment/dungeon/tileMap.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";
import { getTileQuerySnapshot } from "../src/rules/utils/tileQueryCache.js";

function loadFloorChunk() {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
}

function makeBumpCtx(world, overrides = {}) {
  const tiles = getTileQuerySnapshot(world);
  return { nx: 0, ny: 0, mdx: 1, mdy: 0, target: 0, tiles, ...overrides };
}

// ── Bug: player kills pet ────────────────────────────────────────────

Deno.test("regression: player with faction does not bump-attack pet", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 42 });

    const player = world.create();
    world.add(player, Player);
    world.add(player, Position, { x: 5, y: 5 });
    world.add(player, Vitality, { maxHp: 20, hp: 20 });
    world.add(player, Faction, { key: "player" });
    world.add(player, Equipment, {});
    world.add(player, Stamina, { maxStamina: 100, stamina: 100, staminaRegen: 2 });

    const pet = world.create();
    world.add(pet, Pet);
    world.add(pet, Position, { x: 6, y: 5 });
    world.add(pet, Vitality, { maxHp: 30, hp: 30 });
    world.add(pet, Faction, { key: "pet" });

    let attacked = false;
    world.on("bump:attack", () => { attacked = true; });

    const ctx = makeBumpCtx(world, { nx: 6, ny: 5, mdx: 1, mdy: 0, target: pet });
    resolveBump(world, player, ctx);

    assertEquals(attacked, false, "player should NOT trigger bump:attack on pet");
  } finally { clearAll(); }
});

Deno.test("regression: resolveMeleeAttack does not damage pet", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 42 });

    const player = world.create();
    world.add(player, Player);
    world.add(player, Position, { x: 5, y: 5 });
    world.add(player, Vitality, { maxHp: 20, hp: 20 });
    world.add(player, Faction, { key: "player" });
    world.add(player, Equipment, {});
    world.add(player, Stamina, { maxStamina: 100, stamina: 100, staminaRegen: 2 });

    const pet = world.create();
    world.add(pet, Pet);
    world.add(pet, Position, { x: 6, y: 5 });
    world.add(pet, Vitality, { maxHp: 30, hp: 30 });
    world.add(pet, Faction, { key: "pet" });

    resolveMeleeAttack(world, player, pet);

    const petVit = world.get(pet, Vitality);
    assertEquals(petVit.hp, 30, "pet should NOT take damage from player");
  } finally { clearAll(); }
});

// ── Pet swap ─────────────────────────────────────────────────────────

Deno.test("pet-swap: player bumping pet swaps positions", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 42 });

    const player = world.create();
    world.add(player, Player);
    world.add(player, Position, { x: 5, y: 5 });
    world.add(player, Vitality, { maxHp: 20, hp: 20 });
    world.add(player, Faction, { key: "player" });
    world.add(player, Facing, { dx: 0, dy: 0 });

    const pet = world.create();
    world.add(pet, Pet);
    world.add(pet, Position, { x: 6, y: 5 });
    world.add(pet, Vitality, { maxHp: 30, hp: 30 });
    world.add(pet, Faction, { key: "pet" });

    const ctx = makeBumpCtx(world, { nx: 6, ny: 5, mdx: 1, mdy: 0, target: pet });
    const handled = resolveBump(world, player, ctx);

    assert(handled, "pet-swap resolver should handle the bump");

    const playerPos = world.get(player, Position);
    const petPos = world.get(pet, Position);
    assertEquals(playerPos.x, 6, "player should move to pet's old x");
    assertEquals(playerPos.y, 5, "player should move to pet's old y");
    assertEquals(petPos.x, 5, "pet should move to player's old x");
    assertEquals(petPos.y, 5, "pet should move to player's old y");
  } finally { clearAll(); }
});

Deno.test("pet-swap: emits moved events for both entities", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 42 });

    const player = world.create();
    world.add(player, Player);
    world.add(player, Position, { x: 5, y: 5 });
    world.add(player, Vitality, { maxHp: 20, hp: 20 });
    world.add(player, Faction, { key: "player" });
    world.add(player, Facing, { dx: 0, dy: 0 });

    const pet = world.create();
    world.add(pet, Pet);
    world.add(pet, Position, { x: 6, y: 5 });
    world.add(pet, Vitality, { maxHp: 30, hp: 30 });
    world.add(pet, Faction, { key: "pet" });

    const moves = [];
    world.on("moved", (ev) => moves.push(ev));

    const ctx = makeBumpCtx(world, { nx: 6, ny: 5, mdx: 1, mdy: 0, target: pet });
    resolveBump(world, player, ctx);

    assertEquals(moves.length, 2, "should emit two moved events");
  } finally { clearAll(); }
});

Deno.test("pet-swap: non-player cannot swap with pet", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 42 });

    const monster = world.create();
    world.add(monster, Position, { x: 5, y: 5 });
    world.add(monster, Vitality, { maxHp: 10, hp: 10 });
    world.add(monster, Faction, { key: "enemy" });

    const pet = world.create();
    world.add(pet, Pet);
    world.add(pet, Position, { x: 6, y: 5 });
    world.add(pet, Vitality, { maxHp: 30, hp: 30 });
    world.add(pet, Faction, { key: "pet" });

    const ctx = makeBumpCtx(world, { nx: 6, ny: 5, mdx: 1, mdy: 0, target: pet });
    // Monster bumping pet should go to hostile-melee, not pet-swap
    let attacked = false;
    world.on("bump:attack", () => { attacked = true; });
    resolveBump(world, monster, ctx);

    assert(attacked, "enemy bumping pet should attack, not swap");
  } finally { clearAll(); }
});

Deno.test("pet-swap: player bumping shopkeeper swaps positions", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 52 });

    const player = world.create();
    world.add(player, Player);
    world.add(player, Position, { x: 5, y: 5 });
    world.add(player, Faction, { key: "player" });

    const shopkeeper = world.create();
    world.add(shopkeeper, Position, { x: 6, y: 5 });
    world.add(shopkeeper, Faction, { key: "shopkeeper" });

    const ctx = makeBumpCtx(world, { nx: 6, ny: 5, mdx: 1, mdy: 0, target: shopkeeper });
    const handled = resolveBump(world, player, ctx);

    assert(handled, "player should be able to swap with shopkeeper");
    assertEquals(world.get(player, Position), { x: 6, y: 5 });
    assertEquals(world.get(shopkeeper, Position), { x: 5, y: 5 });
  } finally { clearAll(); }
});
