import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { Inventory } from '../src/rules/components/Inventory.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { Faction } from '../src/rules/components/Faction.js';
import { RangedAttackIntent } from '../src/rules/components/Intents/RangedAttackIntent.js';
import { Terrain } from '../src/rules/components/Terrain.js';
import { rangedAttackSystem } from '../src/rules/systems/rangedAttackSystem.js';

function assert(c, m) { if (!c) throw new Error('Assertion failed: ' + m); }

/** Create a bow item entity and return its id. */
function makeBow(world) {
  const id = world.create();
  world.add(id, ItemInfo, {
    type: 'equip', slot: 'weapon', weight: 1, value: 0, description: 'Short Bow',
    count: 1, bonuses: { attack: 1 }, rarity: 1, rarityName: 'common', affixes: [],
    damageDice: '1d6', subtype: 'bow', range: 8,
  });
  return id;
}

/** Create an ammo item entity and return its id. */
function makeAmmo(world, count = 10) {
  const id = world.create();
  world.add(id, ItemInfo, {
    type: 'ammo', slot: '', weight: 0, value: 0, description: 'Arrows',
    count, bonuses: {}, rarity: 1, rarityName: 'common', affixes: [],
  });
  return id;
}

/** Create a melee weapon (sword). */
function makeSword(world) {
  const id = world.create();
  world.add(id, ItemInfo, {
    type: 'equip', slot: 'weapon', weight: 1, value: 0, description: 'Sword',
    count: 1, bonuses: { attack: 2 }, rarity: 1, rarityName: 'common', affixes: [],
    damageDice: '1d6', subtype: null, range: null,
  });
  return id;
}

/** Create a wall tile at (x, y). */
function makeWall(world, x, y) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Terrain, { walkable: false, opaque: true });
  return id;
}

/** Basic archer + target setup at given positions. */
function setup(opts = {}) {
  const world = new World({ seed: opts.seed || 99 });
  world.step = opts.step || 1;

  const bowId = makeBow(world);
  const ammoId = makeAmmo(world, opts.ammoCount ?? 10);

  const archer = world.create();
  world.add(archer, Position, { x: opts.ax ?? 0, y: opts.ay ?? 0 });
  world.add(archer, Vitality, { maxHp: 20, hp: 20 });
  world.add(archer, Equipment, { weapon: bowId, attackDerived: 1 });
  world.add(archer, Inventory, { items: [bowId, ammoId], capacity: 20 });
  world.add(archer, Faction, { key: opts.archerFaction || 'player' });

  const target = world.create();
  world.add(target, Position, { x: opts.tx ?? 5, y: opts.ty ?? 0 });
  world.add(target, Vitality, { maxHp: opts.targetHp ?? 10, hp: opts.targetHp ?? 10 });
  world.add(target, Equipment, { defenseDerived: 0 });
  world.add(target, Faction, { key: opts.targetFaction || 'enemy' });

  return { world, archer, target, bowId, ammoId };
}

