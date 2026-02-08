import { World } from '../src/lib/ecs-js/index.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { installAffixTriggers } from '../src/rules/systems/affixTriggerSystem.js';
import { registerScript, ScriptVerb } from '../src/rules/scripting.js';

function assert(c, m) { if (!c) throw new Error('Assertion failed: ' + m); }

async function run() {
  const world = new World({ seed: 1 });
  installAffixTriggers(world);

  // Register a test affix that fires onDamaged and heals the defender by 1
  registerScript('affix:test_shield', {
    [ScriptVerb.AffixOnDamaged]: (_world, ctx) => {
      ctx.heal(ctx.defender, 1);
    }
  });

  // Manually add the test affix to AFFIX_DEFS for the trigger to find it
  // We'll use a different approach: craft equipment with a known affix
  // Actually, we need to register in AFFIX_DEFS too. Let's import and add.
  const { AFFIX_DEFS } = await import('../src/rules/data/affixes.js');
  AFFIX_DEFS['test_shield'] = {
    name: 'Test Shield',
    slots: ['armor'],
    triggers: ['onDamaged'],
    script: 'affix:test_shield',
    weight: 1
  };

  // Create attacker and defender
  const attacker = world.create();
  world.add(attacker, Vitality, { maxHp: 20, hp: 20 });

  const defender = world.create();
  world.add(defender, Vitality, { maxHp: 20, hp: 15 });
  world.add(defender, Equipment, {});

  // Create armor with the test affix
  const armor = world.create();
  world.add(armor, NamedIdentity, { name: 'Test Armor', identity: 'test_armor' });
  world.add(armor, ItemInfo, {
    type: 'equip', slot: 'armor', weight: 1, value: 0, description: '',
    count: 1, bonuses: {}, rarity: 1, rarityName: 'common', affixes: ['test_shield']
  });

  const defEq = world.get(defender, Equipment);
  defEq.armor = armor;

  // Simulate a 'damaged' event (which combatSystem normally emits)
  world.emit('damaged', { target: defender, amount: 5, source: attacker });

  // The test_shield affix should have healed defender by 1
  const defVit = world.get(defender, Vitality);
  assert(defVit.hp === 16, `defender should be healed to 16, got ${defVit.hp}`);

  // --- Test with no equipment: should not throw ---
  const naked = world.create();
  world.add(naked, Vitality, { maxHp: 10, hp: 5 });
  world.emit('damaged', { target: naked, amount: 3, source: attacker });
  // No crash means success

  // --- Test retaliate helper via a custom affix ---
  registerScript('affix:test_thorns', {
    [ScriptVerb.AffixOnDamaged]: (_world, ctx) => {
      ctx.retaliate(3);
    }
  });
  AFFIX_DEFS['test_thorns'] = {
    name: 'Test Thorns',
    slots: ['armor'],
    triggers: ['onDamaged'],
    script: 'affix:test_thorns',
    weight: 1
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

  world.emit('damaged', { target: d2, amount: 5, source: a2 });

  const a2Vit = world.get(a2, Vitality);
  assert(a2Vit.hp === 17, `attacker should take 3 retaliation, got hp=${a2Vit.hp}`);

  // Cleanup test affixes
  delete AFFIX_DEFS['test_shield'];
  delete AFFIX_DEFS['test_thorns'];

  console.log('Affix trigger tests PASS');
}

run().catch(e => { console.error(e); process.exitCode = 1; });
