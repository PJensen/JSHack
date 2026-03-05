import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { MoveIntent } from "../src/rules/components/Intents/MoveIntent.js";
import { Facing } from "../src/rules/components/Facing.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Player } from "../src/rules/components/Player.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { Stamina } from "../src/rules/components/Stamina.js";
import { Interactable } from "../src/rules/components/Interactable.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Collider } from "../src/rules/components/Collider.js";
import { movementSystem, installSpiderWebListener } from "../src/rules/systems/movementSystem.js";
import { loadChunk, clearAll, getTile, setTile } from "../src/rules/environment/dungeon/tileMap.js";
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL, TILE_TREE, TILE_GRASS } from "../src/rules/environment/dungeon/constants.js";

function loadFloorChunk() {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
}

// ── basic movement ──────────────────────────────────────────────────

Deno.test("movementSystem: basic move updates position", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 42 });
    const id = world.create();
    world.add(id, Position, { x: 5, y: 5 });
    world.add(id, MoveIntent, { dx: 1, dy: 0 });

    movementSystem(world);

    const pos = world.get(id, Position);
    assertEquals(pos.x, 6);
    assertEquals(pos.y, 5);
    assertEquals(world.has(id, MoveIntent), false, "intent consumed");
  } finally { clearAll(); }
});

Deno.test("movementSystem: emits moved event", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 42 });
    const id = world.create();
    world.add(id, Position, { x: 5, y: 5 });
    world.add(id, MoveIntent, { dx: 0, dy: 1 });

    let movedEvent = null;
    world.on("moved", (ev) => { movedEvent = ev; });

    movementSystem(world);

    assert(movedEvent, "moved event should fire");
    assertEquals(movedEvent.id, id);
    assertEquals(movedEvent.from.x, 5);
    assertEquals(movedEvent.from.y, 5);
    assertEquals(movedEvent.to.x, 5);
    assertEquals(movedEvent.to.y, 6);
  } finally { clearAll(); }
});

// ── facing ──────────────────────────────────────────────────────────

Deno.test("movementSystem: sets facing on move attempt", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 42 });
    const id = world.create();
    world.add(id, Position, { x: 5, y: 5 });
    world.add(id, Facing, { dx: 0, dy: 0 });
    world.add(id, MoveIntent, { dx: -1, dy: 0 });

    movementSystem(world);

    const f = world.get(id, Facing);
    assertEquals(f.dx, -1);
    assertEquals(f.dy, 0);
  } finally { clearAll(); }
});

Deno.test("movementSystem: sets facing even on blocked move", () => {
  loadFloorChunk();
  try {
    setTile(6, 5, TILE_WALL);
    const world = new World({ seed: 42 });
    const id = world.create();
    world.add(id, Position, { x: 5, y: 5 });
    world.add(id, Facing, { dx: 0, dy: 0 });
    world.add(id, MoveIntent, { dx: 1, dy: 0 });

    movementSystem(world);

    const f = world.get(id, Facing);
    assertEquals(f.dx, 1, "facing should update even when blocked");
    const pos = world.get(id, Position);
    assertEquals(pos.x, 5, "position should not change when blocked");
  } finally { clearAll(); }
});

// ── collision / blocking ────────────────────────────────────────────

Deno.test("movementSystem: blocked by wall", () => {
  loadFloorChunk();
  try {
    setTile(6, 5, TILE_WALL);
    const world = new World({ seed: 42 });
    const id = world.create();
    world.add(id, Position, { x: 5, y: 5 });
    world.add(id, MoveIntent, { dx: 1, dy: 0 });

    movementSystem(world);

    const pos = world.get(id, Position);
    assertEquals(pos.x, 5, "should not move into wall");
    assertEquals(world.has(id, MoveIntent), false, "intent consumed regardless");
  } finally { clearAll(); }
});

Deno.test("movementSystem: two actors cannot move into same tile", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 42 });
    const a = world.create();
    world.add(a, Position, { x: 4, y: 5 });
    world.add(a, MoveIntent, { dx: 1, dy: 0 });

    const b = world.create();
    world.add(b, Position, { x: 6, y: 5 });
    world.add(b, MoveIntent, { dx: -1, dy: 0 });

    movementSystem(world);

    const pa = world.get(a, Position);
    const pb = world.get(b, Position);
    // Both want (5,5) — first mover gets it, second is blocked
    assert(!(pa.x === pb.x && pa.y === pb.y), "two actors should not occupy the same tile");
  } finally { clearAll(); }
});

