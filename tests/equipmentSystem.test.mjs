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
  const helm = makeEquip(world, { name: 'Iron Helm', id: 'helm_iron', slot: 'head', bonuses: { defense: 1 } });
  const bow = makeEquip(world, { name: 'Short Bow', id: 'bow_short', slot: 'ranged', bonuses: { attack: 1 } });

  eq.weapon = sword;
  eq.armor = armor;
  eq.head = helm;
  eq.ranged = bow;

  equipmentSystem(world);

  assert(eq.attackDerived === 3, 'attack derived from sword + ranged item');
  assert(eq.defenseDerived === 2, 'defense derived from armor + head');
  assert(eq.maxHpDerived >= 5, 'life1 passive applied');
});

Deno.test("equipment system applies head-specific affix passives", () => {
  const world = new World({ seed: 8 });
  const actor = world.create();
  world.add(actor, Equipment, {});
  const eq = world.get(actor, Equipment);

  const helm = makeEquip(world, {
    name: 'Attuned Helm',
    id: 'helm_iron',
    slot: 'head',
    bonuses: { defense: 1 },
    affixes: ['helmGuard1', 'helmAttuned1'],
  });

  eq.head = helm;
  equipmentSystem(world);

  assert(eq.defenseDerived === 2, 'head bonus + helmGuard1 should add defense');
  assert(eq.manaRegenDerived >= 0.25, 'helmAttuned1 should add mana regen');
});
