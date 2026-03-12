import { assert, assertEquals } from "jsr:@std/assert";
import { children, World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { Inventory } from '../src/rules/components/Inventory.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { Faction } from '../src/rules/components/Faction.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { ActiveEffects } from '../src/rules/components/ActiveEffects.js';
import { ProcPackageNode } from '../src/rules/components/ProcPackageNode.js';
import { AttackIntent } from '../src/rules/components/Intents/AttackIntent.js';
import { RangedAttackIntent } from '../src/rules/components/Intents/RangedAttackIntent.js';
import { combatSystem } from '../src/rules/systems/combatSystem.js';
import { rangedAttackSystem } from '../src/rules/systems/rangedAttackSystem.js';
import { inventoryContains, addToInventory, inventoryItems } from '../src/rules/utils/inventoryFacade.js';
import { loadChunk, clearAll } from '../src/rules/environment/dungeon/tileMap.js';
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL } from '../src/rules/environment/dungeon/constants.js';
import { buildCatalogItem } from '../src/rules/data/itemCatalogLoader.js';

function makeBow(world) {
  const id = world.create();
  world.add(id, ItemInfo, {
    type: 'equip', slot: 'ranged', weight: 1, value: 0, description: 'Short Bow',
    count: 1, bonuses: { attack: 1 }, rarity: 1, rarityName: 'common', affixes: [],
    damageDice: '1d6', subtype: 'bow', range: 8,
  });
  return id;
}

