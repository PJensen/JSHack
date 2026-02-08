import { assert } from "jsr:@std/assert";
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

function makeBow(world) {
  const id = world.create();
  world.add(id, ItemInfo, {
    type: 'equip', slot: 'weapon', weight: 1, value: 0, description: 'Short Bow',
    count: 1, bonuses: { attack: 1 }, rarity: 1, rarityName: 'common', affixes: [],
    damageDice: '1d6', subtype: 'bow', range: 8,
  });
  return id;
}

function makeAmmo(world, count = 10) {
  const id = world.create();
  world.add(id, ItemInfo, {
    type: 'ammo', slot: '', weight: 0, value: 0, description: 'Arrows',
    count, bonuses: {}, rarity: 1, rarityName: 'common', affixes: [],
  });
  return id;
}

function makeSword(world) {
  const id = world.create();
  world.add(id, ItemInfo, {
    type: 'equip', slot: 'weapon', weight: 1, value: 0, description: 'Sword',
    count: 1, bonuses: { attack: 2 }, rarity: 1, rarityName: 'common', affixes: [],
    damageDice: '1d6', subtype: null, range: null,
  });
  return id;
}

function makeWall(world, x, y) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Terrain, { walkable: false, opaque: true });
  return id;
}

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

function trackEvents(world, events) {
  events.length = 0;
  for (const ev of ['ranged:shot', 'ranged:no-ammo', 'ranged:blocked', 'ranged:out-of-range', 'damaged', 'died']) {
    world.on(ev, (data) => events.push({ type: ev, ...data }));
  }
}

Deno.test("ranged: hit with bow, ammo, LOS clear, in range", () => {
  const events = [];
  const { world, archer, target } = setup({ seed: 42 });
  trackEvents(world, events);
  world.add(archer, RangedAttackIntent, { targetId: target, toX: 5, toY: 0 });
  rangedAttackSystem(world);
  const tv = world.get(target, Vitality);
  assert(tv.hp < 10, `target took damage (hp=${tv.hp})`);
  assert(!world.has(archer, RangedAttackIntent), 'intent removed');
  assert(events.some(e => e.type === 'ranged:shot'), 'ranged:shot emitted');
  assert(events.some(e => e.type === 'damaged'), 'damaged emitted');
});

Deno.test("ranged: no bow (sword equipped) → silent no-op", () => {
  const events = [];
  const { world, archer, target } = setup();
  const swordId = makeSword(world);
  world.set(archer, Equipment, { weapon: swordId, attackDerived: 1 });
  trackEvents(world, events);
  world.add(archer, RangedAttackIntent, { targetId: target, toX: 5, toY: 0 });
  rangedAttackSystem(world);
  assert(!world.has(archer, RangedAttackIntent), 'intent removed');
  assert(events.length === 0, 'no events emitted');
  const tv = world.get(target, Vitality);
  assert(tv.hp === 10, 'target undamaged');
});

Deno.test("ranged: no ammo → ranged:no-ammo emitted", () => {
  const events = [];
  const { world, archer, target } = setup();
  world.set(archer, Inventory, { items: [world.get(archer, Equipment).weapon], capacity: 20 });
  trackEvents(world, events);
  world.add(archer, RangedAttackIntent, { targetId: target, toX: 5, toY: 0 });
  rangedAttackSystem(world);
  assert(!world.has(archer, RangedAttackIntent), 'intent removed');
  assert(events.some(e => e.type === 'ranged:no-ammo'), 'ranged:no-ammo emitted');
  const tv = world.get(target, Vitality);
  assert(tv.hp === 10, 'target undamaged');
});

Deno.test("ranged: LOS blocked by wall → ranged:blocked emitted", () => {
  const events = [];
  const { world, archer, target } = setup();
  makeWall(world, 3, 0);
  trackEvents(world, events);
  world.add(archer, RangedAttackIntent, { targetId: target, toX: 5, toY: 0 });
  rangedAttackSystem(world);
  assert(!world.has(archer, RangedAttackIntent), 'intent removed');
  assert(events.some(e => e.type === 'ranged:blocked'), 'ranged:blocked emitted');
  const tv = world.get(target, Vitality);
  assert(tv.hp === 10, 'target undamaged');
});

Deno.test("ranged: out of range → ranged:out-of-range emitted", () => {
  const events = [];
  const { world, archer, target } = setup({ tx: 15, ty: 0 });
  trackEvents(world, events);
  world.add(archer, RangedAttackIntent, { targetId: target, toX: 15, toY: 0 });
  rangedAttackSystem(world);
  assert(!world.has(archer, RangedAttackIntent), 'intent removed');
  assert(events.some(e => e.type === 'ranged:out-of-range'), 'ranged:out-of-range emitted');
});

Deno.test("ranged: ammo count decrements", () => {
  const events = [];
  const { world, archer, target, ammoId } = setup({ seed: 42 });
  trackEvents(world, events);
  world.add(archer, RangedAttackIntent, { targetId: target, toX: 5, toY: 0 });
  rangedAttackSystem(world);
  const ammoInfo = world.get(ammoId, ItemInfo);
  assert(ammoInfo && ammoInfo.count === 9, `ammo decremented (count=${ammoInfo?.count})`);
});

Deno.test("ranged: last ammo → entity destroyed", () => {
  const events = [];
  const { world, archer, target, ammoId } = setup({ seed: 42, ammoCount: 1 });
  trackEvents(world, events);
  world.add(archer, RangedAttackIntent, { targetId: target, toX: 5, toY: 0 });
  rangedAttackSystem(world);
  assert(!world.isAlive(ammoId), 'ammo entity destroyed');
  const inv = world.get(archer, Inventory);
  assert(!inv.items.includes(ammoId), 'ammo removed from inventory');
});

Deno.test("ranged: kill target → died emitted", () => {
  const events = [];
  const { world, archer, target } = setup({ seed: 42, targetHp: 1 });
  trackEvents(world, events);
  world.add(archer, RangedAttackIntent, { targetId: target, toX: 5, toY: 0 });
  rangedAttackSystem(world);
  assert(events.some(e => e.type === 'died' && e.id === target), 'died emitted');
});

Deno.test("ranged: same faction → no damage", () => {
  const events = [];
  const { world, archer, target } = setup({ archerFaction: 'player', targetFaction: 'player' });
  trackEvents(world, events);
  world.add(archer, RangedAttackIntent, { targetId: target, toX: 5, toY: 0 });
  rangedAttackSystem(world);
  assert(!world.has(archer, RangedAttackIntent), 'intent removed');
  const tv = world.get(target, Vitality);
  assert(tv.hp === 10, 'same faction undamaged');
  assert(!events.some(e => e.type === 'damaged'), 'no damage event');
});