// ── bump attack delegation ──────────────────────────────────────────

Deno.test("movementSystem: bump into hostile triggers bump:attack", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 42 });
    const attacker = world.create();
    world.add(attacker, Position, { x: 3, y: 3 });
    world.add(attacker, Vitality, { maxHp: 10, hp: 10 });
    world.add(attacker, Faction, { key: "player" });
    world.add(attacker, MoveIntent, { dx: 1, dy: 0 });

    const enemy = world.create();
    world.add(enemy, Position, { x: 4, y: 3 });
    world.add(enemy, Vitality, { maxHp: 10, hp: 10 });
    world.add(enemy, Faction, { key: "enemy" });

    let bumpAttack = false;
    world.on("bump:attack", () => { bumpAttack = true; });

    movementSystem(world);

    assert(bumpAttack, "bump into hostile should trigger bump:attack");
    const pos = world.get(attacker, Position);
    assertEquals(pos.x, 3, "attacker should not move into enemy tile");
  } finally { clearAll(); }
});

// ── bump interact delegation ────────────────────────────────────────

Deno.test("movementSystem: player bumps door triggers bump:interact", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 42 });

    const door = world.create();
    world.add(door, Position, { x: 4, y: 3 });
    world.add(door, Collider, { solid: true, blocksSight: true });
    world.add(door, Interactable, { action: "toggleDoor" });

    const player = world.create();
    world.add(player, Position, { x: 3, y: 3 });
    world.add(player, Player);
    world.add(player, MoveIntent, { dx: 1, dy: 0 });

    let interacted = false;
    world.on("bump:interact", () => { interacted = true; });

    movementSystem(world);

    assert(interacted, "player bump into door should trigger bump:interact");
  } finally { clearAll(); }
});

// ── tile reaction delegation ────────────────────────────────────────

Deno.test("movementSystem: player with dig weapon digs wall via bump", () => {
  loadFloorChunk();
  try {
    setTile(4, 3, TILE_WALL);
    const world = new World({ seed: 42 });

    const weapon = world.create();
    world.add(weapon, ItemInfo, { type: "weapon", bonuses: { dig: true }, staminaCost: 5 });

    const player = world.create();
    world.add(player, Position, { x: 3, y: 3 });
    world.add(player, Player);
    world.add(player, Equipment, { weapon });
    world.add(player, Stamina, { maxStamina: 100, stamina: 100, staminaRegen: 2, regenCooldown: 0 });
    world.add(player, MoveIntent, { dx: 1, dy: 0 });

    let dug = false;
    world.on("tile:dug", () => { dug = true; });

    movementSystem(world);

    assert(dug, "bump into wall with dig weapon should dig");
    assertEquals(getTile(4, 3), TILE_FLOOR, "wall should become floor");
  } finally { clearAll(); }
});

Deno.test("movementSystem: wall bump does not trigger hostile melee from stale target", () => {
  loadFloorChunk();
  try {
    setTile(4, 3, TILE_WALL);
    const world = new World({ seed: 42 });
    const player = world.create();
    world.add(player, Position, { x: 3, y: 3 });
    world.add(player, Vitality, { maxHp: 20, hp: 20 });
    world.add(player, Faction, { key: "player" });
    world.add(player, MoveIntent, { dx: 1, dy: 0 });

    const spider = world.create();
    world.add(spider, Position, { x: 4, y: 3 });
    world.add(spider, Vitality, { maxHp: 6, hp: 6 });
    world.add(spider, Faction, { key: "enemy" });

    let bumpAttacks = 0;
    world.on("bump:attack", () => { bumpAttacks += 1; });

    movementSystem(world);

    assertEquals(bumpAttacks, 0, "wall bumps should not resolve hostile melee");
    assertEquals(world.get(spider, Vitality).hp, 6, "target should not take melee damage");
    const pos = world.get(player, Position);
    assertEquals(pos.x, 3, "player remains in place on wall bump");
    assertEquals(pos.y, 3, "player remains in place on wall bump");
  } finally { clearAll(); }
});

// ── spider web listener ─────────────────────────────────────────────

