import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { equipmentSystem } from '../src/rules/systems/equipmentSystem.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';

function makeEquip(world, { name, id, slot, bonuses, affixes = [] }) {
  const eid = world.create();
  world.add(eid, NamedIdentity, { name, identity: id });
  world.add(eid, ItemInfo, { type: 'equip', slot, weight: 1, value: 0, description: '', count: 1, bonuses: bonuses || {}, rarity: 1, rarityName: 'common', affixes });
  return eid;
}

Deno.test("equipment system derives stats from equipped items", () => {
  const world = new World({ seed: 7 });

  const actor = world.create();
  world.add(actor, Equipment, {});
  const eq = world.get(actor, Equipment);

  const sword = makeEquip(world, { name: 'Sword', id: 'sword_plain', slot: 'weapon', bonuses: { attack: 2 } });
  const armor = makeEquip(world, { name: 'Leather', id: 'leather_armor', slot: 'armor', bonuses: { defense: 1 }, affixes: ['life1'] });

  eq.weapon = sword;
  eq.armor = armor;

  equipmentSystem(world);

  assert(eq.attackDerived === 2, 'attack derived from sword');
  assert(eq.defenseDerived === 1, 'defense derived from armor');
  assert(eq.maxHpDerived >= 5, 'life1 passive applied');
});