async function run() {
  const events = [];
  function trackEvents(world) {
    events.length = 0;
    for (const ev of ['ranged:shot', 'ranged:no-ammo', 'ranged:blocked', 'ranged:out-of-range', 'damaged', 'died']) {
      world.on(ev, (data) => events.push({ type: ev, ...data }));
    }
  }

  // 1. Hit: bow equipped, ammo, LOS clear, in range → damage applied
  {
    const { world, archer, target } = setup({ seed: 42 });
    trackEvents(world);
    world.add(archer, RangedAttackIntent, { targetId: target, toX: 5, toY: 0 });
    rangedAttackSystem(world);
    const tv = world.get(target, Vitality);
    assert(tv.hp < 10, `1. target took damage (hp=${tv.hp})`);
    assert(!world.has(archer, RangedAttackIntent), '1. intent removed');
    assert(events.some(e => e.type === 'ranged:shot'), '1. ranged:shot emitted');
    assert(events.some(e => e.type === 'damaged'), '1. damaged emitted');
  }

  // 2. No bow (sword equipped) → intent consumed silently
  {
    const { world, archer, target, ammoId } = setup();
    const swordId = makeSword(world);
    world.set(archer, Equipment, { weapon: swordId, attackDerived: 1 });
    trackEvents(world);
    world.add(archer, RangedAttackIntent, { targetId: target, toX: 5, toY: 0 });
    rangedAttackSystem(world);
    assert(!world.has(archer, RangedAttackIntent), '2. intent removed');
    assert(events.length === 0, '2. no events emitted');
    const tv = world.get(target, Vitality);
    assert(tv.hp === 10, '2. target undamaged');
  }

  // 3. No ammo → ranged:no-ammo emitted
  {
    const { world, archer, target, ammoId } = setup();
    // Remove ammo from inventory
    world.set(archer, Inventory, { items: [world.get(archer, Equipment).weapon], capacity: 20 });
    trackEvents(world);
    world.add(archer, RangedAttackIntent, { targetId: target, toX: 5, toY: 0 });
    rangedAttackSystem(world);
    assert(!world.has(archer, RangedAttackIntent), '3. intent removed');
    assert(events.some(e => e.type === 'ranged:no-ammo'), '3. ranged:no-ammo emitted');
    const tv = world.get(target, Vitality);
    assert(tv.hp === 10, '3. target undamaged');
  }

  // 4. LOS blocked by wall → ranged:blocked emitted
  {
    const { world, archer, target } = setup();
    makeWall(world, 3, 0); // wall between archer(0,0) and target(5,0)
    trackEvents(world);
    world.add(archer, RangedAttackIntent, { targetId: target, toX: 5, toY: 0 });
    rangedAttackSystem(world);
    assert(!world.has(archer, RangedAttackIntent), '4. intent removed');
    assert(events.some(e => e.type === 'ranged:blocked'), '4. ranged:blocked emitted');
    const tv = world.get(target, Vitality);
    assert(tv.hp === 10, '4. target undamaged');
  }

  // 5. Out of range → ranged:out-of-range emitted
  {
    const { world, archer, target } = setup({ tx: 15, ty: 0 }); // 15 tiles > range 8
    trackEvents(world);
    world.add(archer, RangedAttackIntent, { targetId: target, toX: 15, toY: 0 });
    rangedAttackSystem(world);
    assert(!world.has(archer, RangedAttackIntent), '5. intent removed');
    assert(events.some(e => e.type === 'ranged:out-of-range'), '5. ranged:out-of-range emitted');
  }

  // 6. Ammo count decrements (10 → 9)
  {
    const { world, archer, target, ammoId } = setup({ seed: 42 });
    trackEvents(world);
    world.add(archer, RangedAttackIntent, { targetId: target, toX: 5, toY: 0 });
    rangedAttackSystem(world);
    const ammoInfo = world.get(ammoId, ItemInfo);
    assert(ammoInfo && ammoInfo.count === 9, `6. ammo decremented (count=${ammoInfo?.count})`);
  }

  // 7. Last ammo → entity destroyed
  {
    const { world, archer, target, ammoId } = setup({ seed: 42, ammoCount: 1 });
    trackEvents(world);
    world.add(archer, RangedAttackIntent, { targetId: target, toX: 5, toY: 0 });
    rangedAttackSystem(world);
    assert(!world.isAlive(ammoId), '7. ammo entity destroyed');
    // Ammo removed from inventory
    const inv = world.get(archer, Inventory);
    assert(!inv.items.includes(ammoId), '7. ammo removed from inventory');
  }

  // 8. Kill target → died emitted
  {
    const { world, archer, target } = setup({ seed: 42, targetHp: 1 });
    trackEvents(world);
    world.add(archer, RangedAttackIntent, { targetId: target, toX: 5, toY: 0 });
    rangedAttackSystem(world);
    assert(events.some(e => e.type === 'died' && e.id === target), '8. died emitted');
  }

  // 9. Same faction → no damage
  {
    const { world, archer, target } = setup({ archerFaction: 'player', targetFaction: 'player' });
    trackEvents(world);
    world.add(archer, RangedAttackIntent, { targetId: target, toX: 5, toY: 0 });
    rangedAttackSystem(world);
    assert(!world.has(archer, RangedAttackIntent), '9. intent removed');
    const tv = world.get(target, Vitality);
    assert(tv.hp === 10, '9. same faction undamaged');
    assert(!events.some(e => e.type === 'damaged'), '9. no damage event');
  }

  console.log('Ranged attack tests PASS');
}
run().catch(e => { console.error(e); process.exitCode = 1; });
