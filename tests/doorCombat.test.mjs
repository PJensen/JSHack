import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { MoveIntent } from "../src/rules/components/Intents/MoveIntent.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Player } from "../src/rules/components/Player.js";
import { Interactable } from "../src/rules/components/Interactable.js";
import { Collider } from "../src/rules/components/Collider.js";
import { DoorState } from "../src/rules/components/DoorState.js";
import { movementSystem } from "../src/rules/systems/movementSystem.js";
import { installBumpInteractListener } from "../src/rules/systems/interactionSystem.js";
import { resolveBump } from "../src/rules/data/bumpResolvers.js";
import { setDoorState } from "../src/rules/utils/doorAccess.js";
import { invalidateTileQueryCache, getTileQuerySnapshot } from "../src/rules/utils/tileQueryCache.js";
import { loadChunk, clearAll } from "../src/rules/environment/dungeon/tileMap.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";

function loadFloorChunk() {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
}

function makeDoor(world, x, y, open) {
  const door = world.create();
  world.add(door, Position, { x, y });
  world.add(door, DoorState, { open, locked: false });
  world.add(door, Collider, { solid: !open, blocksSight: !open });
  world.add(door, Interactable, { action: "toggleDoor" });
  return door;
}

// ── stale snapshot: creature moves onto open door in same tick ──────

Deno.test("doorCombat: player attacks creature that moved onto open door this tick", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 42 });
    world.step = 1;

    // Layout:  enemy(3,3) → door(4,3) ← player(5,3)
    // Enemy moves right onto the open door, player moves left toward the door.
    // Player should melee the enemy, NOT toggle the door.

    // Create enemy FIRST so it is processed first in movementSystem.
    const enemy = world.create();
    world.add(enemy, Position, { x: 3, y: 3 });
    world.add(enemy, Vitality, { maxHp: 10, hp: 10 });
    world.add(enemy, Faction, { key: "enemy" });
    world.add(enemy, MoveIntent, { dx: 1, dy: 0 });

    const door = makeDoor(world, 4, 3, true);

    const player = world.create();
    world.add(player, Position, { x: 5, y: 3 });
    world.add(player, Vitality, { maxHp: 10, hp: 10 });
    world.add(player, Faction, { key: "player" });
    world.add(player, Player);
    world.add(player, MoveIntent, { dx: -1, dy: 0 });

    let attacked = false;
    let doorToggled = false;
    world.on("bump:attack", () => { attacked = true; });
    world.on("interaction", (ev) => {
      if (ev.action === "toggleDoor") doorToggled = true;
    });

    installBumpInteractListener(world);
    movementSystem(world);

    // Enemy should have moved onto the door tile.
    const enemyPos = world.get(enemy, Position);
    assertEquals(enemyPos.x, 4, "enemy should be on door tile");
    assertEquals(enemyPos.y, 3);

    // Player should have attacked (bump:attack), NOT toggled the door.
    assert(attacked, "player should melee the creature on the door tile");
    assertEquals(doorToggled, false, "door should NOT be toggled");

    // Door should still be open.
    const ds = world.get(door, DoorState);
    assert(ds.open, "door must remain open");
  } finally { clearAll(); }
});

// ── door cannot close while a creature stands on it ────────────────

Deno.test("doorCombat: toggleDoor refuses to close door with living entity on it", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 42 });
    world.step = 1;

    const door = makeDoor(world, 4, 3, true);

    // Living enemy standing on the open door tile.
    const enemy = world.create();
    world.add(enemy, Position, { x: 4, y: 3 });
    world.add(enemy, Vitality, { maxHp: 10, hp: 10 });
    world.add(enemy, Faction, { key: "enemy" });

    // Player adjacent, bumps the door tile.
    const player = world.create();
    world.add(player, Position, { x: 3, y: 3 });
    world.add(player, Player);

    // Directly invoke the toggle via the interaction pipeline.
    installBumpInteractListener(world);
    const tiles = getTileQuerySnapshot(world);

    // Simulate bump:interact for the door (as if objectInteract fired).
    let interactionResult = null;
    world.on("interaction", (ev) => { interactionResult = ev; });
    world.emit("bump:interact", { actor: player, target: door });

    // Door should remain open — creature is in the way.
    const ds = world.get(door, DoorState);
    assert(ds.open, "door must stay open while creature occupies it");
  } finally { clearAll(); }
});

Deno.test("doorCombat: toggleDoor allows closing door when tile is empty", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 42 });
    world.step = 1;

    const door = makeDoor(world, 4, 3, true);

    const player = world.create();
    world.add(player, Position, { x: 3, y: 3 });
    world.add(player, Player);

    installBumpInteractListener(world);

    world.emit("bump:interact", { actor: player, target: door });

    // No creature on the tile — door should close normally.
    const ds = world.get(door, DoorState);
    assertEquals(ds.open, false, "door should close when no one is on it");
  } finally { clearAll(); }
});

Deno.test("doorCombat: door closes once creature dies on it", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 42 });
    world.step = 1;

    const door = makeDoor(world, 4, 3, true);

    // Dead enemy on the door tile (hp <= 0).
    const corpse = world.create();
    world.add(corpse, Position, { x: 4, y: 3 });
    world.add(corpse, Vitality, { maxHp: 10, hp: 0 });
    world.add(corpse, Faction, { key: "enemy" });

    const player = world.create();
    world.add(player, Position, { x: 3, y: 3 });
    world.add(player, Player);

    installBumpInteractListener(world);
    world.emit("bump:interact", { actor: player, target: door });

    // Dead creature should not prevent door from closing.
    const ds = world.get(door, DoorState);
    assertEquals(ds.open, false, "door should close — creature is dead");
  } finally { clearAll(); }
});
