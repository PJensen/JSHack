// tests/enemyDoorOpen.test.mjs
// Enemy door-opening: non-player enemies with hands (humanoid/undead/demon creature
// type) open closed unlocked doors when they bump into them.  Beasts and constructs
// without hands cannot open doors; locked doors are never opened by enemies.

import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position }     from '../src/rules/components/Position.js';
import { Faction }      from '../src/rules/components/Faction.js';
import { Collider }     from '../src/rules/components/Collider.js';
import { DoorState }    from '../src/rules/components/DoorState.js';
import { Interactable } from '../src/rules/components/Interactable.js';
import { Player }       from '../src/rules/components/Player.js';
import { CreatureType, CREATURE_TYPES } from '../src/rules/components/CreatureType.js';
import { resolveBump }  from '../src/rules/data/bumpResolvers.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTiles(doorId, doorX, doorY) {
  const k = `${doorX},${doorY}`;
  return {
    byCell: new Map([[k, [doorId]]]),
    livingByCell: new Map(),
    blockedByCell: new Map([[k, true]]),
    interactableByCell: new Map([[k, doorId]]),
  };
}

function addDoor(world, x, y, { open = false, locked = false } = {}) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, DoorState, { open, locked });
  world.add(id, Collider, { solid: !open, blocksSight: !open });
  world.add(id, Interactable, { action: 'toggleDoor' });
  return id;
}

// ── Door-capable creature types ───────────────────────────────────────────────

Deno.test("humanoid enemy opens closed unlocked door", () => {
  const world = new World({ seed: 1 });
  const enemy = world.create();
  world.add(enemy, Position, { x: 3, y: 5 });
  world.add(enemy, Faction, { key: 'enemy' });
  world.add(enemy, CreatureType, { type: CREATURE_TYPES.humanoid });

  const door = addDoor(world, 4, 5);
  const tiles = makeTiles(door, 4, 5);

  const handled = resolveBump(world, enemy, { nx: 4, ny: 5, mdx: 1, mdy: 0, target: 0, tiles });

  assert(handled, 'humanoid enemy bump should be handled');
  assertEquals(world.get(door, DoorState).open, true, 'door should now be open');
});

Deno.test("undead enemy opens closed unlocked door", () => {
  const world = new World({ seed: 2 });
  const enemy = world.create();
  world.add(enemy, Position, { x: 3, y: 5 });
  world.add(enemy, Faction, { key: 'enemy' });
  world.add(enemy, CreatureType, { type: CREATURE_TYPES.undead });

  const door = addDoor(world, 4, 5);
  const tiles = makeTiles(door, 4, 5);

  resolveBump(world, enemy, { nx: 4, ny: 5, mdx: 1, mdy: 0, target: 0, tiles });

  assertEquals(world.get(door, DoorState).open, true, 'undead enemy should open door');
});

Deno.test("demon enemy opens closed unlocked door", () => {
  const world = new World({ seed: 3 });
  const enemy = world.create();
  world.add(enemy, Position, { x: 3, y: 5 });
  world.add(enemy, Faction, { key: 'enemy' });
  world.add(enemy, CreatureType, { type: CREATURE_TYPES.demon });

  const door = addDoor(world, 4, 5);
  const tiles = makeTiles(door, 4, 5);

  resolveBump(world, enemy, { nx: 4, ny: 5, mdx: 1, mdy: 0, target: 0, tiles });

  assertEquals(world.get(door, DoorState).open, true, 'demon enemy should open door');
});

// ── Creatures without hands ───────────────────────────────────────────────────

Deno.test("beast enemy cannot open door", () => {
  const world = new World({ seed: 4 });
  const beast = world.create();
  world.add(beast, Position, { x: 3, y: 5 });
  world.add(beast, Faction, { key: 'enemy' });
  world.add(beast, CreatureType, { type: CREATURE_TYPES.beast });

  const door = addDoor(world, 4, 5);
  const tiles = makeTiles(door, 4, 5);

  resolveBump(world, beast, { nx: 4, ny: 5, mdx: 1, mdy: 0, target: 0, tiles });

  assertEquals(world.get(door, DoorState).open, false, 'beast should NOT open door');
});

Deno.test("construct enemy cannot open door", () => {
  const world = new World({ seed: 5 });
  const construct = world.create();
  world.add(construct, Position, { x: 3, y: 5 });
  world.add(construct, Faction, { key: 'enemy' });
  world.add(construct, CreatureType, { type: CREATURE_TYPES.construct });

  const door = addDoor(world, 4, 5);
  const tiles = makeTiles(door, 4, 5);

  resolveBump(world, construct, { nx: 4, ny: 5, mdx: 1, mdy: 0, target: 0, tiles });

  assertEquals(world.get(door, DoorState).open, false, 'construct should NOT open door');
});