Deno.test("movementSystem: spider web listener spawns web on departure", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 42 });
    installSpiderWebListener(world);

    const spider = world.create();
    world.add(spider, Position, { x: 5, y: 5 });
    world.add(spider, NamedIdentity, { name: "Spider", identity: "spider" });
    world.add(spider, MoveIntent, { dx: 1, dy: 0 });

    movementSystem(world);

    // Check that a web was spawned at the spider's old position
    let webFound = false;
    for (const [id, ni, pos] of world.query(NamedIdentity, Position)) {
      if (ni.identity === "web" && pos.x === 5 && pos.y === 5) {
        webFound = true;
        break;
      }
    }
    assert(webFound, "spider should leave a web at its departure tile");
  } finally { clearAll(); }
});

Deno.test("movementSystem: spider can traverse web tiles", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 42 });

    const web = world.create();
    world.add(web, Position, { x: 6, y: 5 });
    world.add(web, NamedIdentity, { name: "Web", identity: "web" });
    world.add(web, Collider, { solid: true, blocksSight: false });

    const spider = world.create();
    world.add(spider, Position, { x: 5, y: 5 });
    world.add(spider, NamedIdentity, { name: "Spider", identity: "spider" });
    world.add(spider, MoveIntent, { dx: 1, dy: 0 });

    movementSystem(world);

    const pos = world.get(spider, Position);
    assertEquals(pos.x, 6, "spider should move onto web tile");
    assertEquals(pos.y, 5, "spider should move onto web tile");
  } finally { clearAll(); }
});

Deno.test("movementSystem: non-spider is blocked by web tiles", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 42 });

    const web = world.create();
    world.add(web, Position, { x: 6, y: 5 });
    world.add(web, NamedIdentity, { name: "Web", identity: "web" });
    world.add(web, Collider, { solid: true, blocksSight: false });

    const goblin = world.create();
    world.add(goblin, Position, { x: 5, y: 5 });
    world.add(goblin, NamedIdentity, { name: "Goblin", identity: "goblin" });
    world.add(goblin, MoveIntent, { dx: 1, dy: 0 });

    movementSystem(world);

    const pos = world.get(goblin, Position);
    assertEquals(pos.x, 5, "non-spider should remain blocked by web");
    assertEquals(pos.y, 5, "non-spider should remain blocked by web");
  } finally { clearAll(); }
});

Deno.test("movementSystem: non-spider does not spawn web", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 42 });
    installSpiderWebListener(world);

    const goblin = world.create();
    world.add(goblin, Position, { x: 5, y: 5 });
    world.add(goblin, NamedIdentity, { name: "Goblin", identity: "goblin" });
    world.add(goblin, MoveIntent, { dx: 1, dy: 0 });

    movementSystem(world);

    let webFound = false;
    for (const [id, ni, pos] of world.query(NamedIdentity, Position)) {
      if (ni.identity === "web" && pos.x === 5 && pos.y === 5) {
        webFound = true;
        break;
      }
    }
    assertEquals(webFound, false, "goblin should not leave a web");
  } finally { clearAll(); }
});

// ── intent always consumed ──────────────────────────────────────────

Deno.test("movementSystem: intent consumed even on no-position entity", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 42 });
    const id = world.create();
    world.add(id, MoveIntent, { dx: 1, dy: 0 });
    // No Position component

    movementSystem(world);

    assertEquals(world.has(id, MoveIntent), false, "intent should be consumed");
  } finally { clearAll(); }
});

// ── dead entity guard ───────────────────────────────────────────────

Deno.test("movementSystem: dead entity (hp<=0) MoveIntent is consumed without moving", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 42 });
    const id = world.create();
    world.add(id, Position, { x: 5, y: 5 });
    world.add(id, Vitality, { hp: 0, maxHp: 10 });
    world.add(id, MoveIntent, { dx: 1, dy: 0 });

    const moved = [];
    world.on("moved", (e) => moved.push(e));

    movementSystem(world);

    const pos = world.get(id, Position);
    assertEquals(pos.x, 5, "dead entity must not change x");
    assertEquals(pos.y, 5, "dead entity must not change y");
    assertEquals(world.has(id, MoveIntent), false, "intent must be consumed");
    assertEquals(moved.length, 0, "no spurious moved event for dead entity");
  } finally { clearAll(); }
});