function makeAmmo(world, countOrOpts = 10) {
  const opts = (countOrOpts && typeof countOrOpts === 'object')
    ? countOrOpts
    : { count: countOrOpts };
  const count = Number(opts.count ?? 10) | 0;
  const id = world.create();
  const subtype = opts.subtype ? String(opts.subtype) : null;
  world.add(id, ItemInfo, {
    type: 'ammo', slot: '', weight: 0, value: 0, description: 'Arrows',
    count, bonuses: {}, rarity: 1, rarityName: 'common', affixes: [],
    subtype,
  });
  if (opts.identity) {
    world.add(id, NamedIdentity, {
      name: String(opts.name || 'Arrows'),
      identity: String(opts.identity),
    });
  }
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

/** Place a wall tile in the tileMap at (x,y) within a floor-filled chunk. */
function placeWallInTileMap(x, y) {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  tiles[y * CHUNK_SIZE + x] = TILE_WALL;
  loadChunk(0, 0, tiles);
}

function setup(opts = {}) {
  clearAll(); // Reset tileMap between tests
  const world = new World({ seed: opts.seed || 99 });
  world.step = opts.step || 1;

  const bowId = makeBow(world);
  const ammoId = makeAmmo(world, {
    count: opts.ammoCount ?? 10,
    subtype: opts.ammoSubtype,
    identity: opts.ammoIdentity,
    name: opts.ammoName,
  });

  const archer = world.create();
  world.add(archer, Position, { x: opts.ax ?? 0, y: opts.ay ?? 0 });
  world.add(archer, Vitality, { maxHp: 20, hp: 20 });
  world.add(archer, Equipment, { ranged: bowId, attackDerived: 1 });
  world.add(archer, Inventory, { capacity: 20 });
  addToInventory(world, archer, bowId);
  addToInventory(world, archer, ammoId);
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
  for (const ev of ['ranged:shot', 'ranged:no-ammo', 'ranged:blocked', 'ranged:out-of-range', 'damaged', 'died', 'proc:burning']) {
    world.on(ev, (data) => events.push({ _event: ev, ...data }));
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
  assert(events.some(e => e._event === 'ranged:shot'), 'ranged:shot emitted');
  assert(events.some(e => e._event === 'damaged'), 'damaged emitted');
});

Deno.test("ranged: no bow (sword equipped) → silent no-op", () => {
  const events = [];
  const { world, archer, target } = setup();
  const swordId = makeSword(world);
  world.set(archer, Equipment, { ranged: swordId, attackDerived: 1 });
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
  // Remove ammo from inventory — keep only bow
  const ammoItems = inventoryItems(world, archer).filter(id => {
    const info = world.get(id, ItemInfo);
    return info && info.type === 'ammo';
  });
  for (const id of ammoItems) world.destroy(id);
  trackEvents(world, events);
  world.add(archer, RangedAttackIntent, { targetId: target, toX: 5, toY: 0 });
  rangedAttackSystem(world);
  assert(!world.has(archer, RangedAttackIntent), 'intent removed');
  assert(events.some(e => e._event === 'ranged:no-ammo'), 'ranged:no-ammo emitted');
  const tv = world.get(target, Vitality);
  assert(tv.hp === 10, 'target undamaged');
});

Deno.test("ranged: LOS blocked by wall → ranged:blocked emitted", () => {
  const events = [];
  const { world, archer, target } = setup();
  placeWallInTileMap(3, 0); // Place wall after setup() since setup calls clearAll()
  trackEvents(world, events);
  world.add(archer, RangedAttackIntent, { targetId: target, toX: 5, toY: 0 });
  rangedAttackSystem(world);
  assert(!world.has(archer, RangedAttackIntent), 'intent removed');
  assert(events.some(e => e._event === 'ranged:blocked'), 'ranged:blocked emitted');
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
  assert(events.some(e => e._event === 'ranged:out-of-range'), 'ranged:out-of-range emitted');
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
  assert(!inventoryContains(world, archer, ammoId), 'ammo removed from inventory');
});

Deno.test("ranged: kill target → died emitted", () => {
  const events = [];
  const { world, archer, target } = setup({ seed: 42, targetHp: 1 });
  trackEvents(world, events);
  world.add(archer, RangedAttackIntent, { targetId: target, toX: 5, toY: 0 });
  rangedAttackSystem(world);
  assert(events.some(e => e._event === 'died' && e.id === target), 'died emitted');
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
  assert(!events.some(e => e._event === 'damaged'), 'no damage event');
});

Deno.test("ranged: player to pet faction is non-hostile", () => {
  const events = [];
  const { world, archer, target } = setup({ archerFaction: 'player', targetFaction: 'pet' });
  trackEvents(world, events);
  world.add(archer, RangedAttackIntent, { targetId: target, toX: 5, toY: 0 });
  rangedAttackSystem(world);
  assert(!world.has(archer, RangedAttackIntent), 'intent removed');
  const tv = world.get(target, Vitality);
  assert(tv.hp === 10, 'pet faction undamaged');
  assert(!events.some(e => e._event === 'damaged'), 'no damage event');
});

Deno.test("buildCatalogItem attaches proc packages for mirror bow", () => {
  const world = new World({ seed: 55 });
  const bowId = buildCatalogItem(world, "bow_mirror");
  const packageChildren = [...children(world, bowId)].filter((id) => world.get(id, ProcPackageNode));
  assertEquals(packageChildren.length, 1);
  assertEquals(world.get(packageChildren[0], ProcPackageNode)?.packageId, "ricochetTheology");
});

Deno.test("ranged: mirror bow ricochets in live combat when target is wall-adjacent", () => {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  tiles[3 * CHUNK_SIZE + 4] = TILE_WALL;
  loadChunk(0, 0, tiles);

  const world = new World({ seed: 13 });
  world.step = 1;
  const projectileEvents = [];
  world.on("projectile:spawn", (payload) => projectileEvents.push(payload));

  const bowId = buildCatalogItem(world, "bow_mirror");
  const ammoId = makeAmmo(world, 10);
  const archer = world.create();
  world.add(archer, Position, { x: 2, y: 4 });
  world.add(archer, Vitality, { maxHp: 20, hp: 20 });
  world.add(archer, Equipment, { ranged: bowId, ammo: ammoId, attackDerived: 1 });
  world.add(archer, Inventory, { capacity: 20 });
  world.add(archer, Faction, { key: "player" });
  addToInventory(world, archer, bowId);
  addToInventory(world, archer, ammoId);

  const target = world.create();
  world.add(target, Position, { x: 4, y: 4 });
  world.add(target, Vitality, { maxHp: 20, hp: 20 });
  world.add(target, Equipment, { defenseDerived: 0 });
  world.add(target, Faction, { key: "enemy" });

  const bystanderA = world.create();
  world.add(bystanderA, Position, { x: 5, y: 4 });
  world.add(bystanderA, Vitality, { maxHp: 20, hp: 20 });
  world.add(bystanderA, Faction, { key: "enemy" });
  world.add(bystanderA, ActiveEffects, { effects: [] });

  const bystanderB = world.create();
  world.add(bystanderB, Position, { x: 5, y: 5 });
  world.add(bystanderB, Vitality, { maxHp: 20, hp: 20 });
  world.add(bystanderB, ActiveEffects, { effects: [] });

  const backward = world.create();
  world.add(backward, Position, { x: 3, y: 4 });
  world.add(backward, Vitality, { maxHp: 20, hp: 20 });
  world.add(backward, Faction, { key: "enemy" });
  world.add(backward, ActiveEffects, { effects: [] });

  world.add(archer, RangedAttackIntent, { targetId: target, toX: 4, toY: 4 });
  rangedAttackSystem(world);

  assertEquals(projectileEvents.length, 2);
  assert(world.get(bystanderA, Vitality).hp < 20, "first ricochet target should take damage");
  assert(world.get(bystanderB, Vitality).hp < 20, "forward non-hostile target should take damage");
  assertEquals(world.get(backward, Vitality).hp, 20, "backward target should be ignored");
});

Deno.test("combat: mirror bow proc does not fire on melee hits", () => {
  clearAll();
  const world = new World({ seed: 42 });
  world.step = 1;
  const projectileEvents = [];
  world.on("projectile:spawn", (payload) => projectileEvents.push(payload));

  const bowId = buildCatalogItem(world, "bow_mirror");
  const swordId = makeSword(world);
  const hero = world.create();
  world.add(hero, Position, { x: 1, y: 1 });
  world.add(hero, Vitality, { maxHp: 20, hp: 20 });
  world.add(hero, Equipment, { weapon: swordId, ranged: bowId });
  world.add(hero, Faction, { key: "player" });

  const foe = world.create();
  world.add(foe, Position, { x: 1, y: 2 });
  world.add(foe, Vitality, { maxHp: 20, hp: 20 });
  world.add(foe, Equipment, { defenseDerived: 0 });
  world.add(foe, Faction, { key: "enemy" });

  const spectator = world.create();
  world.add(spectator, Position, { x: 1, y: 3 });
  world.add(spectator, Vitality, { maxHp: 20, hp: 20 });
  world.add(spectator, Faction, { key: "enemy" });

  world.add(hero, AttackIntent, { targetId: foe });
  combatSystem(world);

  assertEquals(projectileEvents.length, 0);
  assertEquals(world.get(spectator, Vitality).hp, 20, "melee should not trigger bow ricochet");
});

Deno.test("ranged: fire ammo actor-impact hooks add damage and burning", () => {
  const baseline = setup({ seed: 42, targetHp: 30 });
  baseline.world.add(baseline.archer, RangedAttackIntent, { targetId: baseline.target, toX: 5, toY: 0 });
  rangedAttackSystem(baseline.world);
  const baselineHp = baseline.world.get(baseline.target, Vitality).hp;

  const events = [];
  const fire = setup({
    seed: 42,
    targetHp: 30,
    ammoSubtype: 'fire',
    ammoIdentity: 'ammo_fire_arrows',
    ammoName: 'Fire Arrows',
  });
  trackEvents(fire.world, events);
  fire.world.add(fire.archer, RangedAttackIntent, { targetId: fire.target, toX: 5, toY: 0 });
  rangedAttackSystem(fire.world);

  const fireHp = fire.world.get(fire.target, Vitality).hp;
  const ae = fire.world.get(fire.target, ActiveEffects);
  const hasBurn = !!(ae && Array.isArray(ae.effects) && ae.effects.some((e) => e.key === 'burn'));

  assert(fireHp <= baselineHp - 1, `fire ammo should add at least +1 damage (baselineHp=${baselineHp}, fireHp=${fireHp})`);
  assert(hasBurn, 'fire ammo should apply burn via actor-impact hook');
  assert(events.some((e) => e._event === 'proc:burning'), 'fire ammo should emit proc:burning');
});