// ── Locked doors are never opened by enemies ─────────────────────────────────

Deno.test("humanoid enemy cannot open locked door", () => {
  const world = new World({ seed: 6 });
  const enemy = world.create();
  world.add(enemy, Position, { x: 3, y: 5 });
  world.add(enemy, Faction, { key: 'enemy' });
  world.add(enemy, CreatureType, { type: CREATURE_TYPES.humanoid });

  const door = addDoor(world, 4, 5, { locked: true });
  const tiles = makeTiles(door, 4, 5);

  const handled = resolveBump(world, enemy, { nx: 4, ny: 5, mdx: 1, mdy: 0, target: 0, tiles });

  assertEquals(world.get(door, DoorState).open, false, 'locked door should NOT be opened');
});

// ── Already-open door is not "re-opened" ─────────────────────────────────────

Deno.test("already-open door is not handled by enemy-door-open resolver", () => {
  const world = new World({ seed: 7 });
  const enemy = world.create();
  world.add(enemy, Position, { x: 3, y: 5 });
  world.add(enemy, Faction, { key: 'enemy' });
  world.add(enemy, CreatureType, { type: CREATURE_TYPES.humanoid });

  const door = addDoor(world, 4, 5, { open: true }); // already open
  const tiles = makeTiles(door, 4, 5);

  const handled = resolveBump(world, enemy, { nx: 4, ny: 5, mdx: 1, mdy: 0, target: 0, tiles });

  // open door won't match enemyDoorOpen (open=true), so resolver skips it
  assert(!handled, 'enemy-door-open resolver should not fire for an open door');
});

// ── Shopkeeper / townfolk are never intercepted ───────────────────────────────

Deno.test("shopkeeper (humanoid) is NOT intercepted by enemyDoorOpen — uses own door logic", () => {
  const world = new World({ seed: 9 });
  const shopkeeper = world.create();
  world.add(shopkeeper, Position, { x: 3, y: 5 });
  world.add(shopkeeper, Faction, { key: 'shopkeeper' }); // not 'enemy'
  world.add(shopkeeper, CreatureType, { type: CREATURE_TYPES.humanoid });

  const door = addDoor(world, 4, 5);
  const tiles = makeTiles(door, 4, 5);

  // enemyDoorOpen must not fire for shopkeepers
  const handled = resolveBump(world, shopkeeper, { nx: 4, ny: 5, mdx: 1, mdy: 0, target: 0, tiles });

  assertEquals(world.get(door, DoorState).open, false, 'shopkeeper should NOT be intercepted by enemyDoorOpen');
});

Deno.test("townfolk (humanoid) is NOT intercepted by enemyDoorOpen — uses own door logic", () => {
  const world = new World({ seed: 10 });
  const npc = world.create();
  world.add(npc, Position, { x: 3, y: 5 });
  world.add(npc, Faction, { key: 'townfolk' }); // not 'enemy'
  world.add(npc, CreatureType, { type: CREATURE_TYPES.humanoid });

  const door = addDoor(world, 4, 5);
  const tiles = makeTiles(door, 4, 5);

  // enemyDoorOpen must not fire for townfolk
  resolveBump(world, npc, { nx: 4, ny: 5, mdx: 1, mdy: 0, target: 0, tiles });

  assertEquals(world.get(door, DoorState).open, false, 'townfolk should NOT be intercepted by enemyDoorOpen');
});

Deno.test("player bumps door via bump:interact, not enemyDoorOpen", () => {
  const world = new World({ seed: 8 });
  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 3, y: 5 });
  world.add(player, CreatureType, { type: CREATURE_TYPES.humanoid });

  const door = addDoor(world, 4, 5);
  const tiles = makeTiles(door, 4, 5);

  let interactFired = false;
  world.on('bump:interact', () => { interactFired = true; });

  resolveBump(world, player, { nx: 4, ny: 5, mdx: 1, mdy: 0, target: 0, tiles });

  assert(interactFired, 'player should use bump:interact (not enemyDoorOpen)');
  // Player does NOT directly open the door through enemyDoorOpen
  // (the interactionSystem handles the actual door state change)
  assertEquals(world.get(door, DoorState).open, false, 'door stays closed until interactionSystem processes it');
});
