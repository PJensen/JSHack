import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { installAffixTriggers } from '../src/rules/systems/affixTriggerSystem.js';
import { registerScript, ScriptVerb } from '../src/rules/scripting.js';
import { dealDamage } from '../src/rules/utils/dealDamage.js';

Deno.test("custom affix heals defender after canonical damage application", async () => {
  const world = new World({ seed: 1 });
  installAffixTriggers(world);

  registerScript('affix:test_shield', {
    [ScriptVerb.AffixOnDamaged]: (_world, ctx) => {
      ctx.heal(ctx.defender, 1);
    }
  });

  const { AFFIX_DEFS } = await import('../src/rules/data/affixes.js');
  AFFIX_DEFS['test_shield'] = {
    name: 'Test Shield', slots: ['armor'], triggers: ['onDamaged'],
    script: 'affix:test_shield', weight: 1
  };

  const attacker = world.create();
  world.add(attacker, Vitality, { maxHp: 20, hp: 20 });

  const defender = world.create();
  world.add(defender, Vitality, { maxHp: 20, hp: 15 });
  world.add(defender, Equipment, {});

  const armor = world.create();
  world.add(armor, NamedIdentity, { name: 'Test Armor', identity: 'test_armor' });
  world.add(armor, ItemInfo, {
    type: 'equip', slot: 'armor', weight: 1, value: 0, description: '',
    count: 1, bonuses: {}, rarity: 1, rarityName: 'common', affixes: ['test_shield']
  });

  world.get(defender, Equipment).armor = armor;

  dealDamage(world, { target: defender, amount: 5, source: attacker });

  const defVit = world.get(defender, Vitality);
  assert(defVit.hp === 11, `defender should end at 11 hp after damage then heal, got ${defVit.hp}`);

  // No equipment: should not throw
  const naked = world.create();
  world.add(naked, Vitality, { maxHp: 10, hp: 5 });
  dealDamage(world, { target: naked, amount: 3, source: attacker });

  delete AFFIX_DEFS['test_shield'];
});

Deno.test("custom affix retaliates on damaged event", async () => {
  const world = new World({ seed: 1 });
  installAffixTriggers(world);

  registerScript('affix:test_thorns', {
    [ScriptVerb.AffixOnDamaged]: (_world, ctx) => {
      ctx.retaliate(3);
    }
  });

  const { AFFIX_DEFS } = await import('../src/rules/data/affixes.js');
  AFFIX_DEFS['test_thorns'] = {
    name: 'Test Thorns', slots: ['armor'], triggers: ['onDamaged'],
    script: 'affix:test_thorns', weight: 1
  };

  const d2 = world.create();
  world.add(d2, Vitality, { maxHp: 20, hp: 20 });
  world.add(d2, Equipment, {});
  const thornsArmor = world.create();
  world.add(thornsArmor, NamedIdentity, { name: 'Thorns Armor', identity: 'thorns_armor' });
  world.add(thornsArmor, ItemInfo, {
    type: 'equip', slot: 'armor', weight: 1, value: 0, description: '',
    count: 1, bonuses: {}, rarity: 1, rarityName: 'common', affixes: ['test_thorns']
  });
  world.get(d2, Equipment).armor = thornsArmor;

  const a2 = world.create();
  world.add(a2, Vitality, { maxHp: 20, hp: 20 });

  dealDamage(world, { target: d2, amount: 5, source: a2 });

  const a2Vit = world.get(a2, Vitality);
  assert(a2Vit.hp === 17, `attacker should take 3 retaliation, got hp=${a2Vit.hp}`);

  delete AFFIX_DEFS['test_thorns'];
});
