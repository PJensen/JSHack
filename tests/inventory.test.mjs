import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { createFrom } from "../src/lib/ecs-js/archetype.js";
import { Player } from '../src/rules/components/Player.js';
import { Position } from '../src/rules/components/Position.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { Equipment } from "../src/rules/components/Equipment.js";
import { PickupIntent } from '../src/rules/components/Intents/PickupIntent.js';
import { DropIntent } from '../src/rules/components/Intents/DropIntent.js';
import { EquipIntent } from '../src/rules/components/Intents/EquipIntent.js';
import { itemPickupSystem } from '../src/rules/systems/itemPickupSystem.js';
import { itemDropSystem } from '../src/rules/systems/itemDropSystem.js';
import { equipItemSystem } from '../src/rules/systems/equipItemSystem.js';
import { createPlayer } from '../src/rules/archetypes/Player.js';
import {
  addToInventory,
  inventoryContains,
  inventoryItems,
} from '../src/rules/utils/inventoryFacade.js';
import {
  ArrowsStack,
  FireArrowsStack,
  PiercingArrowsStack,
  BodkinArrowsStack,
  BluntHeadArrowsStack,
} from "../src/rules/archetypes/Items.js";
import { itemsAt } from '../src/rules/utils/queries.js';

function scheduler(world) {
  try { itemPickupSystem(world); } catch (e) { console.error('pickup system error', e); }
  try { itemDropSystem(world); } catch (e) { console.error('drop system error', e); }
}

function makeItem(world, { name = 'Shard', identity = 'shard', weight = 1, count = 1, x = 0, y = 0 } = {}) {
  const id = world.create();
  world.add(id, NamedIdentity, { name, identity });
  world.add(id, ItemInfo, { type: 'misc', slot: '', weight, value: 0, description: '', count });
  world.add(id, Position, { x, y });
  return id;
}

Deno.test("inventory: pickup, virtual stacking, capacity denial, and drop", () => {
  const world = new World({ seed: 42 });
  world.setScheduler((w) => scheduler(w));

  const events = [];
  world.on('item:pickup-denied', (p) => events.push(['denied', p.reason]));
  world.on('item:pickup', (p) => events.push(['pickup', p.count]));
  world.on('item:dropped', (p) => events.push(['drop', p.count]));

  const player = createPlayer(world, { x: 1, y: 2, capacity: 1, weightLimit: 5 });
  const pos = world.get(player, Position);

  const a = makeItem(world, { name: 'Shard', identity: 'shard', weight: 1, count: 3, x: pos.x, y: pos.y });
  const b = makeItem(world, { name: 'Shard', identity: 'shard', weight: 1, count: 2, x: pos.x, y: pos.y });

  // pickup a (fills one identity slot)
  world.add(player, PickupIntent, { targetId: a });
  world.tick(1);
  assert(inventoryItems(world, player).length === 1, 'picked first stack');
  const invItem = inventoryItems(world, player)[0];
  assert(world.get(invItem, ItemInfo).count === 3, 'count 3 in inventory');

  // pickup b — same identity, both entities persist (virtual stacking), capacity OK
  world.add(player, PickupIntent, { targetId: b });
  world.tick(1);
  assert(inventoryItems(world, player).length === 2, 'both shard entities in inventory');
  assert(world.isAlive(b), 'second entity persists (no entity destruction)');

  // capacity denial — different identity, capacity is 1
  const d = makeItem(world, { name: 'Twig', identity: 'twig', weight: 1, count: 1, x: pos.x, y: pos.y });
  world.add(player, PickupIntent, { targetId: d });
  world.tick(1);
  assert(events.some(e => e[0] === 'denied' && e[1] === 'capacity'), 'capacity denial emitted');

  // drop subset of stack (drop 2 of 3 from invItem a)
  world.add(player, DropIntent, { itemId: invItem, count: 2 });
  world.tick(1);
  assert(world.get(invItem, ItemInfo).count === 1, 'inventory reduced to 1');
  let droppedAtTile = 0; let dropId = 0;
  for (const [eid, p] of world.query(Position)) { if (p.x === pos.x && p.y === pos.y && world.has(eid, ItemInfo)) { droppedAtTile++; dropId = eid; } }
  assert(droppedAtTile >= 1, 'something dropped on ground');
  assert(world.get(dropId, ItemInfo).count === 2, 'dropped count 2');

  // targetId mismatch (item far away)
  const c = makeItem(world, { name: 'Shard', identity: 'shard', weight: 10, count: 1, x: pos.x + 999, y: pos.y });
  world.add(player, PickupIntent, { targetId: c });
  world.tick(1);
  assert(inventoryItems(world, player).length === 2, 'mismatch no-op');
});

