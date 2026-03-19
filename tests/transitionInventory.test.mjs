import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Player } from '../src/rules/components/Player.js';
import { Inventory } from '../src/rules/components/Inventory.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { DungeonState } from '../src/rules/components/DungeonState.js';
import { transitionToDepth, clearFloorCache } from '../src/rules/environment/dungeon/transition.js';
import { initDungeon } from '../src/rules/environment/dungeon/index.js';
import { clearAll } from '../src/rules/environment/dungeon/tileMap.js';
import { addToInventory, inventoryItems } from '../src/rules/utils/inventoryFacade.js';

function setup() {
  clearAll();
  clearFloorCache();
  const world = new World({ seed: 42 });
  const spawn = initDungeon(world);

  // Create player with inventory
  const pid = world.create();
  world.add(pid, Player, {});
  world.add(pid, Position, { x: spawn.x, y: spawn.y });
  world.add(pid, Inventory, { capacity: 20 });
  world.add(pid, Equipment, {});

  // Create starting items and add to inventory
  const items = [];
  for (const identity of ['axe_heavy', 'potion_health', 'hearthstone']) {
    const iid = world.create();
    world.add(iid, ItemInfo, { count: 1, weight: 1 });
    world.add(iid, NamedIdentity, { name: identity, identity });
    addToInventory(world, pid, iid, { silent: true });
    items.push(iid);
  }

  // Equip the axe
  world.mutate(pid, Equipment, eq => { eq.weapon = items[0]; });

  return { world, pid, items };
}

Deno.test("inventory survives single round-trip overworld→dungeon→overworld", () => {
  const { world, pid, items } = setup();

  // Overworld (depth 0) → dungeon (depth 1)
  transitionToDepth(world, 1, { x: 5, y: 5 });

  let inv = inventoryItems(world, pid);
  assert(inv.length === 3, `after descent: expected 3 items, got ${inv.length}`);
  for (const iid of items) {
    assert(world.isAlive(iid), `item ${iid} should be alive after descent`);
  }

  // Dungeon (depth 1) → overworld (depth 0)
  transitionToDepth(world, 0, { x: 5, y: 5 });

  inv = inventoryItems(world, pid);
  assert(inv.length === 3, `after ascent: expected 3 items, got ${inv.length}`);
  for (const iid of items) {
    assert(world.isAlive(iid), `item ${iid} should be alive after ascent`);
  }
});

Deno.test("inventory survives TWO round-trips (the zombie hierarchy bug)", () => {
  const { world, pid, items } = setup();

  // First round-trip
  transitionToDepth(world, 1, { x: 5, y: 5 });
  transitionToDepth(world, 0, { x: 5, y: 5 });

  // Second round-trip — this is where the bug manifested
  transitionToDepth(world, 1, { x: 5, y: 5 });

  let inv = inventoryItems(world, pid);
  assert(inv.length === 3, `after 2nd descent: expected 3 items, got ${inv.length}`);
  for (const iid of items) {
    assert(world.isAlive(iid), `item ${iid} should be alive after 2nd descent`);
  }

  transitionToDepth(world, 0, { x: 5, y: 5 });

  inv = inventoryItems(world, pid);
  assert(inv.length === 3, `after 2nd ascent: expected 3 items, got ${inv.length}`);
});

Deno.test("floor-picked items survive transition (not destroyed with floor entities)", () => {
  const { world, pid, items } = setup();

  // Descend to dungeon depth 1
  transitionToDepth(world, 1, { x: 5, y: 5 });

  // Simulate picking up a floor item: create an item, register it in floorEntityIds,
  // then add it to the player's inventory (same as itemPickupSystem does).
  const floorItemId = world.create();
  world.add(floorItemId, ItemInfo, { count: 1, weight: 1 });
  world.add(floorItemId, NamedIdentity, { name: 'cave_mushroom', identity: 'cave_mushroom' });
  world.add(floorItemId, Position, { x: 5, y: 5 });
  // Register in floorEntityIds as the real system would
  const [, ds] = [...world.query(DungeonState)][0];
  ds.floorEntityIds.push(floorItemId);
  // Pick it up (removes Position, re-parents to inventory)
  addToInventory(world, pid, floorItemId, { silent: true });

  // Transition to depth 2 — this destroys depth 1 floor, including floorItemId
  transitionToDepth(world, 2, { x: 5, y: 5 });

  assert(world.isAlive(floorItemId), `floor-picked item should survive transition to depth 2`);
  const inv = inventoryItems(world, pid);
  assert(inv.length === 4, `expected 4 items after picking up floor item, got ${inv.length}`);

  // Ascend back — this is the exact scenario the user reported
  transitionToDepth(world, 1, { x: 5, y: 5 });

  assert(world.isAlive(floorItemId), `floor-picked item should survive return to depth 1`);
  const inv2 = inventoryItems(world, pid);
  assert(inv2.length === 4, `inventory should still have 4 items on return, got ${inv2.length}`);
});

Deno.test("equipment references survive two round-trips", () => {
  const { world, pid, items } = setup();

  // Two full round-trips
  transitionToDepth(world, 1, { x: 5, y: 5 });
  transitionToDepth(world, 0, { x: 5, y: 5 });
  transitionToDepth(world, 1, { x: 5, y: 5 });
  transitionToDepth(world, 0, { x: 5, y: 5 });

  const eq = world.get(pid, Equipment);
  assert(eq.weapon === items[0], `equipped weapon should still reference original item`);
  assert(world.isAlive(items[0]), `equipped item should be alive`);
});
