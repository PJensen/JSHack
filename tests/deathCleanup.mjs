import { World } from '../src/lib/ecs-js/index.js';
import { AttackIntent } from '../src/rules/components/Intents/AttackIntent.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { equipmentSystem } from '../src/rules/systems/equipmentSystem.js';
import { combatSystem } from '../src/rules/systems/combatSystem.js';
import { cleanupSystem } from '../src/rules/systems/cleanupSystem.js';
import { Position } from '../src/rules/components/Position.js';

/** @param {any} c @param {string} m */
function assert(c,m){ if(!c) throw new Error('Assertion failed: '+m); }

/**
 * @param {World} world
 * @param {string} name
 * @param {{ weapon?: number, armor?: number }} [eq]
 * @param {number} [hp=10]
 */
function makeActor(world, name, eq, hp=10) {
  const id = world.create();
  world.add(id, NamedIdentity, { name, identity: name.toLowerCase() });
  world.add(id, Vitality, { maxHp: Math.max(1,hp), hp });
  world.add(id, Equipment, {});
  const e = /** @type {any} */(world.get(id, Equipment));
  if (eq?.weapon) e.weapon = eq.weapon;
  if (eq?.armor) e.armor = eq.armor;
  return id;
}

/**
 * @param {World} world
 * @param {{ id: string, name: string, attack: number }} param1
 */
function makeWeapon(world, { id, name, attack }) {
  const wid = world.create();
  world.add(wid, NamedIdentity, { name, identity: id });
  world.add(wid, ItemInfo, { type:'equip', slot:'weapon', weight:1, value:0, description:'', count:1, bonuses: { attack }, rarity:1, rarityName:'common', affixes: [] });
  return wid;
}

async function run() {
  const world = new World({ seed: 42 });

  const bigSword = makeWeapon(world, { id:'test_big_sword', name:'Test Sword', attack: 99 });
  const hero = makeActor(world, 'Hero', { weapon: bigSword }, 10);
  const foe = makeActor(world, 'Dummy', {}, 3);

  // Place actors adjacent so the melee range gate passes
  world.add(hero, Position, { x: 0, y: 0 });
  world.add(foe, Position, { x: 1, y: 0 });

  equipmentSystem(world);

  // One hit should reduce foe hp to 0 and mark them for cleanup.
  world.add(hero, AttackIntent, { targetId: foe });
  combatSystem(world);

  const fVit = /** @type {any} */ (world.get(foe, Vitality));
  assert(fVit && fVit.hp <= 0, 'foe should be at 0 hp or below');

  // Now run cleanup and ensure the foe is removed from the world.
  cleanupSystem(world);
  assert(!world.isAlive(foe), 'dead entity should be destroyed by cleanupSystem');

  // Also ensure additional cleanup runs are safe (idempotent)
  cleanupSystem(world);

  console.log('Death cleanup tests PASS');
}

run().catch(e=>{ console.error(e); process.exitCode = 1; });