Deno.test("inventory: dropped item becomes top of ground stack", () => {
  const world = new World({ seed: 84 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { x: 5, y: 6, capacity: 10, weightLimit: 99 });
  const pos = world.get(player, Position);

  const existingGround = makeItem(world, { name: 'Old Rock', identity: 'old_rock', weight: 1, count: 1, x: pos.x, y: pos.y });
  const invItem = world.create();
  world.add(invItem, NamedIdentity, { name: 'Health Potion', identity: 'potion_health' });
  world.add(invItem, ItemInfo, { type: 'potion', slot: '', weight: 1, value: 0, description: '', count: 1 });
  addToInventory(world, player, invItem);

  world.add(player, DropIntent, { itemId: invItem, count: 1 });
  world.tick(1);

  const onTile = itemsAt(world, pos.x, pos.y);
  assert(onTile.length >= 2, 'expected at least two items on ground tile');
  assert(onTile[0] === invItem, 'most recently dropped item should be on top of ground stack');
  assert(onTile.includes(existingGround), 'existing ground item should remain on tile');
});

Deno.test("inventory: all arrow stack types can be dropped, including equipped ammo", () => {
  const world = new World({ seed: 85 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { x: 5, y: 6, capacity: 20, weightLimit: 99 });
  const pos = world.get(player, Position);
  const eq = world.get(player, Equipment);
  assert(eq, "player should have equipment");

  const arrowArchetypes = [
    ArrowsStack,
    FireArrowsStack,
    PiercingArrowsStack,
    BodkinArrowsStack,
    BluntHeadArrowsStack,
  ];

  for (const Arch of arrowArchetypes) {
    const ammoId = createFrom(world, Arch, {});
    addToInventory(world, player, ammoId);
    world.add(player, EquipIntent, { itemId: ammoId });
    equipItemSystem(world);

    assert(eq.ammo === ammoId, "equipped ammo slot should point to ammo");
    assert(!inventoryContains(world, player, ammoId), "equipped ammo should be removed from inventory");

    world.add(player, DropIntent, { itemId: ammoId });
    world.tick(1);

    assert(!inventoryContains(world, player, ammoId), "dropped ammo should leave inventory");
    const dropPos = world.get(ammoId, Position);
    assert(dropPos && dropPos.x === pos.x && dropPos.y === pos.y, "dropped ammo should land at actor tile");
    assert(eq.ammo === null, "dropping equipped ammo should clear ammo slot");
  }
});

Deno.test("inventory: dropping equipped ammo merges into matching ground ammo stack", () => {
  const world = new World({ seed: 86 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { x: 5, y: 6, capacity: 20, weightLimit: 99 });
  const pos = world.get(player, Position);
  const eq = world.get(player, Equipment);
  assert(eq, "player should have equipment");

  const groundAmmo = createFrom(world, ArrowsStack, {});
  world.add(groundAmmo, Position, { x: pos.x, y: pos.y });
  const groundBefore = Math.max(1, Number(world.get(groundAmmo, ItemInfo)?.count || 0) | 0);

  const equippedAmmo = createFrom(world, ArrowsStack, {});
  addToInventory(world, player, equippedAmmo);
  world.add(player, EquipIntent, { itemId: equippedAmmo });
  equipItemSystem(world);
  assert(eq.ammo === equippedAmmo, "ammo should be equipped before drop");

  const equippedBefore = Math.max(1, Number(world.get(equippedAmmo, ItemInfo)?.count || 0) | 0);
  world.add(player, DropIntent, { itemId: equippedAmmo });
  world.tick(1);

  assert(eq.ammo === null, "dropping equipped ammo should clear ammo slot");
  assert(!world.isAlive(equippedAmmo), "dropped ammo entity should merge into existing ground stack");

  const onTile = itemsAt(world, pos.x, pos.y);
  const ammoOnTile = onTile.filter((id) => world.get(id, ItemInfo)?.type === "ammo");
  assert(ammoOnTile.length === 1, "matching ground ammo should be represented by one entity");
  assert(ammoOnTile[0] === groundAmmo, "existing ground ammo should remain as the merged stack carrier");
  assert(world.get(groundAmmo, ItemInfo).count === (groundBefore + equippedBefore), "ground ammo count should increase by dropped count");
});
