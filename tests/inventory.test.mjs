import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Player } from '../src/rules/components/Player.js';
import { Position } from '../src/rules/components/Position.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { Inventory } from '../src/rules/components/Inventory.js';
import { PickupIntent } from '../src/rules/components/Intents/PickupIntent.js';
import { DropIntent } from '../src/rules/components/Intents/DropIntent.js';
import { itemPickupSystem } from '../src/rules/systems/itemPickupSystem.js';
import { itemDropSystem } from '../src/rules/systems/itemDropSystem.js';
import { createPlayer } from '../src/rules/archetypes/Player.js';

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

Deno.test("inventory: pickup, stacking, weight denial, capacity denial, and drop", () => {
  const world = new World({ seed: 42 });
  world.setScheduler((w) => scheduler(w));

  const events = [];
  world.on('item:pickup-denied', (p) => events.push(['denied', p.reason]));
  world.on('item:pickup', (p) => events.push(['pickup', p.count]));
  world.on('item:dropped', (p) => events.push(['drop', p.count]));

  const player = createPlayer(world, { x: 1, y: 2, capacity: 1, weightLimit: 5 });
  const pos = world.get(player, Position);
  const inv = world.get(player, Inventory);

  const a = makeItem(world, { name: 'Shard', identity: 'shard', weight: 1, count: 3, x: pos.x, y: pos.y });
  const b = makeItem(world, { name: 'Shard', identity: 'shard', weight: 1, count: 2, x: pos.x, y: pos.y });
  const c = makeItem(world, { name: 'Shard', identity: 'shard', weight: 10, count: 1, x: pos.x, y: pos.y });

  // pickup a (fills one slot)
  world.add(player, PickupIntent, { targetId: a });
  world.tick(1);
  assert(inv.items.length === 1, 'picked first stack');
  const invItem = inv.items[0];
  assert(world.get(invItem, ItemInfo).count === 3, 'count 3 in inventory');

  // pickup b should stack despite capacity 1
  world.add(player, PickupIntent, { targetId: b });
  world.tick(1);
  assert(inv.items.length === 1, 'still one stack');
  assert(world.get(invItem, ItemInfo).count === 5, 'stacked to 5');
  assert(!world.isAlive(b), 'second stack entity destroyed');

  // weight denial
  world.add(player, PickupIntent, { targetId: c });
  world.tick(1);
  assert(events.some(e => e[0] === 'denied' && e[1] === 'weight'), 'weight denial emitted');
  assert(inv.items.length === 1, 'no extra stack');

  // capacity denial
  const d = makeItem(world, { name: 'Twig', identity: 'twig', weight: 1, count: 1, x: pos.x, y: pos.y });
  world.add(player, PickupIntent, { targetId: d });
  world.tick(1);
  assert(events.some(e => e[0] === 'denied' && e[1] === 'capacity'), 'capacity denial emitted');

  // drop subset of stack (drop 2 of 5)
  world.add(player, DropIntent, { itemId: invItem, count: 2 });
  world.tick(1);
  assert(world.get(invItem, ItemInfo).count === 3, 'inventory reduced to 3');
  let droppedAtTile = 0; let dropId = 0;
  for (const [eid, p] of world.query(Position)) { if (p.x === pos.x && p.y === pos.y && world.has(eid, ItemInfo)) { droppedAtTile++; dropId = eid; } }
  assert(droppedAtTile >= 1, 'something dropped on ground');
  assert(world.get(dropId, ItemInfo).count === 2, 'dropped count 2');

  // targetId mismatch
  const cpos = world.get(c, Position); if (cpos) { cpos.x = pos.x + 999; }
  world.add(player, PickupIntent, { targetId: c });
  world.tick(1);
  assert(inv.items.length === 1, 'mismatch no-op');
});
